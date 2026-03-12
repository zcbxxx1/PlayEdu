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

import java.util.Date;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import xyz.playedu.common.config.PlayEduConfig;
import xyz.playedu.common.constant.BackendConstant;
import xyz.playedu.common.exception.ServiceException;
import xyz.playedu.common.util.StringUtil;
import xyz.playedu.resource.domain.Resource;
import xyz.playedu.resource.domain.SubtitleTask;
import xyz.playedu.resource.service.ResourceExtraService;
import xyz.playedu.resource.service.ResourceService;
import xyz.playedu.resource.service.SubtitleTaskService;

@Service
@Slf4j
public class SubtitleTaskQueueService {

    @Autowired private PlayEduConfig playEduConfig;

    @Autowired private ResourceService resourceService;

    @Autowired private ResourceExtraService resourceExtraService;

    @Autowired private SubtitleTaskService subtitleTaskService;

    @Autowired private VideoSubtitleService videoSubtitleService;

    public QueueResult enqueueAutoTask(Integer resourceId, Integer adminId) {
        if (!videoSubtitleService.canAutoGenerateSubtitle()) {
            return QueueResult.skipped(videoSubtitleService.getSubtitleUnavailableReason());
        }
        SubtitleTask task = enqueueInternal(resourceId, adminId, SubtitleTask.TRIGGER_UPLOAD);
        return QueueResult.created(task);
    }

    public SubtitleTask enqueueManualTask(Integer resourceId, Integer adminId) {
        if (!videoSubtitleService.canGenerateSubtitle()) {
            throw new ServiceException(videoSubtitleService.getSubtitleUnavailableReason());
        }
        return enqueueInternal(resourceId, adminId, SubtitleTask.TRIGGER_MANUAL);
    }

    public void processTask(Integer taskId) {
        SubtitleTask task = subtitleTaskService.getById(taskId);
        if (task == null) {
            return;
        }

        long startMs = System.currentTimeMillis();
        try {
            videoSubtitleService.generateSubtitle(task.getResourceId(), task.getAdminId());
            subtitleTaskService.markSuccess(task.getId(), elapsedSeconds(startMs));
            log.info(
                    "字幕任务执行成功,taskId={},resourceId={},attempts={}",
                    task.getId(),
                    task.getResourceId(),
                    task.getAttempts());
        } catch (Exception e) {
            handleFailure(task, e, startMs);
        }
    }

    public int recoverInterruptedTasks() {
        String recoveryMessage = "服务重启后自动恢复到队列，等待重新执行";
        var interruptedTasks = subtitleTaskService.listByStatus(SubtitleTask.STATUS_PROCESSING);
        int count = subtitleTaskService.recoverInterruptedTasks(new Date());
        if (count > 0) {
            interruptedTasks.forEach(
                    item -> videoSubtitleService.markSubtitlePending(item.getResourceId(), recoveryMessage));
        }
        if (count > 0) {
            log.warn("检测到{}个处理中字幕任务,已恢复到队列", count);
        }
        return count;
    }

    private SubtitleTask enqueueInternal(Integer resourceId, Integer adminId, String triggerSource) {
        Resource resource = resourceService.getById(resourceId);
        if (resource == null || !BackendConstant.RESOURCE_TYPE_VIDEO.equals(resource.getType())) {
            throw new ServiceException("仅支持视频资源生成字幕");
        }
        if (resourceExtraService.findByRid(resourceId) == null) {
            throw new ServiceException("视频资源详情不存在");
        }

        SubtitleTask activeTask = subtitleTaskService.findActiveTask(resourceId);
        if (activeTask != null) {
            return activeTask;
        }

        videoSubtitleService.markSubtitlePending(resourceId, "");
        return subtitleTaskService.createTask(
                resourceId,
                adminId,
                normalizeString(playEduConfig.getSubtitleProvider()),
                normalizeString(playEduConfig.getSubtitleLanguage()),
                Math.max(1, playEduConfig.getSubtitleQueueRetryMaxAttempts()),
                triggerSource);
    }

    private void handleFailure(SubtitleTask task, Exception e, long startMs) {
        String errorMessage = truncateError(e.getMessage());
        int durationSeconds = elapsedSeconds(startMs);

        if (task.getAttempts() < task.getMaxAttempts()) {
            Date nextRunAt =
                    new Date(
                            System.currentTimeMillis()
                                    + Math.max(1, playEduConfig.getSubtitleQueueRetryDelaySeconds())
                                            * 1000L);
            subtitleTaskService.markRetryPending(
                    task.getId(), errorMessage, nextRunAt, SubtitleTask.TRIGGER_RETRY);
            videoSubtitleService.markSubtitlePending(task.getResourceId(), errorMessage);
            log.warn(
                    "字幕任务执行失败,准备重试,taskId={},resourceId={},attempts={}/{},nextRunAt={},error={}",
                    task.getId(),
                    task.getResourceId(),
                    task.getAttempts(),
                    task.getMaxAttempts(),
                    nextRunAt,
                    errorMessage);
            return;
        }

        subtitleTaskService.markFailed(task.getId(), errorMessage, durationSeconds);
        resourceExtraService.updateSubtitle(
                task.getResourceId(),
                0,
                VideoSubtitleService.STATUS_FAILED,
                normalizeString(playEduConfig.getSubtitleLanguage()),
                errorMessage);
        log.error(
                "字幕任务执行失败且不再重试,taskId={},resourceId={},attempts={}/{},error={}",
                task.getId(),
                task.getResourceId(),
                task.getAttempts(),
                task.getMaxAttempts(),
                errorMessage,
                e);
    }

    private int elapsedSeconds(long startMs) {
        return Math.max(0, (int) ((System.currentTimeMillis() - startMs) / 1000L));
    }

    private String truncateError(String error) {
        if (StringUtil.isEmpty(error)) {
            return "字幕生成失败";
        }
        return error.length() > 250 ? error.substring(0, 250) : error;
    }

    private String normalizeString(String value) {
        return value == null ? "" : value;
    }

    @Data
    @AllArgsConstructor
    public static class QueueResult {
        private boolean created;
        private boolean skipped;
        private String reason;
        private SubtitleTask task;

        public static QueueResult created(SubtitleTask task) {
            return new QueueResult(true, false, "", task);
        }

        public static QueueResult skipped(String reason) {
            return new QueueResult(false, true, reason, null);
        }
    }
}
