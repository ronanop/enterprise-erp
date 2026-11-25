import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Avatar } from "@/components/ui";
import { IconClose, IconHeart } from "@/components/icons";
import { resolveFeedMediaUri } from "@/lib/feed-media";
import { essService } from "@/services/ess-service";
import { formatRelativeShort } from "@/utils/datetime";
import type { EssStoryItem, EssStoryTrayAuthor } from "@/types/api";

type Props = {
  author: EssStoryTrayAuthor | null;
  visible: boolean;
  onClose: () => void;
  onFinishedAuthor?: () => void;
};

const IMAGE_MS = 5000;

/** Full-screen Instagram Stories player with flip advance + likes. */
export function StoryViewer({ author, visible, onClose, onFinishedAuthor }: Props) {
  const insets = useSafeAreaInsets();
  const [stories, setStories] = useState<EssStoryItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [liking, setLiking] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(0);
  const pausedRef = useRef(false);
  const flip = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runFlip = useCallback(
    (direction: 1 | -1, onMid: () => void) => {
      flip.setValue(0);
      Animated.timing(flip, {
        toValue: direction,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        onMid();
        flip.setValue(-direction);
        Animated.timing(flip, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    },
    [flip],
  );

  useEffect(() => {
    if (!visible || !author) {
      setStories([]);
      setIndex(0);
      setUri(null);
      setProgress(0);
      clearTimer();
      return;
    }
    let cancelled = false;
    setLoading(true);
    essService
      .storiesByAuthor(author.author_employee_id)
      .then((res) => {
        if (cancelled) return;
        const rows = res.data ?? [];
        setStories(rows);
        const firstUnseen = rows.findIndex((s) => !s.viewed_by_me);
        setIndex(firstUnseen >= 0 ? firstUnseen : 0);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [visible, author?.author_employee_id, clearTimer]);

  const current = stories[index] ?? null;

  useEffect(() => {
    if (!current) {
      setUri(null);
      return;
    }
    let cancelled = false;
    setUri(null);
    setProgress(0);
    resolveFeedMediaUri(current.url, current.id)
      .then((resolved) => {
        if (!cancelled) setUri(resolved);
      })
      .catch(() => {
        if (!cancelled) setUri(null);
      });
    void essService.markStoryViewed(current.id).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [current?.id]);

  const finishAuthor = useCallback(() => {
    if (onFinishedAuthor) onFinishedAuthor();
    else onClose();
  }, [onClose, onFinishedAuthor]);

  const goNext = useCallback(() => {
    clearTimer();
    runFlip(1, () => {
      setIndex((i) => {
        if (i + 1 < stories.length) return i + 1;
        finishAuthor();
        return i;
      });
    });
  }, [stories.length, clearTimer, runFlip, finishAuthor]);

  const goPrev = useCallback(() => {
    clearTimer();
    runFlip(-1, () => {
      setIndex((i) => Math.max(0, i - 1));
    });
  }, [clearTimer, runFlip]);

  useEffect(() => {
    clearTimer();
    if (!visible || !current || !uri) return;
    if (current.media_type === "video") return;

    const duration = IMAGE_MS;
    startRef.current = Date.now();
    pausedRef.current = false;
    timerRef.current = setInterval(() => {
      if (pausedRef.current) {
        startRef.current += 50;
        return;
      }
      const elapsed = Date.now() - startRef.current;
      const p = Math.min(1, elapsed / duration);
      setProgress(p);
      if (p >= 1) {
        clearTimer();
        goNext();
      }
    }, 50);
    return clearTimer;
  }, [visible, current?.id, current?.media_type, uri, clearTimer, goNext]);

  async function toggleLike() {
    if (!current || liking) return;
    setLiking(true);
    const prev = current;
    setStories((rows) =>
      rows.map((s) =>
        s.id === prev.id
          ? {
              ...s,
              liked_by_me: !s.liked_by_me,
              like_count: Math.max(
                0,
                (s.like_count ?? 0) + (s.liked_by_me ? -1 : 1),
              ),
            }
          : s,
      ),
    );
    try {
      const res = await essService.toggleStoryLike(prev.id);
      if (res.data) {
        setStories((rows) =>
          rows.map((s) => (s.id === prev.id ? { ...s, ...res.data } : s)),
        );
      }
    } catch {
      setStories((rows) =>
        rows.map((s) => (s.id === prev.id ? prev : s)),
      );
    } finally {
      setLiking(false);
    }
  }

  function handleSideTap(dir: "prev" | "next") {
    const now = Date.now();
    if (now - lastTap.current < 260) {
      lastTap.current = 0;
      setHeartBurst(true);
      setTimeout(() => setHeartBurst(false), 700);
      if (!current?.liked_by_me) void toggleLike();
      return;
    }
    lastTap.current = now;
    const token = now;
    setTimeout(() => {
      if (lastTap.current !== token) return;
      if (dir === "next") goNext();
      else goPrev();
    }, 260);
  }

  const screenH = Dimensions.get("window").height;
  const rotateY = flip.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["18deg", "0deg", "-18deg"],
  });
  const opacity = flip.interpolate({
    inputRange: [-1, -0.2, 0, 0.2, 1],
    outputRange: [0.35, 1, 1, 1, 0.35],
  });
  const scale = flip.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.92, 1, 0.92],
  });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
        <View style={styles.progressRow}>
          {stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < index
                        ? "100%"
                        : i === index
                          ? `${Math.round(progress * 100)}%`
                          : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.topBar}>
          <Avatar name={author?.author_name ?? "?"} size="sm" />
          <View style={styles.topText}>
            <Text style={styles.name} numberOfLines={1}>
              {author?.author_name}
            </Text>
            <Text style={styles.meta}>
              {current ? formatRelativeShort(current.published_at) : ""}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close stories"
            style={styles.close}
          >
            <IconClose size={22} color="#fff" />
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.stage,
            {
              minHeight: screenH * 0.68,
              opacity,
              transform: [{ perspective: 900 }, { rotateY }, { scale }],
            },
          ]}
        >
          {loading || !uri ? (
            <ActivityIndicator color="#fff" size="large" />
          ) : current?.media_type === "video" ? (
            <StoryVideo uri={uri} onEnded={goNext} onProgress={setProgress} />
          ) : (
            <Image source={{ uri }} style={styles.media} resizeMode="contain" />
          )}

          {(current?.overlays ?? []).map((o) => {
            const hasBg = Boolean(o.background_enabled);
            const fontSize = o.font_size || 22;
            const padH = Math.max(8, Math.round(fontSize * 0.32));
            const padV = Math.max(4, Math.round(fontSize * 0.22));
            return (
              <View
                key={o.id}
                pointerEvents="none"
                style={[
                  styles.overlay,
                  {
                    left: `${o.x * 100}%`,
                    top: `${o.y * 100}%`,
                    paddingHorizontal: padH,
                    paddingVertical: padV,
                    borderRadius: Math.max(6, Math.round(fontSize * 0.28)),
                    backgroundColor: hasBg
                      ? o.background_color || "#000"
                      : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.overlayText,
                    {
                      color: o.color,
                      fontSize,
                      textShadowColor: hasBg
                        ? "transparent"
                        : "rgba(0,0,0,0.55)",
                    },
                  ]}
                >
                  {o.text}
                </Text>
              </View>
            );
          })}

          {current?.caption ? (
            <Text style={styles.caption}>{current.caption}</Text>
          ) : null}

          {heartBurst ? (
            <View style={styles.burstWrap} pointerEvents="none">
              <IconHeart size={88} color="#ff2d55" filled />
            </View>
          ) : null}
        </Animated.View>

        <View
          style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}
        >
          <Pressable
            onPress={() => void toggleLike()}
            style={styles.likeBtn}
            accessibilityRole="button"
            accessibilityLabel="Like story"
          >
            <IconHeart
              size={28}
              color={current?.liked_by_me ? "#ff2d55" : "#fff"}
              filled={Boolean(current?.liked_by_me)}
            />
            <Text style={styles.likeCount}>{current?.like_count ?? 0}</Text>
          </Pressable>
        </View>

        <View style={styles.tapRow} pointerEvents="box-none">
          <Pressable
            style={styles.tapLeft}
            onPress={() => handleSideTap("prev")}
            onLongPress={() => {
              pausedRef.current = true;
            }}
            onPressOut={() => {
              pausedRef.current = false;
            }}
          />
          <Pressable
            style={styles.tapRight}
            onPress={() => handleSideTap("next")}
            onLongPress={() => {
              pausedRef.current = true;
            }}
            onPressOut={() => {
              pausedRef.current = false;
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function StoryVideo({
  uri,
  onEnded,
  onProgress,
}: {
  uri: string;
  onEnded: () => void;
  onProgress: (p: number) => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener("playToEnd", () => {
      onProgress(1);
      onEnded();
    });
    const tick = setInterval(() => {
      const d = player.duration;
      const t = player.currentTime;
      if (d > 0) onProgress(Math.min(1, t / d));
    }, 80);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
  }, [player, onEnded, onProgress]);

  return (
    <VideoView
      style={styles.media}
      player={player}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
    zIndex: 3,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    zIndex: 3,
  },
  topText: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontWeight: "700", fontSize: 14 },
  meta: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 1 },
  close: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    overflow: "hidden",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    transform: [{ translateX: -90 }],
    maxWidth: 240,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  overlayText: {
    fontWeight: "800",
    textAlign: "center",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  caption: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 48,
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  burstWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 18,
    zIndex: 3,
  },
  likeBtn: {
    alignItems: "center",
    gap: 2,
    minWidth: 44,
  },
  likeCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  tapRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 1,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 1 },
});
