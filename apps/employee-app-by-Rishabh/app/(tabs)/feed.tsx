import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedCommentsSheet } from "@/components/feed/FeedCommentsSheet";
import { FeedComposer } from "@/components/feed/FeedComposer";
import { FeedHeader } from "@/components/feed/FeedHeader";
import { FeedPostCard } from "@/components/feed/FeedPostCard";
import { StoriesTray } from "@/components/feed/StoriesTray";
import { StoryComposer } from "@/components/feed/StoryComposer";
import { StoryViewer } from "@/components/feed/StoryViewer";
import { useFeedPullRefresh } from "@/components/feed/useFeedPullRefresh";
import { IconFeed } from "@/components/icons";
import { Button, EmptyState, Screen } from "@/components/ui";
import { getBlockedAuthorIds } from "@/lib/feed-safety";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors } from "@/theme/colors";
import { TAB_CLEARANCE } from "@/theme/tokens";
import type { EssFeedPost, EssStoryTrayAuthor } from "@/types/api";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<EssFeedPost[]>([]);
  const [blockedAuthors, setBlockedAuthors] = useState<Set<string>>(new Set());
  const [storyAuthors, setStoryAuthors] = useState<EssStoryTrayAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [commentPost, setCommentPost] = useState<EssFeedPost | null>(null);
  const [viewerAuthor, setViewerAuthor] = useState<EssStoryTrayAuthor | null>(
    null,
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const listBottomPad = TAB_CLEARANCE + Math.max(0, insets.bottom);

  const loadBlocked = useCallback(async () => {
    const ids = await getBlockedAuthorIds();
    setBlockedAuthors(new Set(ids));
  }, []);

  const loadStories = useCallback(async () => {
    try {
      const res = await essService.storyTray();
      setStoryAuthors(res.data ?? []);
    } catch {
      // Tray is optional chrome — keep last known authors on failure.
    }
  }, []);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    setError(null);
    try {
      const [feedRes] = await Promise.all([
        essService.feedPosts({ limit: 30 }),
        loadStories(),
        loadBlocked(),
      ]);
      setPosts(feedRes.data ?? []);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Could not load the feed",
      );
    } finally {
      setLoading(false);
    }
  }, [loadStories, loadBlocked]);

  const refreshPosts = useCallback(async () => {
    setError(null);
    const [feedRes] = await Promise.all([
      essService.feedPosts({ limit: 30 }),
      loadStories(),
      loadBlocked(),
    ]);
    setPosts(feedRes.data ?? []);
  }, [loadStories, loadBlocked]);

  const visiblePosts = useMemo(
    () =>
      posts.filter((p) => !blockedAuthors.has(p.author_employee_id)),
    [posts, blockedAuthors],
  );

  const visibleStoryAuthors = useMemo(
    () =>
      storyAuthors.filter((a) => !blockedAuthors.has(a.author_employee_id)),
    [storyAuthors, blockedAuthors],
  );

  function onAuthorBlocked(authorEmployeeId: string) {
    setBlockedAuthors((prev) => {
      const next = new Set(prev);
      next.add(authorEmployeeId);
      return next;
    });
  }

  const pull = useFeedPullRefresh({ onRefresh: refreshPosts });

  useEffect(() => {
    void load();
  }, [load]);

  const loadUnread = useCallback(async () => {
    try {
      const res = await essService.notificationUnreadCount();
      setUnreadCount(res.data?.unread_count ?? 0);
    } catch {
      // Keep last known count if the badge poll fails.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUnread();
      void loadStories();
    }, [loadUnread, loadStories]),
  );

  async function onLike(post: EssFeedPost) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: Math.max(
                0,
                p.like_count + (p.liked_by_me ? -1 : 1),
              ),
            }
          : p,
      ),
    );
    try {
      const res = await essService.toggleFeedLike(post.id);
      if (res.data) {
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? res.data! : p)),
        );
      }
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? post : p)),
      );
    }
  }

  function onCommentAdded(postId: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p,
      ),
    );
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    pull.onScrollOffset(e.nativeEvent.contentOffset.y);
  }

  const showWebPullHint =
    Platform.OS === "web" && (pull.webPull > 0 || pull.refreshing);

  return (
    <Screen
      header={
        <FeedHeader
          onCreate={() => setComposerOpen(true)}
          unreadCount={unreadCount}
        />
      }
      animateEntrance={false}
      contentStyle={styles.content}
    >
      {loading && !posts.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View
          style={styles.listShell}
          onStartShouldSetResponderCapture={() => false}
          {...(Platform.OS === "web"
            ? {
                onTouchStart: (e: { nativeEvent: { pageY: number } }) =>
                  pull.onWebTouchStart(e.nativeEvent.pageY),
                onTouchMove: (e: { nativeEvent: { pageY: number } }) =>
                  pull.onWebTouchMove(e.nativeEvent.pageY),
                onTouchEnd: () => pull.onWebTouchEnd(),
                onTouchCancel: () => pull.onWebTouchEnd(),
              }
            : null)}
        >
          {showWebPullHint ? (
            <View
              style={[
                styles.webPull,
                {
                  height: pull.refreshing
                    ? 56
                    : Math.max(28, pull.webPull * 0.85),
                },
              ]}
            >
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{
                  opacity: pull.refreshing
                    ? 1
                    : 0.35 + pull.webPullProgress * 0.65,
                  transform: [
                    {
                      scale: pull.refreshing
                        ? 1
                        : 0.55 + pull.webPullProgress * 0.45,
                    },
                  ],
                }}
              />
            </View>
          ) : null}

          <FlatList
            style={styles.list}
            data={visiblePosts}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            decelerationRate="normal"
            scrollEventThrottle={16}
            onScroll={onScroll}
            bounces
            alwaysBounceVertical
            overScrollMode="auto"
            removeClippedSubviews={Platform.OS !== "web"}
            windowSize={7}
            maxToRenderPerBatch={4}
            updateCellsBatchingPeriod={50}
            initialNumToRender={3}
            refreshControl={
              Platform.OS === "web" ? undefined : (
                <RefreshControl
                  refreshing={pull.refreshing}
                  onRefresh={() => void pull.runRefresh()}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressBackgroundColor={colors.surfaceLowest}
                  title={Platform.OS === "ios" ? "Pull to refresh" : undefined}
                  titleColor={colors.onSurfaceVariant}
                />
              )
            }
            contentContainerStyle={
              visiblePosts.length
                ? [styles.listContent, { paddingBottom: listBottomPad }]
                : [styles.listEmpty, { paddingBottom: listBottomPad }]
            }
            ListHeaderComponent={
              <View>
                <StoriesTray
                  authors={visibleStoryAuthors}
                  onOpenAuthor={setViewerAuthor}
                  onAddStory={() => setStoryComposerOpen(true)}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyBody}>
                <EmptyState
                  title="Start the conversation"
                  description="Share a photo or short video with your team. Up to 10 photos or one 60s video."
                  icon={<IconFeed size={28} color={colors.primary} />}
                  action={
                    <Button
                      title="Create post"
                      onPress={() => setComposerOpen(true)}
                    />
                  }
                />
              </View>
            }
            renderItem={({ item }) => (
              <FeedPostCard
                post={item}
                onLike={onLike}
                onOpenComments={setCommentPost}
                onAuthorBlocked={onAuthorBlocked}
              />
            )}
          />
        </View>
      )}

      <FeedComposer
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPublished={() => void pull.runRefresh()}
      />
      <StoryComposer
        visible={storyComposerOpen}
        onClose={() => setStoryComposerOpen(false)}
        onPublished={() => void loadStories()}
      />
      <StoryViewer
        author={viewerAuthor}
        visible={Boolean(viewerAuthor)}
        onClose={() => {
          setViewerAuthor(null);
          void loadStories();
        }}
        onFinishedAuthor={() => {
          if (!viewerAuthor) return;
          const idx = visibleStoryAuthors.findIndex(
            (a) => a.author_employee_id === viewerAuthor.author_employee_id,
          );
          const next =
            idx >= 0 && idx + 1 < visibleStoryAuthors.length
              ? visibleStoryAuthors[idx + 1]
              : null;
          if (next) setViewerAuthor(next);
          else {
            setViewerAuthor(null);
            void loadStories();
          }
        }}
      />
      <FeedCommentsSheet
        post={commentPost}
        visible={Boolean(commentPost)}
        onClose={() => setCommentPost(null)}
        onCommentAdded={onCommentAdded}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    flex: 1,
    minHeight: 0,
  },
  listShell: { flex: 1 },
  list: { flex: 1 },
  listContent: { flexGrow: 1 },
  // Keep stories pinned under the header — do not vertically center the
  // whole FlatList content (that was pushing the tray mid-screen).
  listEmpty: { flexGrow: 1, paddingHorizontal: 0 },
  emptyBody: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    minHeight: 220,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  webPull: {
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
    overflow: "hidden",
  },
  error: {
    color: colors.error,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
