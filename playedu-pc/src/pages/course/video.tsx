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
  backgroundEnabled: boolean;
  bottomPercent: number;
  color: string;
  enabled: boolean;
  fontSize: number;
};

type NativeSubtitleBinding = {
  destroy: () => void;
  prepareForPiP: () => void;
  sync: () => void;
  trackEl: HTMLTrackElement;
};

const subtitleStyleStorageKey = "playedu:pc:subtitle-style";
const subtitleFontSizeRange = { min: 12, max: 28 };
const subtitleBottomRange = { min: 4, max: 20 };
const subtitleColorOptions = ["#ffffff", "#ffd966", "#7ee787", "#8ab4f8"];
const firefoxCueStyleElementId = "playedu-pc-firefox-cue-style";

const defaultSubtitleStyle: SubtitleStyleModel = {
  enabled: true,
  fontSize: 16,
  bottomPercent: 8,
  color: "#ffffff",
  backgroundEnabled: true,
};

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const normalizeSubtitleStyle = (value: any): SubtitleStyleModel => {
  const legacyFontSize = Number.parseInt(String(value?.fontSize ?? ""), 10);
  const legacyBottom = Number.parseInt(
    String(value?.bottomPercent ?? value?.bottom ?? ""),
    10
  );

  return {
    enabled:
      typeof value?.enabled === "boolean"
        ? value.enabled
        : defaultSubtitleStyle.enabled,
    fontSize: clampNumber(
      Number.isFinite(legacyFontSize)
        ? legacyFontSize
        : defaultSubtitleStyle.fontSize,
      subtitleFontSizeRange.min,
      subtitleFontSizeRange.max
    ),
    bottomPercent: clampNumber(
      Number.isFinite(legacyBottom)
        ? legacyBottom
        : defaultSubtitleStyle.bottomPercent,
      subtitleBottomRange.min,
      subtitleBottomRange.max
    ),
    color: subtitleColorOptions.includes(value?.color)
      ? value.color
      : defaultSubtitleStyle.color,
    backgroundEnabled:
      typeof value?.backgroundEnabled === "boolean"
        ? value.backgroundEnabled
        : defaultSubtitleStyle.backgroundEnabled,
  };
};

const loadSubtitleStyle = (): SubtitleStyleModel => {
  if (typeof window === "undefined") {
    return defaultSubtitleStyle;
  }

  try {
    const saved = window.localStorage.getItem(subtitleStyleStorageKey);
    if (!saved) {
      return defaultSubtitleStyle;
    }
    return normalizeSubtitleStyle(JSON.parse(saved));
  } catch (error) {
    return defaultSubtitleStyle;
  }
};

const isFirefoxBrowser = () =>
  typeof navigator !== "undefined" && /firefox/i.test(navigator.userAgent);

const updateFirefoxCueStyle = (
  videoEl: HTMLVideoElement | null | undefined,
  style: SubtitleStyleModel
) => {
  if (typeof document === "undefined" || !videoEl || !isFirefoxBrowser()) {
    return;
  }

  let styleEl = document.getElementById(
    firefoxCueStyleElementId
  ) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = firefoxCueStyleElementId;
    document.head.appendChild(styleEl);
  }

  videoEl.setAttribute("data-playedu-firefox-native", "1");
  styleEl.textContent = `video[data-playedu-firefox-native="1"]::cue { color: ${style.color}; background-color: ${
    style.backgroundEnabled ? "rgba(0, 0, 0, 0.56)" : "transparent"
  }; font-size: ${style.fontSize}px; }`;
};

const applySubtitleStyle = (
  player: any,
  style: SubtitleStyleModel,
  forceHide = false
) => {
  const subtitleEl = player?.container?.querySelector(
    ".dplayer-subtitle"
  ) as HTMLElement | null;
  if (!subtitleEl) {
    return;
  }

  const visible = style.enabled && !forceHide;
  subtitleEl.style.position = "absolute";
  subtitleEl.style.left = "50%";
  subtitleEl.style.transform = "translateX(-50%)";
  subtitleEl.style.width = "fit-content";
  subtitleEl.style.maxWidth = "calc(100% - 48px)";
  subtitleEl.style.whiteSpace = "pre-wrap";
  subtitleEl.style.wordBreak = "break-word";
  subtitleEl.style.textAlign = "center";
  subtitleEl.style.lineHeight = "1.55";
  subtitleEl.style.pointerEvents = "none";
  subtitleEl.style.display = visible ? "block" : "none";
  subtitleEl.style.opacity = visible ? "1" : "0";
  subtitleEl.style.fontSize = `${style.fontSize}px`;
  subtitleEl.style.bottom = `${style.bottomPercent}%`;
  subtitleEl.style.color = style.color;
  subtitleEl.style.padding = style.backgroundEnabled ? "3px 10px" : "0 4px";
  subtitleEl.style.borderRadius = style.backgroundEnabled ? "8px" : "0";
  subtitleEl.style.background = style.backgroundEnabled
    ? "rgba(0, 0, 0, 0.56)"
    : "transparent";
  subtitleEl.style.boxShadow = style.backgroundEnabled
    ? "0 10px 28px rgba(0, 0, 0, 0.18)"
    : "none";
  subtitleEl.style.textShadow = style.backgroundEnabled
    ? "0 1px 2px rgba(0, 0, 0, 0.5)"
    : "0 1px 3px rgba(0, 0, 0, 0.85), 0 0 12px rgba(0, 0, 0, 0.45)";
};

const syncSubtitleState = (
  player: any,
  trackEl: HTMLTrackElement | null,
  style: SubtitleStyleModel
) => {
  const videoEl = player?.video as HTMLVideoElement | undefined;
  const isPiP =
    typeof document !== "undefined" &&
    "pictureInPictureElement" in document &&
    (document as any).pictureInPictureElement === player?.video;
  const isFirefox = isFirefoxBrowser();

  if (trackEl?.track) {
    trackEl.default = style.enabled;
    trackEl.track.mode = !style.enabled
      ? "disabled"
      : isFirefox || isPiP
      ? "showing"
      : "hidden";
  }

  updateFirefoxCueStyle(videoEl, style);
  applySubtitleStyle(player, style, isPiP || isFirefox);
};

const installNativeSubtitleTrack = (
  player: any,
  subtitleUrl: string,
  styleRef: React.MutableRefObject<SubtitleStyleModel>
): NativeSubtitleBinding | null => {
  const videoEl = player?.video as HTMLVideoElement | undefined;
  if (!videoEl || !subtitleUrl) {
    return null;
  }

  const existingTrack = videoEl.querySelector(
    'track[data-playedu-subtitle="1"]'
  ) as HTMLTrackElement | null;
  if (existingTrack) {
    existingTrack.remove();
  }

  const track = document.createElement("track");
  track.kind = "captions";
  track.label = "中文字幕";
  track.srclang = "zh";
  track.src = subtitleUrl;
  track.default = false;
  track.setAttribute("data-playedu-subtitle", "1");
  videoEl.appendChild(track);

  const sync = () => syncSubtitleState(player, track, styleRef.current);
  const prepareForPiP = () => {
    track.default = styleRef.current.enabled;
    if (track.track) {
      track.track.mode = styleRef.current.enabled ? "showing" : "disabled";
    }
  };
  const onPiPChange = () => sync();
  const rawRequestPiP = videoEl.requestPictureInPicture?.bind(videoEl);

  if (rawRequestPiP) {
    videoEl.requestPictureInPicture = async () => {
      prepareForPiP();
      try {
        return await rawRequestPiP();
      } catch (error) {
        sync();
        throw error;
      }
    };
  }

  track.addEventListener("load", sync);
  videoEl.addEventListener("enterpictureinpicture", onPiPChange);
  videoEl.addEventListener("leavepictureinpicture", onPiPChange);
  sync();

  return {
    prepareForPiP,
    trackEl: track,
    sync,
    destroy: () => {
      track.removeEventListener("load", sync);
      videoEl.removeEventListener("enterpictureinpicture", onPiPChange);
      videoEl.removeEventListener("leavepictureinpicture", onPiPChange);
      if (rawRequestPiP) {
        videoEl.requestPictureInPicture = rawRequestPiP;
      }
      track.remove();
    },
  };
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
  const subtitlePanelRef = useRef<HTMLDivElement | null>(null);
  const subtitleButtonRef = useRef<HTMLElement | null>(null);
  const subtitleTrackBindingRef = useRef<NativeSubtitleBinding | null>(null);
  const subtitleButtonCleanupRef = useRef<(() => void) | null>(null);
  const [checkPlayerStatus, setCheckPlayerStatus] = useState(false);

  const destroyPlayer = () => {
    subtitleButtonCleanupRef.current?.();
    subtitleButtonCleanupRef.current = null;
    subtitleButtonRef.current = null;
    subtitleTrackBindingRef.current?.destroy();
    subtitleTrackBindingRef.current = null;
    if (window.player) {
      window.player.destroy();
      window.player = null;
    }
  };

  const bindSubtitleButton = (player: any) => {
    subtitleButtonCleanupRef.current?.();
    subtitleButtonCleanupRef.current = null;
    subtitleButtonRef.current = null;

    const button = player?.container?.querySelector(
      ".dplayer-subtitle-icon"
    ) as HTMLElement | null;
    if (!button) {
      return;
    }

    subtitleButtonRef.current = button;
    const onClick = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if ("stopImmediatePropagation" in event) {
        event.stopImmediatePropagation();
      }
      setSubtitlePanelVisible((prev) => !prev);
    };
    button.addEventListener("click", onClick, true);
    subtitleButtonCleanupRef.current = () => {
      button.removeEventListener("click", onClick, true);
    };
  };

  useEffect(() => {
    timer && clearInterval(timer);
    setSubtitlePanelVisible(false);
    getCourse();
    getDetail();
    return () => {
      timer && clearInterval(timer);
      destroyPlayer();
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
      subtitleTrackBindingRef.current?.sync();
    }
  }, [subtitleStyle]);

  useEffect(() => {
    if (!subtitlePanelVisible) {
      return;
    }

    const closePanel = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (subtitlePanelRef.current?.contains(target)) {
        return;
      }

      if (subtitleButtonRef.current?.contains(target)) {
        return;
      }

      setSubtitlePanelVisible(false);
    };

    document.addEventListener("mousedown", closePanel);
    document.addEventListener("touchstart", closePanel);
    return () => {
      document.removeEventListener("mousedown", closePanel);
      document.removeEventListener("touchstart", closePanel);
    };
  }, [subtitlePanelVisible]);

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
        let playParams = null;
        if (record && record.finished_duration && record.is_finished === 0) {
          playParams = {
            time: 5,
            pos: record.finished_duration,
          };
          setLastSeeValue(playParams);
          setWatchedSeconds(record.finished_duration);
        } else if (record && record.is_finished === 1) {
          setWatchedSeconds(res.data.hour.duration);
        }
        getVideoUrl(res.data.hour.rid, playParams);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const getVideoUrl = (rid: number, data: any) => {
    setSubtitlePanelVisible(false);
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
    currentPlayUrl: string,
    isTrySee: number,
    playParams: any,
    currentSubtitleUrl?: string
  ) => {
    destroyPlayer();
    let banDrag =
      systemConfig.playerIsDisabledDrag &&
      watchRef.current < totalRef.current &&
      watchRef.current === 0;
    const options: any = {
      container: document.getElementById("meedu-player-container"),
      autoplay: false,
      video: {
        url: currentPlayUrl,
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
      last_see_pos: playParams,
    };
    if (currentSubtitleUrl) {
      options.subtitle = {
        url: currentSubtitleUrl,
        type: "webvtt",
        fontSize: `${subtitleStyleRef.current.fontSize}px`,
        bottom: `${subtitleStyleRef.current.bottomPercent}%`,
        color: subtitleStyleRef.current.color,
      };
    }
    window.player = new window.DPlayer(options);
    bindSubtitleButton(window.player);
    if (currentSubtitleUrl) {
      subtitleTrackBindingRef.current = installNativeSubtitleTrack(
        window.player,
        currentSubtitleUrl,
        subtitleStyleRef
      );
      subtitleTrackBindingRef.current?.sync();
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
      setSubtitlePanelVisible(false);
      playTimeUpdate(parseInt(window.player.video.currentTime), true);
      exitFullscreen();
      destroyPlayer();
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
      ).then(() => {});
      Course.playPing(Number(params.courseId), Number(params.hourId)).then(
        () => {}
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
        destroyPlayer();
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
    setSubtitleStyle((prev) => normalizeSubtitleStyle({ ...prev, ...patch }));
  };

  return (
    <div className={styles["video-mask"]}>
      <div className={styles["top-cont"]}>
        <div className={styles["box"]}>
          <div
            className={styles["close-btn"]}
            onClick={() => {
              timer && clearInterval(timer);
              destroyPlayer();
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
          {subtitleUrl && subtitlePanelVisible && (
            <div className={styles["subtitle-panel"]} ref={subtitlePanelRef}>
              <div className={styles["subtitle-row-head"]}>
                <span>字幕</span>
                <button
                  className={`${styles["subtitle-switch"]} ${
                    subtitleStyle.enabled ? styles["subtitle-switch-active"] : ""
                  }`}
                  onClick={() =>
                    updateSubtitleStyle({ enabled: !subtitleStyle.enabled })
                  }
                >
                  {subtitleStyle.enabled ? "开" : "关"}
                </button>
              </div>
              <div className={styles["subtitle-row"]}>
                <div className={styles["subtitle-row-head"]}>
                  <span>字号</span>
                  <span>{subtitleStyle.fontSize}px</span>
                </div>
                <input
                  className={styles["subtitle-range"]}
                  type="range"
                  min={subtitleFontSizeRange.min}
                  max={subtitleFontSizeRange.max}
                  step={1}
                  value={subtitleStyle.fontSize}
                  onChange={(event) =>
                    updateSubtitleStyle({
                      fontSize: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className={styles["subtitle-row"]}>
                <div className={styles["subtitle-row-head"]}>
                  <span>位置</span>
                  <span>{subtitleStyle.bottomPercent}%</span>
                </div>
                <input
                  className={styles["subtitle-range"]}
                  type="range"
                  min={subtitleBottomRange.min}
                  max={subtitleBottomRange.max}
                  step={1}
                  value={subtitleStyle.bottomPercent}
                  onChange={(event) =>
                    updateSubtitleStyle({
                      bottomPercent: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div className={styles["subtitle-row"]}>
                <div className={styles["subtitle-row-head"]}>
                  <span>底板</span>
                  <button
                    className={`${styles["subtitle-switch"]} ${
                      subtitleStyle.backgroundEnabled
                        ? styles["subtitle-switch-active"]
                        : ""
                    }`}
                    onClick={() =>
                      updateSubtitleStyle({
                        backgroundEnabled: !subtitleStyle.backgroundEnabled,
                      })
                    }
                  >
                    {subtitleStyle.backgroundEnabled ? "开" : "关"}
                  </button>
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
