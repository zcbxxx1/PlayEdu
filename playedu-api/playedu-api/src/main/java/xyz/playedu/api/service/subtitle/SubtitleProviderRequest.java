package xyz.playedu.api.service.subtitle;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SubtitleProviderRequest {
    private final String language;
    private final String task;
    private final String responseFormat;
    private final Integer timeoutMs;
}
