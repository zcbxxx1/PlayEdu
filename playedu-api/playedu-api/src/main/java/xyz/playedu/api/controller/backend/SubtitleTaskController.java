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
package xyz.playedu.api.controller.backend;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.apache.commons.collections4.MapUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import xyz.playedu.api.request.backend.SubtitleTaskMoveRequest;
import xyz.playedu.common.annotation.BackendPermission;
import xyz.playedu.common.annotation.Log;
import xyz.playedu.common.bus.BackendBus;
import xyz.playedu.common.constant.BPermissionConstant;
import xyz.playedu.common.constant.BusinessTypeConstant;
import xyz.playedu.common.context.BCtx;
import xyz.playedu.common.domain.AdminUser;
import xyz.playedu.common.exception.ServiceException;
import xyz.playedu.common.service.AdminUserService;
import xyz.playedu.common.types.JsonResponse;
import xyz.playedu.common.types.paginate.PaginationResult;
import xyz.playedu.common.util.StringUtil;
import xyz.playedu.resource.domain.Resource;
import xyz.playedu.resource.domain.ResourceExtra;
import xyz.playedu.resource.domain.SubtitleTask;
import xyz.playedu.resource.service.ResourceExtraService;
import xyz.playedu.resource.service.ResourceService;
import xyz.playedu.resource.service.SubtitleTaskService;

@RestController
@RequestMapping("/backend/v1/subtitle-tasks")
public class SubtitleTaskController {

    @Autowired private SubtitleTaskService subtitleTaskService;

    @Autowired private ResourceService resourceService;

    @Autowired private ResourceExtraService resourceExtraService;

    @Autowired private AdminUserService adminUserService;

    @Autowired private BackendBus backendBus;

    @BackendPermission(slug = BPermissionConstant.UPLOAD)
    @GetMapping("/index")
    @Log(title = "字幕任务-列表", businessType = BusinessTypeConstant.GET)
    public JsonResponse index(@RequestParam HashMap<String, Object> params) {
        Integer page = MapUtils.getInteger(params, "page", 1);
        Integer size = MapUtils.getInteger(params, "size", 10);
        String status = MapUtils.getString(params, "status");

        PaginationResult<SubtitleTask> result = subtitleTaskService.paginate(page, size, status);

        HashMap<String, Object> data = new HashMap<>();
        data.put("data", result.getData());
        data.put("total", result.getTotal());
        data.put("resources", new HashMap<>());
        data.put("resource_extras", new HashMap<>());
        data.put("admin_users", new HashMap<>());

        List<Integer> resourceIds =
                result.getData().stream().map(SubtitleTask::getResourceId).distinct().toList();
        if (StringUtil.isNotEmpty(resourceIds)) {
            Map<Integer, Resource> resources =
                    resourceService.chunks(resourceIds).stream()
                            .collect(Collectors.toMap(Resource::getId, item -> item));
            data.put("resources", resources);

            Map<Integer, ResourceExtra> resourceExtras =
                    resourceExtraService.chunksByRids(resourceIds).stream()
                            .collect(Collectors.toMap(ResourceExtra::getRid, item -> item));
            data.put("resource_extras", resourceExtras);
        }

        List<Integer> adminIds =
                result.getData().stream().map(SubtitleTask::getAdminId).distinct().toList();
        if (StringUtil.isNotEmpty(adminIds)) {
            Map<Integer, String> adminUsers =
                    adminUserService.chunks(adminIds).stream()
                            .collect(Collectors.toMap(AdminUser::getId, AdminUser::getName));
            data.put("admin_users", adminUsers);
        }

        return JsonResponse.data(data);
    }

    @BackendPermission(slug = BPermissionConstant.UPLOAD)
    @PostMapping("/{id}/cancel")
    @Log(title = "字幕任务-取消", businessType = BusinessTypeConstant.UPDATE)
    public JsonResponse cancel(@PathVariable(name = "id") Integer id) {
        SubtitleTask task = subtitleTaskService.getById(id);
        if (task == null) {
            return JsonResponse.error("字幕任务不存在");
        }
        checkTaskPermission(task);

        subtitleTaskService.cancelTask(id);
        ResourceExtra extra = resourceExtraService.findByRid(task.getResourceId());
        if (extra != null) {
            String subtitleStatus =
                    extra.getSubtitleRid() != null && extra.getSubtitleRid() > 0
                            ? "SUCCESS"
                            : "NONE";
            resourceExtraService.updateSubtitle(
                    task.getResourceId(),
                    extra.getSubtitleRid(),
                    subtitleStatus,
                    extra.getSubtitleLang(),
                    "任务已取消");
        }
        return JsonResponse.success("字幕任务已取消");
    }

    @BackendPermission(slug = BPermissionConstant.UPLOAD)
    @PutMapping("/{id}/move")
    @Log(title = "字幕任务-调序", businessType = BusinessTypeConstant.UPDATE)
    public JsonResponse move(
            @PathVariable(name = "id") Integer id, @RequestBody SubtitleTaskMoveRequest req) {
        SubtitleTask task = subtitleTaskService.getById(id);
        if (task == null) {
            return JsonResponse.error("字幕任务不存在");
        }
        checkTaskPermission(task);

        subtitleTaskService.movePendingTask(id, req.getDirection());
        return JsonResponse.success("字幕任务顺序已更新");
    }

    private void checkTaskPermission(SubtitleTask task) {
        if (!backendBus.isSuperAdmin() && !task.getAdminId().equals(BCtx.getId())) {
            throw new ServiceException("无权限");
        }
    }
}
