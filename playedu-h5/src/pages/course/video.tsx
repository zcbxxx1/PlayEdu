import { useEffect, useRef, useState } from "react";
import styles from "./video.module.scss";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { course as Course } from "../../api/index";
import { Toast, Image } from "antd-mobile";
import backIcon from "../../assets/images/commen/icon-back-n.png";
import { Empty } from "../../components";
import { HourCompenent } from "./compenents/videoHour";

declare const window: any;

type SubtitleStyleModel = {
  backgroundEnabled: boolean;
  bottomPercent: number;
  color: string;
  enabled: boolean;
  fontSize: number;
};

type NativeSubtitleBinding = {
  destroy: () => void;
  sync: () => void;
  trackEl: HTMLTrackElement;
};

const subtitleStyleStorageKey = "playedu:h5:subtitle-style";
const subtitleFontSizeRange = { min: 10, max: 24 };
const subtitleBottomRange = { min: 6, max: 24 };
const subtitleColorOptions = ["#ffffff", "#ffd966", "#7ee787", "#8ab4f8"];

const defaultSubtitleStyle: SubtitleStyleModel = {
  enabled: true,
  fontSize: 14,
  bottomPercent: 10,
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
  subtitleEl.style.maxWidth = "calc(100% - 32px)";
  subtitleEl.style.whiteSpace = "pre-wrap";
  subtitleEl.style.wordBreak = "break-word";
  subtitleEl.style.textAlign = "center";
  subtitleEl.style.lineHeight = "1.5";
  subtitleEl.style.pointerEvents = "none";
  subtitleEl.style.display = visible ? "block" : "none";
  subtitleEl.style.opacity = visible ? "1" : "0";
  subtitleEl.style.fontSize = `${style.fontSize}px`;
  subtitleEl.style.bottom = `${style.bottomPercent}%`;
  subtitleEl.style.color = style.color;
  subtitleEl.style.padding = style.backgroundEnabled ? "5px 10px" : "0 3px";
  subtitleEl.style.borderRadius = style.backgroundEnabled ? "9px" : "0";
  subtitleEl.style.background = style.backgroundEnabled
    ? "rgba(0, 0, 0, 0.56)"
    : "transparent";
  subtitleEl.style.boxShadow = style.backgroundEnabled
    ? "0 10px 24px rgba(0, 0, 0, 0.18)"
    : "none";
  subtitleEl.style.textShadow = style.backgroundEnabled
    ? "0 1px 2px rgba(0, 0, 0, 0.5)"
    : "0 1px 3px rgba(0, 0, 0, 0.85), 0 0 10px rgba(0, 0, 0, 0.45)";
};

const syncSubtitleState = (
  player: any,
  trackEl: HTMLTrackElement | null,
  style: SubtitleStyleModel
) => {
  const isPiP =
    typeof document !== "undefined" &&
    "pictureInPictureElement" in document &&
    (document as any).pictureInPictureElement === player?.video;

  if (trackEl?.track) {
    trackEl.track.mode = isPiP && style.enabled ? "showing" : "disabled";
  }

  applySubtitleStyle(player, style, isPiP);
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
  track.kind = "subtitles";
  track.label = "中文字幕";
  track.srclang = "zh";
  track.src = subtitleUrl;
  track.default = false;
  track.setAttribute("data-playedu-subtitle", "1");
  videoEl.appendChild(track);

  const sync = () => syncSubtitleState(player, track, styleRef.current);
  const onPiPChange = () => sync();

  track.addEventListener("load", sync);
  videoEl.addEventListener("enterpictureinpicture", onPiPChange);
  videoEl.addEventListener("leavepictureinpicture", onPiPChange);
  sync();

  return {
    trackEl: track,
    sync,
    destroy: () => {
      track.removeEventListener("load", sync);
      videoEl.removeEventListener("enterpictureinpicture", onPiPChange);
      videoEl.removeEventListener("leavepictureinpicture", onPiPChange);
      track.remove();
    },
  };
};

type LocalUserLearnHourRecordModel = {
  [key: number]: UserLearnHourRecordModel;
};

type LocalCourseHour = {
  [key: number]: CourseHourModel[];
};

const CoursePlayPage = () => {
  const navigate = useNavigate();
  const params = useParams();
  const systemConfig = useSelector((state: any) => state.systemConfig.value);
  const user = useSelector((state: any) => state.loginUser.value.user);
  const [playUrl, setPlayUrl] = useState("");
  const [playDuration, setPlayDuration] = useState(0);
  const [playendedStatus, setPlayendedStatus] = useState(false);
  const [lastSeeValue, setLastSeeValue] = useState({});
  const [course, setCourse] = useState<CourseModel | null>(null);
  const [hour, setHour] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [isLastpage, setIsLastpage] = useState(false);
  const [totalHours, setTotalHours] = useState<any>([]);
  const [playingTime, setPlayingTime] = useState(0);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [subtitleUrl, setSubtitleUrl] = useState("");
  const [subtitleStyle, setSubtitleStyle] =
    useState<SubtitleStyleModel>(loadSubtitleStyle);
  const [subtitlePanelVisible, setSubtitlePanelVisible] = useState(false);
  const [chapters, setChapters] = useState<ChapterModel[]>([]);
  const [hours, setHours] = useState<LocalCourseHour | null>(null);
  const [learnHourRecord, setLearnHourRecord] =
    useState<LocalUserLearnHourRecordModel>({});
  const myRef = useRef(0);
  const playRef = useRef(0);
  const watchRef = useRef(0);
  const totalRef = useRef(0);
  const subtitleStyleRef = useRef<SubtitleStyleModel>(loadSubtitleStyle());
  const subtitlePanelRef = useRef<HTMLDivElement | null>(null);
  const subtitleButtonRef = useRef<HTMLElement | null>(null);
  const subtitleTrackBindingRef = useRef<NativeSubtitleBinding | null>(null);
  const subtitleButtonCleanupRef = useRef<(() => void) | null>(null);

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
    setSubtitlePanelVisible(false);
    getCourse();
    getDetail();
    return () => {
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
    totalRef.current = hour.duration;
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
      setChapters(res.data.chapters);
      setHours(res.data.hours);
      if (res.data.learn_hour_records) {
        setLearnHourRecord(res.data.learn_hour_records);
      }
      let hoursList: any = [];
      if (res.data.chapters.length === 0) {
        setTotalHours(res.data.hours[0]);
        hoursList = res.data.hours[0];
      } else if (res.data.chapters.length > 0) {
        const arr: any = [];
        for (let key in res.data.hours) {
          res.data.hours[key].map((item: any) => {
            arr.push(item);
          });
        }
        setTotalHours(arr);
        hoursList = arr;
      }
      const index = hoursList.findIndex(
        (i: any) => i.id === Number(params.hourId)
      );
      if (index === hoursList.length - 1) {
        setIsLastpage(true);
      } else {
        setIsLastpage(false);
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
        let courseItem: CourseModel = res.data.course;
        setCourse(courseItem);
        setHour(res.data.hour);
        document.title = res.data.hour.title;
        let record = res.data.user_hour_record;
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
        setPlayUrl(res.data.resource_url[rid]);
        setSubtitleUrl(res.data.subtitle_url || "");
        initDPlayer(res.data.resource_url[rid], 0, data, res.data.subtitle_url);
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
        Toast.show("首次学习禁止快进");
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
      setPlayendedStatus(true);
      setPlayingTime(0);
      setSubtitlePanelVisible(false);
      playTimeUpdate(parseInt(window.player.video.currentTime), true);
      exitFullscreen();
      destroyPlayer();
    });
    setLoading(false);
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

  const goNextVideo = () => {
    const index = totalHours.findIndex(
      (i: any) => i.id === Number(params.hourId)
    );
    if (index === totalHours.length - 1) {
      setIsLastpage(true);
      Toast.show("已经是最后一节了！");
    } else if (index < totalHours.length - 1) {
      setIsLastpage(false);
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

  const playVideo = (cid: number, id: number) => {
    navigate(`/course/${cid}/hour/${id}`, { replace: true });
  };

  const updateSubtitleStyle = (patch: Partial<SubtitleStyleModel>) => {
    setSubtitleStyle((prev) => normalizeSubtitleStyle({ ...prev, ...patch }));
  };

  return (
    <div className="main-body">
      <div className={styles["video-body"]}>
        <Image
          className={styles["back-icon"]}
          src={backIcon}
          onClick={() => {
            destroyPlayer();
            navigate(-1);
          }}
        />
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
            style={{ display: playendedStatus ? "none" : "block" }}
            id="meedu-player-container"
          ></div>
          {playendedStatus && (
            <div className={styles["alert-message"]}>
              {isLastpage && (
                <div
                  className={styles["alert-button"]}
                  onClick={() => {
                    navigate(-1);
                  }}
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
      <div className={styles["chapters-hours-cont"]}>
        {chapters.length === 0 && !hours && <Empty />}
        {chapters.length === 0 && hours && (
          <div className={styles["hours-list-box"]} style={{ marginTop: 10 }}>
            {hours[0].map((item: CourseHourModel) => (
              <div key={item.id} className={styles["hours-it"]}>
                <HourCompenent
                  id={item.id}
                  cid={item.course_id}
                  title={item.title}
                  record={learnHourRecord[item.id]}
                  duration={item.duration}
                  vid={Number(params.hourId)}
                  onSuccess={(cid: number, id: number) => {
                    playVideo(cid, id);
                  }}
                ></HourCompenent>
              </div>
            ))}
          </div>
        )}
        {chapters.length > 0 && hours && (
          <div className={styles["hours-list-box"]}>
            {chapters.map((item: ChapterModel) => (
              <div key={item.id} className={styles["chapter-it"]}>
                <div className={styles["chapter-name"]}>{item.name}</div>
                {hours[item.id]?.map((it: CourseHourModel) => (
                  <div key={it.id} className={styles["hours-it"]}>
                    <HourCompenent
                      id={it.id}
                      cid={item.course_id}
                      title={it.title}
                      record={learnHourRecord[it.id]}
                      duration={it.duration}
                      vid={Number(params.hourId)}
                      onSuccess={(cid: number, id: number) => {
                        playVideo(cid, id);
                      }}
                    ></HourCompenent>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursePlayPage;
