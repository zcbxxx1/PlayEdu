import { useEffect, useState } from "react";
import {
  Modal,
  Table,
  message,
  Space,
  Dropdown,
  Typography,
  Input,
  Button,
  Tag,
  Tooltip,
  Spin,
  Select,
  Progress,
} from "antd";
import type { MenuProps } from "antd";
import { resource, subtitleTask } from "../../../api";
import { useLocation } from "react-router-dom";
import {
  DownOutlined,
  ExclamationCircleFilled,
  DownloadOutlined,
  EyeOutlined,
  VerticalAlignTopOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { dateFormat } from "../../../utils/index";
import { TreeCategory, DurationText } from "../../../compenents";
import { UploadVideoButton } from "../../../compenents/upload-video-button";
import { VideoPlayDialog } from "./compenents/video-play-dialog";
import { VideosUpdateDialog } from "./compenents/update-dialog";

const { confirm } = Modal;

interface DataType {
  id: React.Key;
  admin_id: number;
  created_at: string;
  disk: string;
  extension: string;
  file_id: string;
  name: string;
  parent_id: number;
  path: string;
  size: number;
  type: string;
  url: string;
}

type VideosExtraModel = {
  [key: number]: VideoModel;
};

type VideoModel = {
  duration: number;
  poster: string;
  rid: number;
  subtitle_error?: string;
  subtitle_lang?: string;
  subtitle_rid?: number;
  subtitle_status?: string;
};

type AdminUsersModel = {
  [key: number]: string;
};

type SubtitleTaskModel = {
  id: number;
  resource_id: number;
  admin_id: number;
  status: string;
  attempts: number;
  max_attempts: number;
  provider: string;
  language: string;
  trigger_source: string;
  error_message?: string;
  duration_seconds: number;
  started_at?: string;
  finished_at?: string;
  next_run_at?: string;
  created_at: string;
  updated_at?: string;
};

type SubtitleTaskResourceMap = {
  [key: number]: DataType;
};

type SubtitleTaskResourceExtraMap = {
  [key: number]: VideoModel;
};

const ResourceVideosPage = () => {
  const result = new URLSearchParams(useLocation().search);
  const [videoList, setVideoList] = useState<DataType[]>([]);
  const [videosExtra, setVideoExtra] = useState<VideosExtraModel>({});
  const [adminUsers, setAdminUsers] = useState<AdminUsersModel>({});
  const [resourceUrl, setResourceUrl] = useState<ResourceUrlModel>({});
  const [refresh, setRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [category_ids, setCategoryIds] = useState<number[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<any>([]);
  const [selLabel, setLabel] = useState<string>(
    result.get("label") ? String(result.get("label")) : "全部视频"
  );
  const [cateId, setCateId] = useState(Number(result.get("cid")));
  const [updateVisible, setUpdateVisible] = useState(false);
  const [playVisible, setPlayeVisible] = useState(false);
  const [multiConfig, setMultiConfig] = useState(false);
  const [updateId, setUpdateId] = useState(0);
  const [playUrl, setPlayUrl] = useState("");
  const [title, setTitle] = useState("");
  const [subtitlePreviewVisible, setSubtitlePreviewVisible] = useState(false);
  const [subtitlePreviewTitle, setSubtitlePreviewTitle] = useState("");
  const [subtitlePreviewContent, setSubtitlePreviewContent] = useState("");
  const [subtitlePreviewLoading, setSubtitlePreviewLoading] = useState(false);
  const [subtitleTaskVisible, setSubtitleTaskVisible] = useState(false);
  const [subtitleTaskLoading, setSubtitleTaskLoading] = useState(false);
  const [subtitleTaskPage, setSubtitleTaskPage] = useState(1);
  const [subtitleTaskSize, setSubtitleTaskSize] = useState(10);
  const [subtitleTaskTotal, setSubtitleTaskTotal] = useState(0);
  const [subtitleTaskStatus, setSubtitleTaskStatus] = useState("");
  const [subtitleTaskList, setSubtitleTaskList] = useState<SubtitleTaskModel[]>(
    []
  );
  const [subtitleTaskResources, setSubtitleTaskResources] =
    useState<SubtitleTaskResourceMap>({});
  const [subtitleTaskResourceExtras, setSubtitleTaskResourceExtras] =
    useState<SubtitleTaskResourceExtraMap>({});
  const [subtitleTaskAdminUsers, setSubtitleTaskAdminUsers] =
    useState<AdminUsersModel>({});

  const subtitleStatusTextMap: Record<string, string> = {
    NONE: "未生成",
    PENDING: "排队中",
    PROCESSING: "生成中",
    SUCCESS: "已生成",
    FAILED: "失败",
    CANCELED: "已取消",
  };

  const subtitleStatusColorMap: Record<string, string> = {
    NONE: "default",
    PENDING: "default",
    PROCESSING: "processing",
    SUCCESS: "success",
    FAILED: "error",
    CANCELED: "default",
  };

  const subtitleTaskStatusTextMap: Record<string, string> = {
    PENDING: "排队中",
    PROCESSING: "处理中",
    SUCCESS: "已完成",
    FAILED: "失败",
    CANCELED: "已取消",
  };

  const subtitleTaskStatusColorMap: Record<string, string> = {
    PENDING: "default",
    PROCESSING: "processing",
    SUCCESS: "success",
    FAILED: "error",
    CANCELED: "default",
  };

  useEffect(() => {
    setCateId(Number(result.get("cid")));
    if (Number(result.get("cid"))) {
      let arr = [];
      arr.push(Number(result.get("cid")));
      setCategoryIds(arr);
    }
  }, [result.get("cid")]);

  const columns: ColumnsType<DataType> = [
    {
      title: "视频名称",
      dataIndex: "name",
      render: (text: string) => (
        <div className="d-flex">
          <i
            className="iconfont icon-icon-video"
            style={{
              fontSize: 16,
              color: "rgba(0,0,0,0.3)",
            }}
          />
          <span className="ml-8">{text}</span>
        </div>
      ),
    },
    {
      title: "视频时长",
      dataIndex: "id",
      render: (id: number) => (
        <DurationText duration={videosExtra[id]?.duration || 0}></DurationText>
      ),
    },
    {
      title: "字幕状态",
      dataIndex: "id",
      width: 120,
      render: (id: number) => {
        const status = videosExtra[id]?.subtitle_status || "NONE";
        return (
          <Tag color={subtitleStatusColorMap[status] || "default"}>
            {subtitleStatusTextMap[status] || status}
          </Tag>
        );
      },
    },
    {
      title: "失败原因",
      dataIndex: "id",
      width: 260,
      render: (id: number) => {
        const reason = videosExtra[id]?.subtitle_error;
        if (!reason) {
          return <span className="c-9">-</span>;
        }

        return (
          <Tooltip title={reason}>
            <Typography.Text
              type="danger"
              ellipsis={{ tooltip: false }}
              style={{ maxWidth: 220, display: "inline-block" }}
            >
              {reason}
            </Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: "创建人",
      dataIndex: "admin_id",
      render: (admin_id: number) =>
        JSON.stringify(adminUsers) !== "{}" && (
          <span>{adminUsers[admin_id]}</span>
        ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      render: (created_at: string) => <span>{dateFormat(created_at)}</span>,
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      width: 160,
      render: (_, record: any) => {
        const items: MenuProps["items"] = [
          {
            key: "1",
            label: (
              <Button
                type="link"
                className="b-link c-red"
                onClick={() => {
                  setUpdateId(record.id);
                  setUpdateVisible(true);
                }}
              >
                编辑
              </Button>
            ),
          },
          {
            key: "2",
            label: (
              <Button
                type="link"
                className="b-link c-red"
                disabled={videosExtra[record.id]?.subtitle_status === "PROCESSING"}
                onClick={() => regenerateSubtitle(record.id)}
              >
                重生成字幕
              </Button>
            ),
          },
          {
            key: "3",
            label: (
              <Button
                type="link"
                className="b-link c-red"
                icon={<EyeOutlined />}
                disabled={!videosExtra[record.id]?.subtitle_rid}
                onClick={() => previewSubtitle(record)}
              >
                预览字幕
              </Button>
            ),
          },
          {
            key: "4",
            label: (
              <Button
                type="link"
                className="b-link c-red"
                icon={<DownloadOutlined />}
                disabled={!videosExtra[record.id]?.subtitle_rid}
                onClick={() => downloadSubtitle(record)}
              >
                下载字幕
              </Button>
            ),
          },
          {
            key: "5",
            label: (
              <Button
                type="link"
                className="b-link c-red"
                onClick={() => removeResource(record.id)}
              >
                删除
              </Button>
            ),
          },
        ];

        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              className="b-n-link c-red"
              onClick={() => {
                setUpdateId(record.id);
                setPlayUrl(resourceUrl[record.id]);
                setPlayeVisible(true);
              }}
            >
              预览
            </Button>
            <div className="form-column"></div>
            <Dropdown menu={{ items }}>
              <Button
                type="link"
                className="b-link c-red"
                onClick={(e) => e.preventDefault()}
              >
                <Space size="small" align="center">
                  更多
                  <DownOutlined />
                </Space>
              </Button>
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  // 删除图片
  const removeResource = (id: number) => {
    if (id === 0) {
      return;
    }
    confirm({
      title: "操作确认",
      icon: <ExclamationCircleFilled />,
      content: "删除前请检查选中视频文件无关联课程，确认删除？",
      centered: true,
      okText: "确认",
      cancelText: "取消",
      onOk() {
        resource.destroyResource(id).then(() => {
          message.success("删除成功");
          resetVideoList();
        });
      },
      onCancel() {
        console.log("Cancel");
      },
    });
  };

  const removeResourceMulti = () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    confirm({
      title: "操作确认",
      icon: <ExclamationCircleFilled />,
      content: "删除前请检查选中视频文件无关联课程，确认删除？",
      centered: true,
      okText: "确认",
      cancelText: "取消",
      onOk() {
        resource.destroyResourceMulti(selectedRowKeys).then(() => {
          message.success("删除成功");
          resetVideoList();
        });
      },
      onCancel() {
        console.log("Cancel");
      },
    });
  };

  const regenerateSubtitle = (id: number) => {
    resource.generateSubtitle(id).then((res: any) => {
      message.success(res.msg || "字幕生成任务已提交");
      setVideoExtra((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] || { duration: 0, poster: "", rid: id }),
          subtitle_error: "",
          subtitle_status: "PENDING",
        },
      }));
      pollSubtitleStatus(id);
    });
  };

  const regenerateSubtitleMulti = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请选择需要生成字幕的视频");
      return;
    }
    resource.generateSubtitleMulti(selectedRowKeys).then((res: any) => {
      message.success(res.msg || "批量字幕生成任务已提交");
      setVideoExtra((prev) => {
        const next = { ...prev };
        selectedRowKeys.forEach((id: number) => {
          next[id] = {
            ...(next[id] || { duration: 0, poster: "", rid: id }),
            subtitle_error: "",
            subtitle_status: "PENDING",
          };
        });
        return next;
      });
      selectedRowKeys.forEach((id: number) => pollSubtitleStatus(Number(id)));
      setSubtitleTaskPage(1);
      setSubtitleTaskVisible(true);
    });
  };

  const getSubtitleDetail = (record: DataType) => {
    const subtitleRid = videosExtra[Number(record.id)]?.subtitle_rid;
    if (!subtitleRid) {
      message.warning("当前视频暂无字幕文件");
      return Promise.reject(new Error("subtitle not found"));
    }
    return resource.videoDetail(subtitleRid).then((res: any) => {
      const subtitle = res.data.resources;
      const subtitleUrl = res.data.resource_url?.[subtitleRid];
      if (!subtitleUrl) {
        throw new Error("subtitle url not found");
      }
      return { subtitle, subtitleUrl };
    });
  };

  const previewSubtitle = (record: DataType) => {
    setSubtitlePreviewTitle(`${record.name} 字幕预览`);
    setSubtitlePreviewContent("");
    setSubtitlePreviewVisible(true);
    setSubtitlePreviewLoading(true);
    getSubtitleDetail(record)
      .then(({ subtitleUrl }) => fetch(subtitleUrl))
      .then((resp) => resp.text())
      .then((content) => {
        setSubtitlePreviewContent(content);
      })
      .catch(() => {
        message.error("字幕预览加载失败");
        setSubtitlePreviewVisible(false);
      })
      .finally(() => {
        setSubtitlePreviewLoading(false);
      });
  };

  const downloadSubtitle = (record: DataType) => {
    getSubtitleDetail(record)
      .then(({ subtitle, subtitleUrl }) => {
        downLoadFile(subtitleUrl, subtitle.name, subtitle.extension);
      })
      .catch(() => {
        message.error("字幕下载失败");
      });
  };

  const downLoadFile = (url: string, name: string, extension: string) => {
    window.open(url);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = `${name}.${extension}`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const formatSeconds = (durationSeconds?: number) => {
    const seconds = Number(durationSeconds || 0);
    if (seconds <= 0) {
      return "-";
    }
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainSeconds = seconds % 60;
    return `${minutes}m ${remainSeconds}s`;
  };

  const getSubtitleTaskList = (showLoading = true) => {
    if (showLoading) {
      setSubtitleTaskLoading(true);
    }
    return subtitleTask
      .taskList(subtitleTaskPage, subtitleTaskSize, subtitleTaskStatus)
      .then((res: any) => {
        setSubtitleTaskList(res.data.data || []);
        setSubtitleTaskTotal(res.data.total || 0);
        setSubtitleTaskResources(res.data.resources || {});
        setSubtitleTaskResourceExtras(res.data.resource_extras || {});
        setSubtitleTaskAdminUsers(res.data.admin_users || {});
        setSubtitleTaskLoading(false);
        return res.data;
      })
      .catch((e: any) => {
        setSubtitleTaskLoading(false);
        throw e;
      });
  };

  const handleSubtitleTaskCancel = (task: SubtitleTaskModel) => {
    subtitleTask.cancelTask(task.id).then((res: any) => {
      message.success(res.msg || "字幕任务已取消");
      getSubtitleTaskList(false);
      getVideoList(false);
    });
  };

  const handleSubtitleTaskMove = (
    task: SubtitleTaskModel,
    direction: "TOP" | "UP" | "DOWN"
  ) => {
    subtitleTask.moveTask(task.id, direction).then((res: any) => {
      message.success(res.msg || "字幕任务顺序已更新");
      getSubtitleTaskList(false);
    });
  };

  useEffect(() => {
    if (!subtitleTaskVisible) {
      return;
    }
    getSubtitleTaskList();
  }, [subtitleTaskVisible, subtitleTaskPage, subtitleTaskSize, subtitleTaskStatus]);

  useEffect(() => {
    if (!subtitleTaskVisible) {
      return;
    }

    const hasActiveTask = subtitleTaskList.some((item) =>
      ["PENDING", "PROCESSING"].includes(item.status)
    );
    if (!hasActiveTask) {
      return;
    }

    const timer = window.setTimeout(() => {
      getSubtitleTaskList(false);
    }, 3000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [subtitleTaskVisible, subtitleTaskList]);

  const getSubtitleTaskProgress = (task: SubtitleTaskModel) => {
    if (task.status === "SUCCESS") {
      return 100;
    }
    if (task.status === "FAILED") {
      return 100;
    }
    if (task.status === "CANCELED") {
      return 100;
    }
    if (task.status === "PENDING") {
      return 5;
    }

    const duration =
      Number(subtitleTaskResourceExtras[task.resource_id]?.duration || 0) || 0;
    const startedAt = task.started_at ? new Date(task.started_at).getTime() : 0;
    if (!startedAt) {
      return 12;
    }

    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 1000)
    );
    const estimatedTotalSeconds = Math.max(
      90,
      Math.round(duration * 0.3 + 30)
    );
    const progress = Math.round((elapsedSeconds / estimatedTotalSeconds) * 100);

    return Math.max(12, Math.min(95, progress));
  };

  const subtitleTaskColumns: ColumnsType<SubtitleTaskModel> = [
    {
      title: "任务ID",
      dataIndex: "id",
      width: 72,
    },
    {
      title: "视频",
      dataIndex: "resource_id",
      width: 280,
      render: (resourceId: number) => {
        const name = subtitleTaskResources[resourceId]?.name || `资源#${resourceId}`;
        return (
          <Tooltip title={name}>
            <Typography.Text
              ellipsis={{ tooltip: false }}
              style={{ maxWidth: 240, display: "inline-block" }}
            >
              {name}
            </Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: "视频时长",
      dataIndex: "resource_id",
      width: 110,
      render: (resourceId: number) => (
        <DurationText
          duration={subtitleTaskResourceExtras[resourceId]?.duration || 0}
        ></DurationText>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (status: string) => (
        <Tag color={subtitleTaskStatusColorMap[status] || "default"}>
          {subtitleTaskStatusTextMap[status] || status}
        </Tag>
      ),
    },
    {
      title: "进度",
      key: "progress",
      width: 180,
      render: (_, record) => {
        const percent = getSubtitleTaskProgress(record);
        const status =
          record.status === "FAILED" || record.status === "CANCELED"
            ? "exception"
            : record.status === "SUCCESS"
            ? "success"
            : "active";
        return (
          <div style={{ minWidth: 140 }}>
            <Progress
              percent={percent}
              size="small"
              status={status}
              format={(value) => `${value || 0}%`}
            />
          </div>
        );
      },
    },
    {
      title: "提交人",
      dataIndex: "admin_id",
      width: 210,
      render: (adminId: number) => {
        const adminName = subtitleTaskAdminUsers[adminId] || `#${adminId}`;
        return (
          <Tooltip title={adminName}>
            <Typography.Text
              ellipsis={{ tooltip: false }}
              style={{ maxWidth: 180, display: "inline-block" }}
            >
              {adminName}
            </Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: "重试",
      key: "attempts",
      width: 84,
      render: (_, record) => `${record.attempts}/${record.max_attempts}`,
    },
    {
      title: "耗时",
      dataIndex: "duration_seconds",
      width: 84,
      render: (durationSeconds: number) => formatSeconds(durationSeconds),
    },
    {
      title: "开始时间",
      dataIndex: "started_at",
      width: 180,
      render: (value?: string) => (value ? dateFormat(value) : "-"),
    },
    {
      title: "完成时间",
      dataIndex: "finished_at",
      width: 180,
      render: (value?: string) => (value ? dateFormat(value) : "-"),
    },
    {
      title: "失败原因",
      dataIndex: "error_message",
      width: 220,
      render: (value?: string) => {
        if (!value) {
          return <span className="c-9">-</span>;
        }
        return (
          <Tooltip title={value}>
            <Typography.Text
              type="danger"
              ellipsis={{ tooltip: false }}
              style={{ maxWidth: 180, display: "inline-block" }}
            >
              {value}
            </Typography.Text>
          </Tooltip>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 210,
      render: (_, record) => {
        const canMove = record.status === "PENDING";
        const canCancel = record.status === "PENDING";
        return (
          <Space size="small" wrap>
            <Button
              type="link"
              className="b-link c-red"
              icon={<VerticalAlignTopOutlined />}
              disabled={!canMove}
              onClick={() => handleSubtitleTaskMove(record, "TOP")}
            >
              置顶
            </Button>
            <Button
              type="link"
              className="b-link c-red"
              icon={<ArrowUpOutlined />}
              disabled={!canMove}
              onClick={() => handleSubtitleTaskMove(record, "UP")}
            >
              上移
            </Button>
            <Button
              type="link"
              className="b-link c-red"
              icon={<ArrowDownOutlined />}
              disabled={!canMove}
              onClick={() => handleSubtitleTaskMove(record, "DOWN")}
            >
              下移
            </Button>
            <Button
              type="link"
              className="b-link c-red"
              icon={<StopOutlined />}
              disabled={!canCancel}
              onClick={() => handleSubtitleTaskCancel(record)}
            >
              取消
            </Button>
          </Space>
        );
      },
    },
  ];

  // 获取视频列表
  const getVideoList = (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    let categoryIds = category_ids.join(",");
    return resource
      .resourceList(page, size, "", "", title, "VIDEO", categoryIds)
      .then((res: any) => {
        setTotal(res.data.result.total);
        setVideoList(res.data.result.data);
        setVideoExtra(res.data.videos_extra);
        setAdminUsers(res.data.admin_users);
        setResourceUrl(res.data.resource_url);
        setLoading(false);
        return res.data;
      })
      .catch((err: any) => {
        setLoading(false);
        console.log("错误,", err);
        throw err;
      });
  };

  const pollSubtitleStatus = (id: number, attempts = 30) => {
    setTimeout(() => {
      getVideoList(false)
        .then((data: any) => {
          const extra = data?.videos_extra?.[id];
          if (
            ["PENDING", "PROCESSING"].includes(extra?.subtitle_status) &&
            attempts > 1
          ) {
            pollSubtitleStatus(id, attempts - 1);
          }
        })
        .catch(() => {
          if (attempts > 1) {
            pollSubtitleStatus(id, attempts - 1);
          }
        });
    }, 2000);
  };

  // 重置列表
  const resetVideoList = () => {
    setPage(1);
    setSize(10);
    setVideoList([]);
    setSelectedRowKeys([]);
    setTitle("");
    setRefresh(!refresh);
  };

  // 加载视频列表
  useEffect(() => {
    getVideoList();
  }, [category_ids, refresh, page, size]);

  const paginationProps = {
    current: page, //当前页码
    pageSize: size,
    total: total, // 总条数
    onChange: (page: number, pageSize: number) =>
      handlePageChange(page, pageSize), //改变页码的函数
    showSizeChanger: true,
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPage(page);
    setSize(pageSize);
  };

  const rowSelection = {
    onChange: (selectedRowKeys: React.Key[], selectedRows: DataType[]) => {
      setSelectedRowKeys(selectedRowKeys);
    },
  };

  return (
    <>
      <div className="tree-main-body">
        <div className="left-box">
          <TreeCategory
            selected={category_ids}
            type="no-cate"
            text={"视频"}
            onUpdate={(keys: any, title: any) => {
              setPage(1);
              setCategoryIds(keys);
              if (typeof title === "string") {
                setLabel(title);
              } else {
                setLabel(title.props.children[0]);
              }
            }}
          />
        </div>
        <div className="right-box">
          <div className="d-flex playedu-main-title float-left mb-24">
            视频 | {selLabel}
          </div>
          <div className="float-left  j-b-flex  mb-24">
            <div>
              <UploadVideoButton
                categoryIds={category_ids}
                onUpdate={() => {
                  resetVideoList();
                }}
              ></UploadVideoButton>
              <Button
                type="default"
                className="ml-16"
                onClick={() => {
                  setSelectedRowKeys([]);
                  setMultiConfig(!multiConfig);
                }}
              >
                {multiConfig ? "取消操作" : "批量操作"}
              </Button>
              <Button
                type="default"
                className="ml-16"
                onClick={() => {
                  if (multiConfig) {
                    regenerateSubtitleMulti();
                    return;
                  }
                  setSubtitleTaskPage(1);
                  setSubtitleTaskVisible(true);
                }}
                disabled={multiConfig && selectedRowKeys.length === 0}
              >
                {multiConfig ? "批量生成字幕" : "字幕任务"}
              </Button>
              <Button
                className="ml-16"
                type="default"
                onClick={() => removeResourceMulti()}
                disabled={selectedRowKeys.length === 0}
              >
                删除
              </Button>
            </div>
            <div className="d-flex">
              <div className="d-flex mr-24">
                <Typography.Text>名称：</Typography.Text>
                <Input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                  }}
                  allowClear
                  style={{ width: 160 }}
                  placeholder="请输入名称关键字"
                />
              </div>
              <div className="d-flex">
                <Button className="mr-16" onClick={resetVideoList}>
                  重 置
                </Button>
                <Button
                  type="primary"
                  onClick={() => {
                    setPage(1);
                    setRefresh(!refresh);
                  }}
                >
                  查 询
                </Button>
              </div>
            </div>
          </div>
          <div className="float-left">
            {multiConfig ? (
              <Table
                rowSelection={{
                  type: "checkbox",
                  ...rowSelection,
                }}
                columns={columns}
                dataSource={videoList}
                loading={loading}
                pagination={paginationProps}
                rowKey={(record) => record.id}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={videoList}
                loading={loading}
                pagination={paginationProps}
                rowKey={(record) => record.id}
              />
            )}
          </div>
        </div>
        <VideoPlayDialog
          id={Number(updateId)}
          open={playVisible}
          url={playUrl}
          onCancel={() => setPlayeVisible(false)}
        ></VideoPlayDialog>
        <VideosUpdateDialog
          id={Number(updateId)}
          open={updateVisible}
          onCancel={() => setUpdateVisible(false)}
          onSuccess={() => {
            setUpdateVisible(false);
            setRefresh(!refresh);
          }}
        ></VideosUpdateDialog>
        <Modal
          title={subtitlePreviewTitle}
          open={subtitlePreviewVisible}
          width={860}
          centered
          footer={null}
          onCancel={() => setSubtitlePreviewVisible(false)}
        >
          {subtitlePreviewLoading ? (
            <div className="d-j-flex" style={{ minHeight: 240 }}>
              <Spin />
            </div>
          ) : (
            <Typography.Paragraph
              copyable
              style={{
                maxHeight: 480,
                overflowY: "auto",
                marginBottom: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              {subtitlePreviewContent}
            </Typography.Paragraph>
          )}
        </Modal>
        <Modal
          title="字幕任务"
          open={subtitleTaskVisible}
          width={1640}
          centered
          footer={null}
          onCancel={() => setSubtitleTaskVisible(false)}
        >
          <div className="d-flex j-b-flex mb-16">
            <Select
              style={{ width: 180 }}
              value={subtitleTaskStatus}
              onChange={(value) => {
                setSubtitleTaskPage(1);
                setSubtitleTaskStatus(value);
              }}
              options={[
                { label: "全部状态", value: "" },
                { label: "排队中", value: "PENDING" },
                { label: "处理中", value: "PROCESSING" },
                { label: "已完成", value: "SUCCESS" },
                { label: "失败", value: "FAILED" },
                { label: "已取消", value: "CANCELED" },
              ]}
            />
            <Button onClick={() => getSubtitleTaskList()}>刷新</Button>
          </div>
          <Table
            columns={subtitleTaskColumns}
            dataSource={subtitleTaskList}
            loading={subtitleTaskLoading}
            rowKey={(record) => record.id}
            pagination={{
              current: subtitleTaskPage,
              pageSize: subtitleTaskSize,
              total: subtitleTaskTotal,
              onChange: (page: number, pageSize: number) => {
                setSubtitleTaskPage(page);
                setSubtitleTaskSize(pageSize);
              },
              showSizeChanger: true,
            }}
            scroll={{ x: 1600 }}
          />
        </Modal>
      </div>
    </>
  );
};

export default ResourceVideosPage;
