package xyz.playedu.api.service.subtitle;

import java.io.File;

public interface SubtitleProviderClient {

    boolean supports(String provider);

    String transcribe(File mediaFile, SubtitleProviderRequest request);
}
