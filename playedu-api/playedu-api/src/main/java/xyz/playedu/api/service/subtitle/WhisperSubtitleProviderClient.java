package xyz.playedu.api.service.subtitle;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import java.io.File;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import xyz.playedu.common.config.PlayEduConfig;
import xyz.playedu.common.util.StringUtil;

@Component
public class WhisperSubtitleProviderClient implements SubtitleProviderClient {

    @Autowired private PlayEduConfig playEduConfig;

    @Override
    public boolean supports(String provider) {
        return "whisper".equalsIgnoreCase(provider);
    }

    @Override
    public String transcribe(File mediaFile, SubtitleProviderRequest request) {
        HttpResponse response =
                HttpRequest.post(buildAsrUrl(request))
                        .form("audio_file", mediaFile)
                        .timeout(request.getTimeoutMs())
                        .execute();
        if (!response.isOk()) {
            throw new IllegalStateException("字幕服务请求失败: HTTP " + response.getStatus());
        }

        String body = response.body();
        if (StringUtil.isEmpty(body)) {
            throw new IllegalStateException("字幕服务返回空内容");
        }
        return body;
    }

    private String buildAsrUrl(SubtitleProviderRequest request) {
        String providerUrl = playEduConfig.getSubtitleProviderUrl();
        String separator = providerUrl.contains("?") ? "&" : "?";
        return providerUrl
                + separator
                + "task="
                + request.getTask()
                + "&language="
                + request.getLanguage()
                + "&output="
                + request.getResponseFormat();
    }
}
