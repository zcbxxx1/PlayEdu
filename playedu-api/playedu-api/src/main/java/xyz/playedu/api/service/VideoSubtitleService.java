/*
 * Copyright (C) 2023 杭州白书科技有限公司
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package xyz.playedu.api.service;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import xyz.playedu.api.service.subtitle.AudioExtractor;
import xyz.playedu.api.service.subtitle.SubtitleProviderClient;
import xyz.playedu.api.service.subtitle.SubtitleProviderRequest;
import xyz.playedu.common.config.PlayEduConfig;
import xyz.playedu.common.constant.BackendConstant;
import xyz.playedu.common.service.AppConfigService;
import xyz.playedu.common.util.S3Util;
import xyz.playedu.common.util.StringUtil;
import xyz.playedu.resource.domain.Resource;
import xyz.playedu.resource.domain.ResourceExtra;
import xyz.playedu.resource.service.ResourceExtraService;
import xyz.playedu.resource.service.ResourceService;

@Service
@Slf4j
public class VideoSubtitleService {

    public static final String STATUS_NONE = "NONE";
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_PROCESSING = "PROCESSING";
    public static final String STATUS_SUCCESS = "SUCCESS";
    public static final String STATUS_FAILED = "FAILED";

    @Autowired private ResourceService resourceService;

    @Autowired private ResourceExtraService resourceExtraService;

    @Autowired private AppConfigService appConfigService;

    @Autowired private PlayEduConfig playEduConfig;

    @Autowired private AudioExtractor audioExtractor;

    @Autowired private List<SubtitleProviderClient> subtitleProviderClients;

    public boolean prepareGenerateSubtitle(Integer resourceId) {
        if (!Boolean.TRUE.equals(playEduConfig.getSubtitleEnabled())
                || !Boolean.TRUE.equals(playEduConfig.getSubtitleAutoGenerateOnUpload())) {
            return false;
        }

        if (StringUtil.isEmpty(playEduConfig.getSubtitleProviderUrl())) {
            log.warn("字幕服务未配置provider-url,跳过自动生成字幕,resourceId={}", resourceId);
            return false;
        }

        resourceExtraService.updateSubtitle(
                resourceId,
                null,
                STATUS_PENDING,
                playEduConfig.getSubtitleLanguage(),
                "");
        return true;
    }

    @Async
    public void generateSubtitle(Integer resourceId, Integer adminId) {
        Resource resource = resourceService.getById(resourceId);
        if (resource == null || !BackendConstant.RESOURCE_TYPE_VIDEO.equals(resource.getType())) {
            return;
        }

        ResourceExtra extra = resourceExtraService.findByRid(resourceId);
        if (extra == null) {
            return;
        }

        resourceExtraService.updateSubtitle(
                resourceId,
                extra.getSubtitleRid(),
                STATUS_PROCESSING,
                normalizeLanguage(playEduConfig.getSubtitleLanguage()),
                "");

        File tempFile = null;
        File subtitleSourceFile = null;
        try {
            log.info("开始自动生成字幕,resourceId={},path={}", resourceId, resource.getPath());
            tempFile = File.createTempFile("playedu-subtitle-", "." + resource.getExtension());
            S3Util s3Util = new S3Util(appConfigService.getS3Config());
            s3Util.downloadToFile(resource.getPath(), tempFile);

            subtitleSourceFile = prepareSubtitleSourceFile(tempFile);
            String subtitleContent =
                    validateSubtitleContent(
                            resolveProviderClient()
                                    .transcribe(subtitleSourceFile, buildProviderRequest()));
            Resource subtitleResource = saveSubtitleResource(resource, adminId, subtitleContent, extra);

            resourceExtraService.updateSubtitle(
                    resourceId,
                    subtitleResource.getId(),
                    STATUS_SUCCESS,
                    normalizeLanguage(playEduConfig.getSubtitleLanguage()),
                    "");
            log.info(
                    "字幕生成成功,resourceId={},subtitleRid={},size={}",
                    resourceId,
                    subtitleResource.getId(),
                    subtitleContent.getBytes(StandardCharsets.UTF_8).length);
        } catch (Exception e) {
            log.error("自动生成字幕失败,resourceId={}", resourceId, e);
            resourceExtraService.updateSubtitle(
                    resourceId,
                    0,
                    STATUS_FAILED,
                    normalizeLanguage(playEduConfig.getSubtitleLanguage()),
                    truncateError(e.getMessage()));
        } finally {
            if (tempFile != null && tempFile.exists() && !tempFile.delete()) {
                log.warn("临时视频文件删除失败,path={}", tempFile.getAbsolutePath());
            }
            if (subtitleSourceFile != null
                    && !subtitleSourceFile.equals(tempFile)
                    && subtitleSourceFile.exists()
                    && !subtitleSourceFile.delete()) {
                log.warn("临时音轨文件删除失败,path={}", subtitleSourceFile.getAbsolutePath());
            }
        }
    }

    private File prepareSubtitleSourceFile(File videoFile) {
        if (!Boolean.TRUE.equals(playEduConfig.getSubtitleExtractAudioBeforeTranscribe())) {
            return videoFile;
        }
        return audioExtractor.extract(videoFile);
    }

    private String validateSubtitleContent(String subtitleContent) {
        String trimmed = subtitleContent == null ? "" : subtitleContent.trim();
        if (StringUtil.isEmpty(trimmed)) {
            throw new IllegalStateException("字幕服务返回空字幕");
        }
        if ("Internal Server Error".equalsIgnoreCase(trimmed)
                || trimmed.startsWith("<html")
                || trimmed.startsWith("<!DOCTYPE html")) {
            throw new IllegalStateException("字幕服务返回异常内容: " + trimmed);
        }

        String format = playEduConfig.getSubtitleResponseFormat();
        if ("vtt".equalsIgnoreCase(format)) {
            if (!trimmed.startsWith("WEBVTT")) {
                throw new IllegalStateException("字幕服务返回非VTT内容");
            }
            String cueContent = trimmed.replaceFirst("^WEBVTT\\s*", "").trim();
            if (StringUtil.isEmpty(cueContent)) {
                throw new IllegalStateException("字幕内容为空");
            }
        }
        return subtitleContent;
    }

    private Resource saveSubtitleResource(
            Resource videoResource, Integer adminId, String subtitleContent, ResourceExtra extra) {
        byte[] subtitleBytes = subtitleContent.getBytes(StandardCharsets.UTF_8);
        Resource existingSubtitle = null;
        if (extra.getSubtitleRid() != null && extra.getSubtitleRid() > 0) {
            existingSubtitle = resourceService.getById(extra.getSubtitleRid());
        }

        String path =
                existingSubtitle != null
                        ? existingSubtitle.getPath()
                        : BackendConstant.UPLOAD_TXT_DIR + UUID.randomUUID() + ".vtt";
        new S3Util(appConfigService.getS3Config()).saveBytes(subtitleBytes, path, "text/vtt");

        String subtitleName = videoResource.getName() + "-subtitle";
        if (existingSubtitle != null) {
            resourceService.update(
                    existingSubtitle,
                    adminId,
                    null,
                    BackendConstant.RESOURCE_TYPE_TXT,
                    subtitleName,
                    "vtt",
                    Long.valueOf(subtitleBytes.length),
                    "",
                    path,
                    videoResource.getId(),
                    1);
            return existingSubtitle;
        }

        return resourceService.create(
                adminId,
                null,
                BackendConstant.RESOURCE_TYPE_TXT,
                subtitleName,
                "vtt",
                Long.valueOf(subtitleBytes.length),
                "",
                path,
                videoResource.getId(),
                1);
    }

    private SubtitleProviderClient resolveProviderClient() {
        String provider = playEduConfig.getSubtitleProvider();
        return subtitleProviderClients.stream()
                .filter(item -> item.supports(provider))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("不支持的字幕服务提供方: " + provider));
    }

    private SubtitleProviderRequest buildProviderRequest() {
        return SubtitleProviderRequest.builder()
                .language(normalizeLanguage(playEduConfig.getSubtitleLanguage()))
                .task(playEduConfig.getSubtitleTask())
                .responseFormat(playEduConfig.getSubtitleResponseFormat())
                .timeoutMs(playEduConfig.getSubtitleTimeoutMs())
                .build();
    }

    private String normalizeLanguage(String language) {
        return StringUtil.isEmpty(language) ? "zh" : language;
    }

    private String truncateError(String error) {
        if (StringUtil.isEmpty(error)) {
            return "字幕生成失败";
        }
        return error.length() > 250 ? error.substring(0, 250) : error;
    }
}
