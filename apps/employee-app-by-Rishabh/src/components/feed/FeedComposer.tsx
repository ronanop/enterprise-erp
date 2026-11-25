import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { IconClose, IconPlus } from "@/components/icons";
import { aspectTuple } from "@/lib/feed-media";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import type { EssFeedAspectRatio, EssFeedMediaUpload } from "@/types/api";

const MAX_PHOTOS = 10;
const MAX_VIDEO_SECONDS = 60;
const ASPECTS: EssFeedAspectRatio[] = ["1:1", "3:4", "4:3"];

type DraftMedia = {
  localUri: string;
  media_type: "image" | "video";
  file_name: string;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onPublished: () => void;
};

export function FeedComposer({ visible, onClose, onPublished }: Props) {
  const insets = useSafeAreaInsets();
  const [aspect, setAspect] = useState<EssFeedAspectRatio>("1:1");
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<DraftMedia[]>([]);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAddMore = mode === "photo" && items.length < MAX_PHOTOS;
  const previewRatio = useMemo(() => {
    const [w, h] = aspectTuple(aspect);
    return w / h;
  }, [aspect]);

  function reset() {
    setCaption("");
    setItems([]);
    setMode("photo");
    setAspect("1:1");
    setError(null);
    setBusy(false);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function pickPhotos() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required.");
      return;
    }
    const remaining = MAX_PHOTOS - items.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos per post.`);
      return;
    }

    // Native crop UI (Instagram ratios) — one pick at a time with allowsEditing.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: aspectTuple(aspect),
      quality: 0.88,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const next: DraftMedia = {
      localUri: asset.uri,
      media_type: "image",
      file_name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      width: asset.width,
      height: asset.height,
    };
    setMode("photo");
    setItems((prev) =>
      [...prev.filter((p) => p.media_type === "image"), next].slice(
        0,
        MAX_PHOTOS,
      ),
    );
  }

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError("Camera permission is required.");
      return;
    }
    if (items.length >= MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos per post.`);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: aspectTuple(aspect),
      quality: 0.88,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const next: DraftMedia = {
      localUri: asset.uri,
      media_type: "image",
      file_name: asset.fileName ?? `camera-${Date.now()}.jpg`,
      width: asset.width,
      height: asset.height,
    };
    setMode("photo");
    setItems((prev) =>
      [...prev.filter((p) => p.media_type === "image"), next].slice(
        0,
        MAX_PHOTOS,
      ),
    );
  }

  async function pickVideo() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      videoMaxDuration: MAX_VIDEO_SECONDS,
      quality: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const duration = Math.round(asset.duration ?? 0);
    // expo-image-picker duration is ms on some platforms, seconds on others
    const seconds =
      duration > MAX_VIDEO_SECONDS * 2
        ? Math.round(duration / 1000)
        : duration;
    if (seconds > MAX_VIDEO_SECONDS) {
      setError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or shorter.`);
      return;
    }
    setMode("video");
    setItems([
      {
        localUri: asset.uri,
        media_type: "video",
        file_name: asset.fileName ?? `video-${Date.now()}.mp4`,
        width: asset.width,
        height: asset.height,
        duration_seconds: seconds || null,
      },
    ]);
  }

  function removeAt(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function publish() {
    if (!items.length) {
      setError("Add at least one photo or a video.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const media: EssFeedMediaUpload[] = [];
      for (const item of items) {
        const content_base64 = await FileSystem.readAsStringAsync(item.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        media.push({
          media_type: item.media_type,
          file_name: item.file_name,
          content_base64,
          width: item.width,
          height: item.height,
          duration_seconds: item.duration_seconds,
        });
      }
      await essService.createFeedPost({
        caption: caption.trim() || null,
        aspect_ratio: aspect,
        media,
      });
      reset();
      onPublished();
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <Pressable
            onPress={close}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close composer"
            disabled={busy}
          >
            <IconClose size={22} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>New post</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Aspect ratio</Text>
          <View style={styles.chips}>
            {ASPECTS.map((a) => (
              <Pressable
                key={a}
                onPress={() => setAspect(a)}
                style={[styles.chip, aspect === a && styles.chipActive]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.chipText,
                    aspect === a && styles.chipTextActive,
                  ]}
                >
                  {a}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            Photos use your device cropper at Instagram ratios (max {MAX_PHOTOS}
            ). Videos max {MAX_VIDEO_SECONDS}s — compressed with FFmpeg on the
            server.
          </Text>

          <View style={styles.pickRow}>
            <Button
              title="Add photo"
              variant="secondary"
              disabled={busy || (mode === "video" && items.length > 0)}
              onPress={() => void pickPhotos()}
              style={styles.pickBtn}
            />
            <Button
              title="Camera"
              variant="secondary"
              disabled={busy || (mode === "video" && items.length > 0)}
              onPress={() => void takePhoto()}
              style={styles.pickBtn}
            />
            <Button
              title="Video"
              variant="secondary"
              disabled={busy || (mode === "photo" && items.length > 0)}
              onPress={() => {
                if (items.length && mode === "photo") {
                  Alert.alert(
                    "Replace with video?",
                    "A post can be either photos or one video.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Continue",
                        onPress: () => {
                          setItems([]);
                          void pickVideo();
                        },
                      },
                    ],
                  );
                  return;
                }
                void pickVideo();
              }}
              style={styles.pickBtn}
            />
          </View>

          {items.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewRow}
            >
              {items.map((item, index) => (
                <View key={`${item.localUri}-${index}`} style={styles.previewWrap}>
                  <Image
                    source={{ uri: item.localUri }}
                    style={[styles.preview, { aspectRatio: previewRatio }]}
                  />
                  {item.media_type === "video" ? (
                    <Text style={styles.videoBadge}>
                      VIDEO
                      {item.duration_seconds
                        ? ` · ${item.duration_seconds}s`
                        : ""}
                    </Text>
                  ) : null}
                  <Pressable
                    style={styles.remove}
                    onPress={() => removeAt(index)}
                    hitSlop={8}
                    accessibilityLabel="Remove media"
                  >
                    <IconClose size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {canAddMore ? (
                <Pressable
                  style={[styles.addMore, { aspectRatio: previewRatio }]}
                  onPress={() => void pickPhotos()}
                  accessibilityRole="button"
                  accessibilityLabel="Add another photo"
                >
                  <IconPlus size={22} color={colors.primary} />
                  <Text style={styles.addMoreText}>
                    {items.length}/{MAX_PHOTOS}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          ) : null}

          <Text style={styles.label}>Caption</Text>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Write a caption…"
            placeholderTextColor={colors.outline}
            style={styles.caption}
            multiline
            maxLength={2200}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title="Share"
            loading={busy}
            disabled={!items.length}
            onPress={() => void publish()}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.onSurface,
  },
  body: { paddingHorizontal: 16, gap: 10 },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.onSurfaceVariant,
  },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainer,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurface,
  },
  chipTextActive: { color: colors.onPrimary },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceVariant,
  },
  pickRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pickBtn: { flexGrow: 1, minWidth: 100 },
  previewRow: { gap: 10, paddingVertical: 4 },
  previewWrap: { width: 140, position: "relative" },
  preview: {
    width: "100%",
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceHigh,
  },
  videoBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(11,28,48,0.7)",
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: "hidden",
  },
  remove: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(11,28,48,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  addMore: {
    width: 140,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surfaceLow,
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  caption: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    borderRadius: radii.md,
    padding: 12,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surfaceLowest,
    textAlignVertical: "top",
  },
  error: { color: colors.error, fontSize: 13 },
});
