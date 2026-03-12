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
package xyz.playedu.resource.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import org.springframework.stereotype.Service;
import xyz.playedu.common.types.paginate.PaginationResult;
import xyz.playedu.resource.domain.SubtitleTask;
import xyz.playedu.resource.mapper.SubtitleTaskMapper;
import xyz.playedu.resource.service.SubtitleTaskService;

@Service
public class SubtitleTaskServiceImpl extends ServiceImpl<SubtitleTaskMapper, SubtitleTask>
        implements SubtitleTaskService {

    @Override
    public SubtitleTask createTask(
            Integer resourceId,
            Integer adminId,
            String provider,
            String language,
            Integer maxAttempts,
            String triggerSource) {
        Date now = new Date();
        SubtitleTask task = new SubtitleTask();
        task.setResourceId(resourceId);
        task.setAdminId(adminId);
        task.setStatus(SubtitleTask.STATUS_PENDING);
        task.setAttempts(0);
        task.setMaxAttempts(maxAttempts);
        task.setProvider(provider);
        task.setLanguage(language);
        task.setTriggerSource(triggerSource);
        task.setErrorMessage("");
        task.setDurationSeconds(0);
        task.setNextRunAt(now);
        task.setCreatedAt(now);
        task.setUpdatedAt(now);
        save(task);
        return task;
    }

    @Override
    public SubtitleTask findActiveTask(Integer resourceId) {
        QueryWrapper<SubtitleTask> wrapper = new QueryWrapper<>();
        wrapper.eq("resource_id", resourceId)
                .in("status", SubtitleTask.STATUS_PENDING, SubtitleTask.STATUS_PROCESSING)
                .orderByDesc("id")
                .last("limit 1");
        return getOne(wrapper);
    }

    @Override
    public PaginationResult<SubtitleTask> paginate(Integer page, Integer size, String status) {
        Page<SubtitleTask> pageObj = new Page<>(page, size);
        QueryWrapper<SubtitleTask> wrapper = new QueryWrapper<>();
        if (status != null && !status.trim().isEmpty()) {
            wrapper.eq("status", status);
        }
        wrapper.orderByDesc("id");

        IPage<SubtitleTask> iPage = page(pageObj, wrapper);
        PaginationResult<SubtitleTask> result = new PaginationResult<>();
        result.setData(iPage.getRecords());
        result.setTotal(iPage.getTotal());
        return result;
    }

    @Override
    public List<SubtitleTask> listByStatus(String status) {
        QueryWrapper<SubtitleTask> wrapper = new QueryWrapper<>();
        wrapper.eq("status", status).orderByAsc("id");
        return list(wrapper);
    }

    @Override
    public List<SubtitleTask> claimPendingTasks(Integer limit, Date now) {
        if (limit == null || limit <= 0) {
            return new ArrayList<>();
        }

        QueryWrapper<SubtitleTask> wrapper = new QueryWrapper<>();
        wrapper.eq("status", SubtitleTask.STATUS_PENDING)
                .le("next_run_at", now)
                .orderByAsc("id")
                .last("limit " + limit);

        List<SubtitleTask> candidates = list(wrapper);
        List<SubtitleTask> claimed = new ArrayList<>();
        for (SubtitleTask candidate : candidates) {
            LambdaUpdateWrapper<SubtitleTask> updateWrapper = new LambdaUpdateWrapper<>();
            updateWrapper.eq(SubtitleTask::getId, candidate.getId())
                    .eq(SubtitleTask::getStatus, SubtitleTask.STATUS_PENDING)
                    .set(SubtitleTask::getStatus, SubtitleTask.STATUS_PROCESSING)
                    .set(SubtitleTask::getStartedAt, now)
                    .set(SubtitleTask::getFinishedAt, null)
                    .set(SubtitleTask::getDurationSeconds, 0)
                    .set(SubtitleTask::getUpdatedAt, now)
                    .set(SubtitleTask::getErrorMessage, "")
                    .setSql("attempts = attempts + 1");
            if (update(updateWrapper)) {
                claimed.add(getById(candidate.getId()));
            }
        }
        return claimed;
    }

    @Override
    public void markRetryPending(
            Integer taskId, String errorMessage, Date nextRunAt, String triggerSource) {
        SubtitleTask updateItem = new SubtitleTask();
        updateItem.setId(taskId);
        updateItem.setStatus(SubtitleTask.STATUS_PENDING);
        updateItem.setTriggerSource(triggerSource);
        updateItem.setErrorMessage(errorMessage);
        updateItem.setStartedAt(null);
        updateItem.setFinishedAt(null);
        updateItem.setDurationSeconds(0);
        updateItem.setNextRunAt(nextRunAt);
        updateItem.setUpdatedAt(new Date());
        updateById(updateItem);
    }

    @Override
    public void markSuccess(Integer taskId, Integer durationSeconds) {
        Date now = new Date();
        SubtitleTask updateItem = new SubtitleTask();
        updateItem.setId(taskId);
        updateItem.setStatus(SubtitleTask.STATUS_SUCCESS);
        updateItem.setErrorMessage("");
        updateItem.setFinishedAt(now);
        updateItem.setDurationSeconds(durationSeconds);
        updateItem.setUpdatedAt(now);
        updateById(updateItem);
    }

    @Override
    public void markFailed(Integer taskId, String errorMessage, Integer durationSeconds) {
        Date now = new Date();
        SubtitleTask updateItem = new SubtitleTask();
        updateItem.setId(taskId);
        updateItem.setStatus(SubtitleTask.STATUS_FAILED);
        updateItem.setErrorMessage(errorMessage);
        updateItem.setFinishedAt(now);
        updateItem.setDurationSeconds(durationSeconds);
        updateItem.setUpdatedAt(now);
        updateById(updateItem);
    }

    @Override
    public int recoverInterruptedTasks(Date now) {
        LambdaUpdateWrapper<SubtitleTask> updateWrapper = new LambdaUpdateWrapper<>();
        updateWrapper.eq(SubtitleTask::getStatus, SubtitleTask.STATUS_PROCESSING)
                .set(SubtitleTask::getStatus, SubtitleTask.STATUS_PENDING)
                .set(SubtitleTask::getStartedAt, null)
                .set(SubtitleTask::getFinishedAt, null)
                .set(SubtitleTask::getDurationSeconds, 0)
                .set(SubtitleTask::getNextRunAt, now)
                .set(SubtitleTask::getTriggerSource, SubtitleTask.TRIGGER_RETRY)
                .set(SubtitleTask::getUpdatedAt, now)
                .set(
                        SubtitleTask::getErrorMessage,
                        "服务重启后自动恢复到队列，等待重新执行");
        return getBaseMapper().update(null, updateWrapper);
    }
}
