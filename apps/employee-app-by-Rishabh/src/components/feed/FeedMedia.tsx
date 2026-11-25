import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { IconPlay } from "@/components/icons";
import { resolveFeedMediaUri } from "@/lib/feed-media";
import { colors } from "@/theme/colors";
import type { EssFeedMediaItem } from "@/types/api";

type Props = {
  item: EssFeedMediaItem;
  aspectStyle: { aspectRatio: number };
  style?: StyleProp<ViewStyle>;
};

export function FeedMedia({ item, aspectStyle, style }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    setError(false);
    if (!item.url) {
      setError(true);
      return;
    }
    resolveFeedMediaUri(item.url, item.id)
      .then((resolved) => {
        if (!cancelled) setUri(resolved);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.url]);

  if (error) {
    return <View style={[styles.box, aspectStyle, styles.fallback, style]} />;
  }

  if (!uri) {
    return (
      <View style={[styles.box, aspectStyle, styles.fallback, style]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (item.media_type === "video") {
    return (
      <FeedVideo
        uri={uri}
        processing={item.processing_status !== "ready"}
        aspectStyle={aspectStyle}
        style={style}
      />
    );
  }

  const imageStyle: StyleProp<ImageStyle> = [styles.box, aspectStyle];

  return (
    <View style={style}>
      <Image
        source={{ uri }}
        style={imageStyle}
        resizeMode="cover"
        accessibilityLabel="Feed photo"
      />
    </View>
  );
}

function FeedVideo({
  uri,
  processing,
  aspectStyle,
  style,
}: {
  uri: string;
  processing: boolean;
  aspectStyle: { aspectRatio: number };
  style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  return (
    <View style={[styles.box, aspectStyle, style]}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls
      />
      {processing ? (
        <View style={styles.processing}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <View style={styles.playBadge} pointerEvents="none">
          <IconPlay size={18} color="#fff" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: "100%",
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  processing: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,28,48,0.35)",
  },
  playBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(11,28,48,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
