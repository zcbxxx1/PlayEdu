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

/**
 * @TableName resource_extra
 */
@Data
@TableName(value = "resource_extra")
public class ResourceExtra implements Serializable {
    /** */
    @TableId(type = IdType.AUTO)
    private Integer id;

    /** */
    private Integer rid;

    /** 封面 */
    private Integer poster;

    /** 音频时长[s] */
    private Integer duration;

    /** 字幕资源ID */
    @JsonProperty("subtitle_rid")
    private Integer subtitleRid;

    /** 字幕状态 */
    @JsonProperty("subtitle_status")
    private String subtitleStatus;

    /** 字幕语言 */
    @JsonProperty("subtitle_lang")
    private String subtitleLang;

    /** 字幕错误信息 */
    @JsonProperty("subtitle_error")
    private String subtitleError;

    /** 创建时间 */
    @JsonProperty("created_at")
    private Date createdAt;

    @TableField(exist = false)
    private static final long serialVersionUID = 1L;

    @Override
    public boolean equals(Object that) {
        if (this == that) {
            return true;
        }
        if (that == null) {
            return false;
        }
        if (getClass() != that.getClass()) {
            return false;
        }
        ResourceExtra other = (ResourceExtra) that;
        return (this.getId() == null ? other.getId() == null : this.getId().equals(other.getId()))
                && (this.getRid() == null
                        ? other.getRid() == null
                        : this.getRid().equals(other.getRid()))
                && (this.getPoster() == null
                        ? other.getPoster() == null
                        : this.getPoster().equals(other.getPoster()))
                && (this.getDuration() == null
                        ? other.getDuration() == null
                        : this.getDuration().equals(other.getDuration()))
                && (this.getSubtitleRid() == null
                        ? other.getSubtitleRid() == null
                        : this.getSubtitleRid().equals(other.getSubtitleRid()))
                && (this.getSubtitleStatus() == null
                        ? other.getSubtitleStatus() == null
                        : this.getSubtitleStatus().equals(other.getSubtitleStatus()))
                && (this.getSubtitleLang() == null
                        ? other.getSubtitleLang() == null
                        : this.getSubtitleLang().equals(other.getSubtitleLang()))
                && (this.getSubtitleError() == null
                        ? other.getSubtitleError() == null
                        : this.getSubtitleError().equals(other.getSubtitleError()))
                && (this.getCreatedAt() == null
                        ? other.getCreatedAt() == null
                        : this.getCreatedAt().equals(other.getCreatedAt()));
    }

    @Override
    public int hashCode() {
        final int prime = 31;
        int result = 1;
        result = prime * result + ((getId() == null) ? 0 : getId().hashCode());
        result = prime * result + ((getRid() == null) ? 0 : getRid().hashCode());
        result = prime * result + ((getPoster() == null) ? 0 : getPoster().hashCode());
        result = prime * result + ((getDuration() == null) ? 0 : getDuration().hashCode());
        result = prime * result + ((getSubtitleRid() == null) ? 0 : getSubtitleRid().hashCode());
        result =
                prime * result + ((getSubtitleStatus() == null) ? 0 : getSubtitleStatus().hashCode());
        result = prime * result + ((getSubtitleLang() == null) ? 0 : getSubtitleLang().hashCode());
        result =
                prime * result + ((getSubtitleError() == null) ? 0 : getSubtitleError().hashCode());
        result = prime * result + ((getCreatedAt() == null) ? 0 : getCreatedAt().hashCode());
        return result;
    }

    @Override
    public String toString() {
        StringBuilder sb = new StringBuilder();
        sb.append(getClass().getSimpleName());
        sb.append(" [");
        sb.append("Hash = ").append(hashCode());
        sb.append(", id=").append(id);
        sb.append(", rid=").append(rid);
        sb.append(", poster=").append(poster);
        sb.append(", duration=").append(duration);
        sb.append(", subtitleRid=").append(subtitleRid);
        sb.append(", subtitleStatus=").append(subtitleStatus);
        sb.append(", subtitleLang=").append(subtitleLang);
        sb.append(", subtitleError=").append(subtitleError);
        sb.append(", createdAt=").append(createdAt);
        sb.append(", serialVersionUID=").append(serialVersionUID);
        sb.append("]");
        return sb.toString();
    }
}
