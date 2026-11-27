import { useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Avatar } from "@/components/ui";
import { FeedMedia } from "@/components/feed/FeedMedia";
import { FeedPostMenu } from "@/components/feed/FeedPostMenu";
import { IconComment, IconHeart, IconMore } from "@/components/icons";
import { aspectToStyle } from "@/lib/feed-media";
import { colors, radii } from "@/theme/colors";
import { formatRelativeShort } from "@/utils/datetime";
import type { EssFeedPost } from "@/types/api";

type Props = {
  post: EssFeedPost;
  onLike: (post: EssFeedPost) => void;
  onOpenComments: (post: EssFeedPost) => void;
  onAuthorBlocked?: (authorEmployeeId: string) => void;
};

export function FeedPostCard({
  post,
  onLike,
  onOpenComments,
  onAuthorBlocked,
}: Props) {
  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const aspect = aspectToStyle(post.aspect_ratio);
  const media = [...post.media].sort((a, b) => a.sort_order - b.sort_order);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!width) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(next);
  }

  const metaParts = [
    post.published_at ? formatRelativeShort(post.published_at) : null,
    post.status === "processing" ? "Processing" : null,
  ].filter(Boolean);

  return (
    <View
      style={styles.card}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      <View style={styles.header}>
        <Avatar name={post.author_name} size="sm" />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {post.author_name}
          </Text>
          {metaParts.length ? (
            <Text style={styles.meta} numberOfLines={1}>
              {metaParts.join(" · ")}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post options"
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <IconMore size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      </View>

      {media.length <= 1 ? (
        media[0] ? (
          <FeedMedia item={media[0]} aspectStyle={aspect} />
        ) : null
      ) : (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScrollEnd}
            decelerationRate="fast"
          >
            {media.map((m) => (
              <View key={m.id} style={{ width: width || undefined }}>
                <FeedMedia item={m} aspectStyle={aspect} />
              </View>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {media.map((m, i) => (
              <View
                key={m.id}
                style={[styles.dot, i === page ? styles.dotActive : null]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? "Unlike" : "Like"}
          onPress={() => onLike(post)}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <IconHeart
            size={24}
            color={post.liked_by_me ? colors.error : colors.onSurface}
            filled={post.liked_by_me}
          />
          <Text style={styles.actionCount}>{post.like_count}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comments"
          onPress={() => onOpenComments(post)}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          hitSlop={8}
        >
          <IconComment size={24} color={colors.onSurface} />
          <Text style={styles.actionCount}>{post.comment_count}</Text>
        </Pressable>
      </View>

      {post.caption ? (
        <Text style={styles.caption}>
          <Text style={styles.captionName}>{post.author_name} </Text>
          {post.caption}
        </Text>
      ) : null}

      <FeedPostMenu
        post={post}
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAuthorBlocked={onAuthorBlocked}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    paddingBottom: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  meta: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    paddingTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.outlineVariant,
  },
  dotActive: { backgroundColor: colors.primary },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: radii.sm,
  },
  pressed: { opacity: 0.7 },
  actionCount: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.onSurface,
    minWidth: 12,
  },
  caption: {
    paddingHorizontal: 14,
    paddingTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
  },
  captionName: { fontWeight: "700" },
});
