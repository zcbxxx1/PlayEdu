package xyz.playedu.api.service.subtitle;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import xyz.playedu.common.config.PlayEduConfig;
import xyz.playedu.common.util.StringUtil;

@Component
@Slf4j
public class FfmpegAudioExtractor implements AudioExtractor {

    @Autowired private PlayEduConfig playEduConfig;

    @Override
    public File extract(File videoFile) {
        String audioFormat = normalizeAudioFormat(playEduConfig.getSubtitleAudioFormat());
        File audioFile;
        try {
            audioFile = File.createTempFile("playedu-subtitle-audio-", "." + audioFormat);
        } catch (IOException e) {
            throw new IllegalStateException("创建临时音轨文件失败", e);
        }

        List<String> command = new ArrayList<>();
        command.add(normalizeFfmpegCommand());
        command.add("-y");
        command.add("-i");
        command.add(videoFile.getAbsolutePath());
        command.add("-vn");
        command.add("-ac");
        command.add(String.valueOf(playEduConfig.getSubtitleAudioChannels()));
        command.add("-ar");
        command.add(String.valueOf(playEduConfig.getSubtitleAudioSampleRate()));
        command.add("-c:a");
        command.add(resolveAudioCodec(audioFormat));
        command.add(audioFile.getAbsolutePath());

        String output = runCommand(command);
        if (!audioFile.exists() || audioFile.length() == 0) {
            throw new IllegalStateException("音轨提取失败: ffmpeg 未生成有效音频文件,output=" + truncateOutput(output));
        }

        log.info(
                "音轨提取完成,source={},audio={},size={}",
                videoFile.getName(),
                audioFile.getName(),
                audioFile.length());
        return audioFile;
    }

    private String runCommand(List<String> command) {
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(true);
        try {
            Process process = processBuilder.start();
            String output = readAll(process.getInputStream());
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new IllegalStateException(
                        "音轨提取失败: ffmpeg exitCode=" + exitCode + ",output=" + truncateOutput(output));
            }
            return output;
        } catch (IOException e) {
            throw new IllegalStateException(
                    "音轨提取失败: 无法执行命令 " + normalizeFfmpegCommand() + ",请确认容器中已安装 ffmpeg", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("音轨提取失败: ffmpeg 执行被中断", e);
        }
    }

    private String readAll(InputStream inputStream) throws IOException {
        return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
    }

    private String normalizeFfmpegCommand() {
        return StringUtil.isEmpty(playEduConfig.getSubtitleFfmpegCommand())
                ? "ffmpeg"
                : playEduConfig.getSubtitleFfmpegCommand();
    }

    private String normalizeAudioFormat(String format) {
        return StringUtil.isEmpty(format) ? "wav" : format.toLowerCase();
    }

    private String resolveAudioCodec(String audioFormat) {
        if ("wav".equals(audioFormat)) {
            return "pcm_s16le";
        }
        if ("mp3".equals(audioFormat)) {
            return "libmp3lame";
        }
        if ("flac".equals(audioFormat)) {
            return "flac";
        }
        throw new IllegalStateException("不支持的字幕音轨格式: " + audioFormat);
    }

    private String truncateOutput(String output) {
        if (StringUtil.isEmpty(output)) {
            return "";
        }
        return output.length() > 500 ? output.substring(0, 500) : output;
    }
}
