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
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import xyz.playedu.common.config.PlayEduConfig;
import xyz.playedu.resource.domain.SubtitleTask;
import xyz.playedu.resource.service.SubtitleTaskService;

@Component
@Slf4j
public class SubtitleTaskWorker {

    @Autowired private PlayEduConfig playEduConfig;

    @Autowired private SubtitleTaskService subtitleTaskService;

    @Autowired private SubtitleTaskQueueService subtitleTaskQueueService;

    @Autowired
    @Qualifier("subtitleTaskExecutor")
    private Executor subtitleTaskExecutor;

    private final AtomicInteger runningCount = new AtomicInteger(0);
    private final AtomicBoolean initialized = new AtomicBoolean(false);

    @EventListener(ApplicationReadyEvent.class)
    public void recoverTasksOnStartup() {
        if (!initialized.compareAndSet(false, true)) {
            return;
        }
        subtitleTaskQueueService.recoverInterruptedTasks();
    }

    @Scheduled(fixedDelayString = "${playedu.subtitle.queue.poll-interval-ms:5000}")
    public void dispatchPendingTasks() {
        if (!initialized.get()) {
            return;
        }
        if (!videoSubtitleEnabled()) {
            return;
        }

        int concurrency = Math.max(1, playEduConfig.getSubtitleQueueConcurrency());
        int availableSlots = concurrency - runningCount.get();
        if (availableSlots <= 0) {
            return;
        }

        List<SubtitleTask> tasks =
                subtitleTaskService.claimPendingTasks(availableSlots, new Date());
        for (SubtitleTask task : tasks) {
            runningCount.incrementAndGet();
            subtitleTaskExecutor.execute(
                    () -> {
                        try {
                            subtitleTaskQueueService.processTask(task.getId());
                        } finally {
                            runningCount.decrementAndGet();
                        }
                    });
        }
    }

    private boolean videoSubtitleEnabled() {
        return Boolean.TRUE.equals(playEduConfig.getSubtitleEnabled());
    }
}
