import { useEffect, useRef, useState } from "react";
import styles from "./video.module.scss";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { course as Course } from "../../api/index";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { message } from "antd";
import { getPlayId, savePlayId } from "../../utils";

declare const window: any;
var timer: any = null;

type SubtitleStyleModel = {
  bottom: string;
  color: string;
  fontSize: string;
};

const subtitleStyleStorageKey = "playedu:pc:subtitle-style";
const defaultSubtitleStyle: SubtitleStyleModel = {
  fontSize: "16px",
  bottom: "8%",
  color: "#ffffff",
};

const subtitleFontSizeOptions = ["14px", "16px", "18px", "20px"];
const subtitleBottomOptions = [
  { label: "低", value: "8%" },
  { label: "中", value: "12%" },
  { label: "高", value: "16%" },
];
const subtitleColorOptions = ["#ffffff", "#ffd966", "#7ee787", "#8ab4f8"];

const loadSubtitleStyle = (): SubtitleStyleModel => {
  if (typeof window === "undefined") {
    return defaultSubtitleStyle;
  }

  try {
    const saved = window.localStorage.getItem(subtitleStyleStorageKey);
    if (!saved) {
      return defaultSubtitleStyle;
    }
    return { ...defaultSubtitleStyle, ...JSON.parse(saved) };
  } catch (error) {
    return defaultSubtitleStyle;
  }
};

const applySubtitleStyle = (player: any, style: SubtitleStyleModel) => {
  const subtitleEl = player?.container?.querySelector(
    ".dplayer-subtitle"
  ) as HTMLElement | null;
  if (!subtitleEl) {
    return;
  }

  subtitleEl.style.fontSize = style.fontSize;
  subtitleEl.style.bottom = style.bottom;
  subtitleEl.style.color = style.color;
};

const installNativeSubtitleTrack = (
  player: any,
  subtitleUrl: string,
  styleRef: React.MutableRefObject<SubtitleStyleModel>
) => {
  const videoEl = player?.video as HTMLVideoElement | undefined;
  if (!videoEl || !subtitleUrl) {
    return;
  }

  const existingTrack = videoEl.querySelector(
    'track[data-playedu-subtitle="1"]'
  );
  if (existingTrack) {
    existingTrack.remove();
  }

  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = "中文字幕";
  track.srclang = "zh";
  track.src = subtitleUrl;
  track.default = false;
  track.setAttribute("data-playedu-subtitle", "1");
  videoEl.appendChild(track);

  const syncSubtitleMode = () => {
    const subtitleEl = player?.container?.querySelector(
      ".dplayer-subtitle"
    ) as HTMLElement | null;
    const isPiP =
      typeof document !== "undefined" &&
      "pictureInPictureElement" in document &&
      (document as any).pictureInPictureElement === videoEl;

    if (track.track) {
      track.track.mode = isPiP ? "showing" : "disabled";
    }

    if (subtitleEl) {
      subtitleEl.style.opacity = isPiP ? "0" : "1";
      if (!isPiP) {
        applySubtitleStyle(player, styleRef.current);
      }
    }
  };

  track.addEventListener("load", syncSubtitleMode);
  videoEl.addEventListener("enterpictureinpicture", syncSubtitleMode);
  videoEl.addEventListener("leavepictureinpicture", syncSubtitleMode);
  syncSubtitleMode();
};

const CoursePalyPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const systemConfig = useSelector((state: any) => state.systemConfig.value);
  const user = useSelector((state: any) => state.loginUser.value.user);
  const [playUrl, setPlayUrl] = useState("");
  const [playDuration, setPlayDuration] = useState(0);
  const [playendedStatus, setPlayendedStatus] = useState(false);
  const [lastSeeValue, setLastSeeValue] = useState({});
  const [course, setCourse] = useState<CourseModel | null>(null);
  const [hour, setHour] = useState<HourModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [isLastpage, setIsLastpage] = useState(false);
  const [totalHours, setTotalHours] = useState<HourModel[]>([]);
  const [playingTime, setPlayingTime] = useState(0);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [resourceUrl, setResourceUrl] = useState<ResourceUrlModel>({});
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [subtitleStyle, setSubtitleStyle] =
    useState<SubtitleStyleModel>(loadSubtitleStyle);
  const [subtitlePanelVisible, setSubtitlePanelVisible] = useState(false);
  const myRef = useRef(0);
  const playRef = useRef(0);
  const watchRef = useRef(0);
  const totalRef = useRef(0);
  const subtitleStyleRef = useRef<SubtitleStyleModel>(loadSubtitleStyle());
  const [checkPlayerStatus, setCheckPlayerStatus] = useState(false);

  useEffect(() => {
    timer && clearInterval(timer);
    getCourse();
    getDetail();
    return () => {
      timer && clearInterval(timer);
    };
  }, [params.courseId, params.hourId]);

  useEffect(() => {
    myRef.current = playDuration;
  }, [playDuration]);

  useEffect(() => {
    playRef.current = playingTime;
  }, [playingTime]);

  useEffect(() => {
    watchRef.current = watchedSeconds;
  }, [watchedSeconds]);

  useEffect(() => {
    totalRef.current = hour?.duration || 0;
  }, [hour]);

  useEffect(() => {
    subtitleStyleRef.current = subtitleStyle;
    window.localStorage.setItem(
      subtitleStyleStorageKey,
      JSON.stringify(subtitleStyle)
    );
    if (window.player) {
      applySubtitleStyle(window.player, subtitleStyle);
    }
  }, [subtitleStyle]);

  const getCourse = () => {
    Course.detail(Number(params.courseId)).then((res: any) => {
      let totalHours: HourModel[] = [];
      if (res.data.chapters.length === 0) {
        setTotalHours(res.data.hours[0]);
        totalHours = res.data.hours[0];
      } else if (res.data.chapters.length > 0) {
        const arr: HourModel[] = [];
        for (let key in res.data.hours) {
          res.data.hours[key].map((item: any) => {
            arr.push(item);
          });
        }
        setTotalHours(arr);
        totalHours = arr;
      }
      const index = totalHours.findIndex(
        (i: any) => i.id === Number(params.hourId)
      );
      if (index === totalHours.length - 1) {
        setIsLastpage(true);
      }
    });
  };

  const getDetail = () => {
    if (loading) {
      return true;
    }
    setLoading(true);
    Course.play(Number(params.courseId), Number(params.hourId))
      .then((res: any) => {
        setCourse(res.data.course);
        setHour(res.data.hour);
        document.title = res.data.hour.title;
        let record: HourRecordModel = res.data.user_hour_record;
        let params = null;
        if (record && record.finished_duration && record.is_finished === 0) {
          params = {
            time: 5,
            pos: record.finished_duration,
          };
          setLastSeeValue(params);
          setLastSeeValue(params);
          setWatchedSeconds(record.finished_duration);
        } else if (record && record.is_finished === 1) {
          setWatchedSeconds(res.data.hour.duration);
        }
        getVideoUrl(res.data.hour.rid, params);
        setLoading(false);
      })
      .catch((e) => {
        setLoading(false);
      });
  };

  const getVideoUrl = (rid: number, data: any) => {
    Course.playUrl(Number(params.courseId), Number(params.hourId)).then(
      (res: any) => {
        setResourceUrl(res.data.resource_url[rid]);
        setPlayUrl(res.data.resource_url[rid]);
        setSubtitleUrl(res.data.subtitle_url || "");
        initDPlayer(res.data.resource_url[rid], 0, data, res.data.subtitle_url);
        savePlayId(String(params.courseId) + "-" + String(params.hourId));
      }
    );
  };

  const initDPlayer = (
    playUrl: string,
    isTrySee: number,
    params: any,
    subtitleUrl?: string
  ) => {
    let banDrag =
      systemConfig.playerIsDisabledDrag &&
      watchRef.current < totalRef.current &&
      watchRef.current === 0;
    const options: any = {
      container: document.getElementById("meedu-player-container"),
      autoplay: false,
      video: {
        url: playUrl,
        pic: systemConfig.playerPoster,
      },
      try: isTrySee === 1,
      bulletSecret: {
        enabled: systemConfig.playerIsEnabledBulletSecret,
        text: systemConfig.playerBulletSecretText
          .replace("{name}", user.name)
          .replace("{email}", user.email)
          .replace("{idCard}", user.id_card),
        size: "14px",
        color: systemConfig.playerBulletSecretColor || "red",
        opacity: Number(systemConfig.playerBulletSecretOpacity),
      },
      ban_drag: banDrag,
      last_see_pos: params,
    };
    if (subtitleUrl) {
      options.subtitle = {
        url: subtitleUrl,
        type: "webvtt",
        fontSize: subtitleStyleRef.current.fontSize,
        bottom: subtitleStyleRef.current.bottom,
        color: subtitleStyleRef.current.color,
      };
    }
    window.player = new window.DPlayer(options);
    if (subtitleUrl) {
      applySubtitleStyle(window.player, subtitleStyleRef.current);
      installNativeSubtitleTrack(
        window.player,
        subtitleUrl,
        subtitleStyleRef
      );
    }
    // 监听播放进度更新evt
    window.player.on("timeupdate", () => {
      let currentTime = parseInt(window.player.video.currentTime);
      if (
        systemConfig.playerIsDisabledDrag &&
        watchRef.current < totalRef.current &&
        currentTime - playRef.current >= 2 &&
        currentTime > watchRef.current
      ) {
        message.warning("首次学习禁止快进");
        window.player.seek(watchRef.current);
      } else {
        setPlayingTime(currentTime);
        playTimeUpdate(parseInt(window.player.video.currentTime), false);
      }
    });
    window.player.on("ended", () => {
      if (
        systemConfig.playerIsDisabledDrag &&
        watchRef.current < totalRef.current &&
        window.player.video.duration - playRef.current >= 2
      ) {
        window.player.seek(playRef.current);
        return;
      }
      setPlayingTime(0);
      setPlayendedStatus(true);
      playTimeUpdate(parseInt(window.player.video.currentTime), true);
      exitFullscreen();
      window.player && window.player.destroy();
    });
    setLoading(false);
    checkPlayer();
  };

  const playTimeUpdate = (duration: number, isEnd: boolean) => {
    if (duration - myRef.current >= 10 || isEnd === true) {
      setPlayDuration(duration);
      Course.record(
        Number(params.courseId),
        Number(params.hourId),
        duration
      ).then((res: any) => {});
      Course.playPing(Number(params.courseId), Number(params.hourId)).then(
        (res: any) => {}
      );
    }
  };

  const checkPlayer = () => {
    timer = setInterval(() => {
      let playId = getPlayId();
      if (
        playId &&
        playId !== String(params.courseId) + "-" + String(params.hourId)
      ) {
        timer && clearInterval(timer);
        window.player && window.player.destroy();
        setCheckPlayerStatus(true);
      } else {
        setCheckPlayerStatus(false);
      }
    }, 5000);
  };

  const goNextVideo = () => {
    const index = totalHours.findIndex(
      (i: any) => i.id === Number(params.hourId)
    );
    if (index === totalHours.length - 1) {
      setIsLastpage(true);
      message.error("已经是最后一节了！");
    } else if (index < totalHours.length - 1) {
      navigate(`/course/${params.courseId}/hour/${totalHours[index + 1].id}`, {
        replace: true,
      });
    }
  };

  const exitFullscreen = () => {
    let de: any;
    de = document;
    if (de.fullscreenElement !== null) {
      de.exitFullscreen();
    } else if (de.mozCancelFullScreen) {
      de.mozCancelFullScreen();
    } else if (de.webkitCancelFullScreen) {
      de.webkitCancelFullScreen();
    }
  };

  const updateSubtitleStyle = (patch: Partial<SubtitleStyleModel>) => {
    setSubtitleStyle((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  return (
    <div className={styles["video-mask"]}>
      <div className={styles["top-cont"]}>
        <div className={styles["box"]}>
          <div
            className={styles["close-btn"]}
            onClick={() => {
              timer && clearInterval(timer);
              window.player && window.player.destroy();
              navigate(-1);
            }}
          >
            <ArrowLeftOutlined />
            <span className="ml-14">返回</span>
          </div>
        </div>
      </div>
      <div className={styles["video-body"]}>
        <div className={styles["video-title"]}>{hour?.title}</div>
        <div className={styles["video-box"]}>
          {subtitleUrl && (
            <div className={styles["subtitle-tools"]}>
              <button
                className={styles["subtitle-toggle"]}
                onClick={() => setSubtitlePanelVisible(!subtitlePanelVisible)}
              >
                字幕设置
              </button>
              {subtitlePanelVisible && (
                <div className={styles["subtitle-panel"]}>
                  <div className={styles["subtitle-row"]}>
                    <span>字号</span>
                    <div className={styles["subtitle-options"]}>
                      {subtitleFontSizeOptions.map((item) => (
                        <button
                          key={item}
                          className={
                            subtitleStyle.fontSize === item
                              ? styles["subtitle-option-active"]
                              : ""
                          }
                          onClick={() => updateSubtitleStyle({ fontSize: item })}
                        >
                          {item.replace("px", "")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles["subtitle-row"]}>
                    <span>位置</span>
                    <div className={styles["subtitle-options"]}>
                      {subtitleBottomOptions.map((item) => (
                        <button
                          key={item.value}
                          className={
                            subtitleStyle.bottom === item.value
                              ? styles["subtitle-option-active"]
                              : ""
                          }
                          onClick={() =>
                            updateSubtitleStyle({ bottom: item.value })
                          }
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles["subtitle-row"]}>
                    <span>颜色</span>
                    <div className={styles["subtitle-colors"]}>
                      {subtitleColorOptions.map((item) => (
                        <button
                          key={item}
                          className={
                            subtitleStyle.color === item
                              ? styles["subtitle-color-active"]
                              : ""
                          }
                          style={{ backgroundColor: item }}
                          onClick={() => updateSubtitleStyle({ color: item })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <div
            className="play-box"
            id="meedu-player-container"
            style={{ borderRadius: 8 }}
          ></div>
          {checkPlayerStatus && (
            <div className={styles["alert-message"]}>
              <div className={styles["des-video"]}>
                您已打开新视频，暂停本视频播放
              </div>
            </div>
          )}
          {playendedStatus && (
            <div className={styles["alert-message"]}>
              {isLastpage && (
                <div
                  className={styles["alert-button"]}
                  onClick={() => navigate(`/course/${params.courseId}`)}
                >
                  恭喜你学完最后一节
                </div>
              )}
              {!isLastpage && (
                <div
                  className={styles["alert-button"]}
                  onClick={() => {
                    window.player && window.player.destroy();
                    setLastSeeValue({});
                    setPlayendedStatus(false);
                    goNextVideo();
                  }}
                >
                  播放下一节
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoursePalyPage;
