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
package xyz.playedu.resource.service;

import com.baomidou.mybatisplus.extension.service.IService;
import java.util.Date;
import java.util.List;
import xyz.playedu.common.types.paginate.PaginationResult;
import xyz.playedu.resource.domain.SubtitleTask;

public interface SubtitleTaskService extends IService<SubtitleTask> {

    SubtitleTask createTask(
            Integer resourceId,
            Integer adminId,
            String provider,
            String language,
            Integer maxAttempts,
            String triggerSource);

    SubtitleTask findActiveTask(Integer resourceId);

    PaginationResult<SubtitleTask> paginate(Integer page, Integer size, String status);

    List<SubtitleTask> listByStatus(String status);

    List<SubtitleTask> claimPendingTasks(Integer limit, Date now);

    void cancelTask(Integer taskId);

    void movePendingTask(Integer taskId, String direction);

    void markRetryPending(Integer taskId, String errorMessage, Date nextRunAt, String triggerSource);

    void markSuccess(Integer taskId, Integer durationSeconds);

    void markFailed(Integer taskId, String errorMessage, Integer durationSeconds);

    int recoverInterruptedTasks(Date now);
}
