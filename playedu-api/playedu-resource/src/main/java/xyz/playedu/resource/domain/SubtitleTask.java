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
package xyz.playedu.resource.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.Date;
import lombok.Data;

@Data
@TableName(value = "subtitle_tasks")
public class SubtitleTask implements Serializable {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_PROCESSING = "PROCESSING";
    public static final String STATUS_SUCCESS = "SUCCESS";
    public static final String STATUS_FAILED = "FAILED";

    public static final String TRIGGER_UPLOAD = "UPLOAD";
    public static final String TRIGGER_MANUAL = "MANUAL";
    public static final String TRIGGER_RETRY = "RETRY";

    @TableId(type = IdType.AUTO)
    private Integer id;

    @JsonProperty("resource_id")
    private Integer resourceId;

    @JsonProperty("admin_id")
    private Integer adminId;

    private String status;

    private Integer attempts;

    @JsonProperty("max_attempts")
    private Integer maxAttempts;

    private String provider;

    private String language;

    @JsonProperty("trigger_source")
    private String triggerSource;

    @JsonProperty("error_message")
    private String errorMessage;

    @JsonProperty("duration_seconds")
    private Integer durationSeconds;

    @JsonProperty("started_at")
    private Date startedAt;

    @JsonProperty("finished_at")
    private Date finishedAt;

    @JsonProperty("next_run_at")
    private Date nextRunAt;

    @JsonProperty("created_at")
    private Date createdAt;

    @JsonProperty("updated_at")
    private Date updatedAt;

    @TableField(exist = false)
    private static final long serialVersionUID = 1L;
}
