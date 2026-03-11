package xyz.playedu.api.service.subtitle;

import java.io.File;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
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
        RestTemplate restTemplate = createRestTemplate(request.getTimeoutMs());
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("audio_file", new FileSystemResource(mediaFile));

        HttpEntity<MultiValueMap<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<String> response =
                restTemplate.exchange(buildAsrUrl(request), HttpMethod.POST, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException(
                    "字幕服务请求失败: HTTP " + response.getStatusCode().value());
        }

        String responseBody = response.getBody();
        if (StringUtil.isEmpty(responseBody)) {
            throw new IllegalStateException("字幕服务返回空内容");
        }
        return responseBody;
    }

    private RestTemplate createRestTemplate(Integer timeoutMs) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(timeoutMs);
        requestFactory.setReadTimeout(timeoutMs);
        return new RestTemplate(requestFactory);
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
