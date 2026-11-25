import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type PanResponderGestureState,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { IconClose, IconPlus } from "@/components/icons";
import { ApiClientError } from "@/services/api-client";
import { essService } from "@/services/ess-service";
import { colors, radii } from "@/theme/colors";
import type {
  EssStoryMentionSearchHit,
  EssStoryOverlay,
} from "@/types/api";

const MAX_VIDEO_SECONDS = 15;
const DEFAULT_FONT = 22;
const MIN_FONT = 12;
const MAX_FONT = 96;
const TEXT_COLORS = [
  "#ffffff",
  "#111111",
  "#FFD60A",
  "#FF453A",
  "#30D158",
  "#64D2FF",
  "#BF5AF2",
];
const BG_COLORS = [
  "#000000",
  "#ffffff",
  "#FF453A",
  "#FFD60A",
  "#30D158",
  "#0A84FF",
  "#BF5AF2",
];

type LocalMention = { employee_id: string; display_name: string; email?: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onPublished: () => void;
};

function clamp01(n: number) {
  return Math.min(0.94, Math.max(0.06, n));
}

function clampFont(n: number) {
  return Math.round(Math.min(MAX_FONT, Math.max(MIN_FONT, n)));
}

/** Create a vertical Instagram-style Story with draggable text + @mentions. */
export function StoryComposer({ visible, onClose, onPublished }: Props) {
  const insets = useSafeAreaInsets();
  const [uri, setUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [fileName, setFileName] = useState("story.jpg");
  const [duration, setDuration] = useState<number | null>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overlays, setOverlays] = useState<EssStoryOverlay[]>([]);
  const [mentions, setMentions] = useState<LocalMention[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [bgEnabled, setBgEnabled] = useState(true);
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [colorTarget, setColorTarget] = useState<"text" | "bg">("text");
  const [mentionHits, setMentionHits] = useState<EssStoryMentionSearchHit[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [activeStickerId, setActiveStickerId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const editingIdRef = useRef(editingId);
  editingIdRef.current = editingId;
  const activeStickerIdRef = useRef(activeStickerId);
  activeStickerIdRef.current = activeStickerId;
  const pinchSession = useRef<{
    id: string;
    startDist: number;
    startFont: number;
  } | null>(null);

  const editing = useMemo(
    () => overlays.find((o) => o.id === editingId) ?? null,
    [overlays, editingId],
  );

  function touchDistance(e: GestureResponderEvent) {
    const touches = e.nativeEvent.touches;
    if (touches.length < 2) return 0;
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  }

  function resolvePinchTargetId() {
    return (
      editingIdRef.current ??
      activeStickerIdRef.current ??
      overlaysRef.current[overlaysRef.current.length - 1]?.id ??
      null
    );
  }

  function beginStagePinch(e: GestureResponderEvent) {
    if (e.nativeEvent.touches.length < 2) return;
    const id = resolvePinchTargetId();
    if (!id) return;
    const row = overlaysRef.current.find((o) => o.id === id);
    if (!row) return;
    const dist = touchDistance(e);
    if (dist < 12) return;
    pinchSession.current = {
      id,
      startDist: dist,
      startFont: row.font_size || DEFAULT_FONT,
    };
  }

  function moveStagePinch(e: GestureResponderEvent) {
    const session = pinchSession.current;
    if (!session) {
      if (e.nativeEvent.touches.length >= 2) beginStagePinch(e);
      return;
    }
    if (e.nativeEvent.touches.length < 2) {
      pinchSession.current = null;
      return;
    }
    const dist = touchDistance(e);
    if (session.startDist < 12) return;
    const next = clampFont(session.startFont * (dist / session.startDist));
    patchOverlay(session.id, { font_size: next });
  }

  function endStagePinch(e: GestureResponderEvent) {
    if (e.nativeEvent.touches.length < 2) {
      pinchSession.current = null;
    }
  }

  function reset() {
    setUri(null);
    setMediaType("image");
    setFileName("story.jpg");
    setDuration(null);
    setWidth(null);
    setHeight(null);
    setError(null);
    setBusy(false);
    setOverlays([]);
    setMentions([]);
    setEditingId(null);
    setActiveStickerId(null);
    setDraftText("");
    setTextColor(TEXT_COLORS[0]);
    setBgEnabled(true);
    setBgColor(BG_COLORS[0]);
    setColorTarget("text");
    setMentionHits([]);
    setMentionOpen(false);
    pinchSession.current = null;
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function pick(kind: "image" | "video") {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === "image" ? ["images"] : ["videos"],
      allowsEditing: true,
      aspect: kind === "image" ? [9, 16] : undefined,
      quality: 0.9,
      videoMaxDuration: MAX_VIDEO_SECONDS,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (kind === "video") {
      const raw = Math.round(asset.duration ?? 0);
      const seconds = raw > MAX_VIDEO_SECONDS * 2 ? Math.round(raw / 1000) : raw;
      if (seconds > MAX_VIDEO_SECONDS) {
        setError(`Story videos must be ${MAX_VIDEO_SECONDS}s or shorter.`);
        return;
      }
      setDuration(seconds || null);
    } else {
      setDuration(null);
    }
    setMediaType(kind);
    setUri(asset.uri);
    setFileName(
      asset.fileName ??
        (kind === "video" ? `story-${Date.now()}.mp4` : `story-${Date.now()}.jpg`),
    );
    setWidth(asset.width ?? null);
    setHeight(asset.height ?? null);
  }

  function patchOverlay(id: string, patch: Partial<EssStoryOverlay>) {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  function addTextSticker() {
    const id = `ov-${Date.now()}`;
    const next: EssStoryOverlay = {
      id,
      text: "Tap to edit",
      x: 0.5,
      y: 0.42 + overlays.length * 0.06,
      color: textColor,
      font_size: DEFAULT_FONT,
      background_enabled: bgEnabled,
      background_color: bgColor,
    };
    setOverlays((prev) => [...prev, next].slice(0, 8));
    setEditingId(id);
    setActiveStickerId(id);
    setDraftText("");
    setColorTarget("text");
  }

  function openEdit(o: EssStoryOverlay) {
    setEditingId(o.id);
    setActiveStickerId(o.id);
    setDraftText(o.text === "Tap to edit" ? "" : o.text);
    setTextColor(o.color);
    setBgEnabled(Boolean(o.background_enabled));
    setBgColor(o.background_color || BG_COLORS[0]);
    setColorTarget("text");
  }

  function commitDraft() {
    if (!editingId) return;
    const cleaned = draftText.trim();
    if (!cleaned) {
      setOverlays((prev) => prev.filter((o) => o.id !== editingId));
    } else {
      patchOverlay(editingId, {
        text: cleaned,
        color: textColor,
        background_enabled: bgEnabled,
        background_color: bgColor,
      });
    }
    setEditingId(null);
    setDraftText("");
    setMentionOpen(false);
    setMentionHits([]);
  }

  function onDraftChange(value: string) {
    setDraftText(value);
    if (editingId) {
      patchOverlay(editingId, { text: value || " " });
    }
    const at = value.lastIndexOf("@");
    if (at < 0) {
      setMentionOpen(false);
      setMentionHits([]);
      return;
    }
    const after = value.slice(at + 1);
    if (after.includes(" ") || after.length < 1) {
      setMentionOpen(false);
      setMentionHits([]);
      return;
    }
    setMentionOpen(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void essService
        .searchStoryMentions(after)
        .then((res) => setMentionHits(res.data ?? []))
        .catch(() => setMentionHits([]));
    }, 180);
  }

  function pickMention(hit: EssStoryMentionSearchHit) {
    const at = draftText.lastIndexOf("@");
    const prefix = at >= 0 ? draftText.slice(0, at) : draftText;
    const nextText = `${prefix}@${hit.display_name} `;
    setDraftText(nextText);
    if (editingId) patchOverlay(editingId, { text: nextText });
    setMentions((prev) => {
      if (prev.some((m) => m.employee_id === hit.employee_id)) return prev;
      return [
        ...prev,
        {
          employee_id: hit.employee_id,
          display_name: hit.display_name,
          email: hit.email,
        },
      ];
    });
    setMentionOpen(false);
    setMentionHits([]);
  }

  function applySwatch(c: string) {
    if (colorTarget === "text") {
      setTextColor(c);
      if (editingId) patchOverlay(editingId, { color: c });
    } else {
      setBgColor(c);
      setBgEnabled(true);
      if (editingId) {
        patchOverlay(editingId, {
          background_color: c,
          background_enabled: true,
        });
      }
    }
  }

  function toggleBackground() {
    const next = !bgEnabled;
    setBgEnabled(next);
    if (editingId) patchOverlay(editingId, { background_enabled: next });
    if (next) setColorTarget("bg");
    else setColorTarget("text");
  }

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  async function publish() {
    if (!uri) {
      setError("Pick a photo or video first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const content_base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const finalOverlays = overlays
        .map((o) => {
          if (o.id === editingId) {
            const text = draftText.trim() || o.text;
            return {
              ...o,
              text,
              color: textColor,
              background_enabled: bgEnabled,
              background_color: bgColor,
            };
          }
          return o;
        })
        .filter((o) => o.text.trim() && o.text !== "Tap to edit" && o.text !== " ");

      const joined = finalOverlays.map((o) => o.text).join(" ");
      const usedMentions = mentions.filter((m) =>
        joined.toLowerCase().includes(`@${m.display_name.toLowerCase()}`),
      );

      await essService.createStory({
        media_type: mediaType,
        file_name: fileName,
        content_base64,
        caption: null,
        width,
        height,
        duration_seconds: duration,
        overlays: finalOverlays,
        mentions: usedMentions.map((m) => ({
          employee_id: m.employee_id,
          display_name: m.display_name,
        })),
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
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.top}>
          <Pressable onPress={close} hitSlop={10} disabled={busy}>
            <IconClose size={22} color="#fff" />
          </Pressable>
          <Text style={styles.title}>New story</Text>
          <Pressable
            onPress={() => void publish()}
            disabled={!uri || busy}
            style={[styles.shareChip, (!uri || busy) && styles.shareDisabled]}
          >
            <Text style={styles.shareText}>{busy ? "…" : "Share"}</Text>
          </Pressable>
        </View>

        {!uri ? (
          <View style={[styles.body, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.hint}>
              Vertical photo (9:16) or video up to {MAX_VIDEO_SECONDS}s. Add text,
              drag it anywhere, pick colors, and @mention people. Expires in 24
              hours.
            </Text>
            <View style={styles.pickRow}>
              <Button
                title="Photo"
                variant="secondary"
                disabled={busy}
                onPress={() => void pick("image")}
                style={styles.pickBtn}
              />
              <Button
                title="Video"
                variant="secondary"
                disabled={busy}
                onPress={() => void pick("video")}
                style={styles.pickBtn}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : (
          <View style={styles.editor}>
            <View
              style={styles.stage}
              collapsable={false}
              onLayout={(e: LayoutChangeEvent) => {
                const { width: w, height: h } = e.nativeEvent.layout;
                setStageSize({ w, h });
              }}
              onTouchStart={beginStagePinch}
              onTouchMove={moveStagePinch}
              onTouchEnd={endStagePinch}
              onTouchCancel={endStagePinch}
            >
              <Image
                source={{ uri }}
                style={styles.media}
                resizeMode="cover"
                pointerEvents="none"
              />
              {overlays.map((o) => (
                <DraggableSticker
                  key={o.id}
                  overlay={
                    o.id === editingId
                      ? {
                          ...o,
                          text: draftText || o.text,
                          color: textColor,
                          background_enabled: bgEnabled,
                          background_color: bgColor,
                        }
                      : o
                  }
                  stageW={stageSize.w}
                  stageH={stageSize.h}
                  selected={
                    o.id === editingId || o.id === activeStickerId
                  }
                  onSelect={() => openEdit(o)}
                  onMove={(x, y) => {
                    setActiveStickerId(o.id);
                    patchOverlay(o.id, { x, y });
                  }}
                  onPinchResize={(fontSize) => {
                    setActiveStickerId(o.id);
                    patchOverlay(o.id, { font_size: fontSize });
                  }}
                />
              ))}

              {editing ? (
                <View style={styles.editPanel}>
                  <Text style={styles.dragHint}>
                    Drag text to move · Two-finger pinch anywhere on the photo
                    to resize
                  </Text>
                  <TextInput
                    value={draftText}
                    onChangeText={onDraftChange}
                    placeholder="Text or emoji… type @ to mention"
                    placeholderTextColor="rgba(255,255,255,0.55)"
                    style={styles.editInput}
                    autoFocus
                    multiline
                    maxLength={280}
                  />

                  <View style={styles.sizeRow}>
                    <Pressable
                      onPress={() => {
                        if (!editingId) return;
                        const cur =
                          overlays.find((x) => x.id === editingId)?.font_size ??
                          DEFAULT_FONT;
                        patchOverlay(editingId, {
                          font_size: clampFont(cur - 4),
                        });
                      }}
                      style={styles.sizeChip}
                    >
                      <Text style={styles.sizeChipText}>A−</Text>
                    </Pressable>
                    <Text style={styles.sizeValue}>
                      {overlays.find((x) => x.id === editingId)?.font_size ??
                        DEFAULT_FONT}
                      px
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (!editingId) return;
                        const cur =
                          overlays.find((x) => x.id === editingId)?.font_size ??
                          DEFAULT_FONT;
                        patchOverlay(editingId, {
                          font_size: clampFont(cur + 4),
                        });
                      }}
                      style={styles.sizeChip}
                    >
                      <Text style={styles.sizeChipText}>A+</Text>
                    </Pressable>
                  </View>

                  <View style={styles.modeRow}>
                    <Pressable
                      onPress={() => setColorTarget("text")}
                      style={[
                        styles.modeChip,
                        colorTarget === "text" && styles.modeChipOn,
                      ]}
                    >
                      <Text style={styles.modeText}>Text color</Text>
                    </Pressable>
                    <Pressable
                      onPress={toggleBackground}
                      style={[styles.modeChip, bgEnabled && styles.modeChipOn]}
                    >
                      <Text style={styles.modeText}>
                        {bgEnabled ? "Background on" : "Background off"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setBgEnabled(true);
                        setColorTarget("bg");
                        if (editingId) {
                          patchOverlay(editingId, { background_enabled: true });
                        }
                      }}
                      style={[
                        styles.modeChip,
                        colorTarget === "bg" && styles.modeChipOn,
                      ]}
                      disabled={!bgEnabled && colorTarget !== "bg"}
                    >
                      <Text style={styles.modeText}>Bg color</Text>
                    </Pressable>
                  </View>

                  <View style={styles.colorRow}>
                    {(colorTarget === "text" ? TEXT_COLORS : BG_COLORS).map(
                      (c) => {
                        const active =
                          colorTarget === "text" ? textColor === c : bgColor === c;
                        return (
                          <Pressable
                            key={`${colorTarget}-${c}`}
                            onPress={() => applySwatch(c)}
                            style={[
                              styles.swatch,
                              { backgroundColor: c },
                              active && styles.swatchActive,
                            ]}
                          />
                        );
                      },
                    )}
                    <Pressable onPress={commitDraft} style={styles.doneChip}>
                      <Text style={styles.doneText}>Done</Text>
                    </Pressable>
                  </View>

                  {mentionOpen ? (
                    <View style={styles.mentionBox}>
                      <FlatList
                        keyboardShouldPersistTaps="handled"
                        data={mentionHits}
                        keyExtractor={(item) => item.employee_id}
                        ListEmptyComponent={
                          <Text style={styles.mentionEmpty}>No matches</Text>
                        }
                        renderItem={({ item }) => (
                          <Pressable
                            onPress={() => pickMention(item)}
                            style={styles.mentionRow}
                          >
                            <Text style={styles.mentionName}>
                              {item.display_name}
                            </Text>
                            <Text style={styles.mentionEmail}>
                              {item.name_is_duplicate
                                ? item.email
                                : item.email || item.employee_code}
                            </Text>
                          </Pressable>
                        )}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View
              style={[styles.tools, { paddingBottom: insets.bottom + 12 }]}
            >
              <Pressable onPress={addTextSticker} style={styles.toolBtn}>
                <Text style={styles.toolAa}>Aa</Text>
                <Text style={styles.toolLabel}>Text</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  addTextSticker();
                  setDraftText("@");
                  setMentionOpen(true);
                }}
                style={styles.toolBtn}
              >
                <IconPlus size={18} color="#fff" />
                <Text style={styles.toolLabel}>Mention</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  reset();
                }}
                style={styles.toolBtn}
              >
                <Text style={styles.toolLabel}>Retake</Text>
              </Pressable>
            </View>
            {error ? <Text style={styles.errorPad}>{error}</Text> : null}
          </View>
        )}
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function fingerDistance(e: GestureResponderEvent) {
  const touches = e.nativeEvent.touches;
  if (touches.length < 2) return 0;
  return Math.hypot(
    touches[0].pageX - touches[1].pageX,
    touches[0].pageY - touches[1].pageY,
  );
}

function DraggableSticker({
  overlay,
  stageW,
  stageH,
  selected,
  onSelect,
  onMove,
  onPinchResize,
}: {
  overlay: EssStoryOverlay;
  stageW: number;
  stageH: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onPinchResize: (fontSize: number) => void;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const origin = useRef({ x: overlay.x, y: overlay.y });
  const moved = useRef(false);
  const pinch = useRef<{ startDist: number; startFont: number } | null>(null);
  const overlayRef = useRef(overlay);
  const stageRef = useRef({ w: stageW, h: stageH });
  const onPinchResizeRef = useRef(onPinchResize);
  const onMoveRef = useRef(onMove);
  const onSelectRef = useRef(onSelect);
  overlayRef.current = overlay;
  stageRef.current = { w: stageW, h: stageH };
  onPinchResizeRef.current = onPinchResize;
  onMoveRef.current = onMove;
  onSelectRef.current = onSelect;

  // PanResponder so multi-touch reaches us (RNGH Pinch is flaky in Android Modal).
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (
        e: GestureResponderEvent,
        g: PanResponderGestureState,
      ) =>
        e.nativeEvent.touches.length >= 2 ||
        Math.abs(g.dx) > 3 ||
        Math.abs(g.dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        origin.current = {
          x: overlayRef.current.x,
          y: overlayRef.current.y,
        };
        moved.current = false;
        pinch.current = null;
        if (e.nativeEvent.touches.length >= 2) {
          const dist = fingerDistance(e);
          if (dist >= 12) {
            pinch.current = {
              startDist: dist,
              startFont: overlayRef.current.font_size || DEFAULT_FONT,
            };
            moved.current = true;
          }
        }
      },
      onPanResponderMove: (
        e: GestureResponderEvent,
        g: PanResponderGestureState,
      ) => {
        if (e.nativeEvent.touches.length >= 2) {
          const dist = fingerDistance(e);
          if (!pinch.current) {
            if (dist >= 12) {
              pinch.current = {
                startDist: dist,
                startFont: overlayRef.current.font_size || DEFAULT_FONT,
              };
              moved.current = true;
            }
            return;
          }
          if (pinch.current.startDist < 12) return;
          onPinchResizeRef.current(
            clampFont(
              pinch.current.startFont * (dist / pinch.current.startDist),
            ),
          );
          return;
        }
        pinch.current = null;
        const { w, h } = stageRef.current;
        if (!w || !h) return;
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) moved.current = true;
        onMoveRef.current(
          clamp01(origin.current.x + g.dx / w),
          clamp01(origin.current.y + g.dy / h),
        );
      },
      onPanResponderRelease: () => {
        const wasPinch = Boolean(pinch.current);
        pinch.current = null;
        if (!moved.current && !wasPinch) onSelectRef.current();
      },
    }),
  ).current;

  if (!stageW || !stageH) return null;

  const left = overlay.x * stageW - box.w / 2;
  const top = overlay.y * stageH - box.h / 2;
  const hasBg = Boolean(overlay.background_enabled);
  const fontSize = overlay.font_size || DEFAULT_FONT;
  const padH = Math.max(8, Math.round(fontSize * 0.32));
  const padV = Math.max(4, Math.round(fontSize * 0.22));

  return (
    <View
      collapsable={false}
      {...pan.panHandlers}
      onLayout={(e) => {
        const { width: w, height: h } = e.nativeEvent.layout;
        if (w !== box.w || h !== box.h) setBox({ w, h });
      }}
      style={[
        styles.sticker,
        {
          left,
          top,
          minWidth: 48,
          minHeight: 48,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: padH,
          paddingVertical: padV,
          borderRadius: Math.max(6, Math.round(fontSize * 0.28)),
          backgroundColor: hasBg
            ? overlay.background_color || "#000"
            : "transparent",
          borderWidth: selected ? 1.5 : 0,
          borderColor: "rgba(255,255,255,0.85)",
        },
      ]}
    >
      <Text
        style={[
          styles.stickerText,
          {
            color: overlay.color,
            fontSize,
            textShadowColor: hasBg ? "transparent" : "rgba(0,0,0,0.55)",
          },
        ]}
      >
        {overlay.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: { fontSize: 17, fontWeight: "700", color: "#fff" },
  shareChip: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  shareDisabled: { opacity: 0.45 },
  shareText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 16, gap: 12 },
  hint: { fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 18 },
  pickRow: { flexDirection: "row", gap: 8 },
  pickBtn: { flex: 1 },
  editor: { flex: 1 },
  stage: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  media: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  sticker: {
    position: "absolute",
    maxWidth: 260,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 5,
  },
  stickerText: {
    fontWeight: "800",
    textAlign: "center",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  editPanel: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 14,
    padding: 10,
    gap: 8,
    zIndex: 8,
  },
  dragHint: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "600",
  },
  editInput: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    minHeight: 44,
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sizeChip: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sizeChipText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  sizeValue: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
    minWidth: 40,
    textAlign: "center",
  },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  modeChip: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modeChipOn: { backgroundColor: colors.primary },
  modeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  colorRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  swatchActive: { borderColor: "#fff", borderWidth: 2 },
  doneChip: {
    marginLeft: "auto",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  doneText: { fontWeight: "700", color: "#111", fontSize: 12 },
  mentionBox: {
    maxHeight: 160,
    backgroundColor: "rgba(20,20,20,0.95)",
    borderRadius: 10,
    overflow: "hidden",
  },
  mentionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  mentionName: { color: "#fff", fontWeight: "700", fontSize: 14 },
  mentionEmail: { color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 },
  mentionEmpty: {
    color: "rgba(255,255,255,0.55)",
    padding: 12,
    fontSize: 13,
  },
  tools: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 14,
    paddingHorizontal: 16,
  },
  toolBtn: { alignItems: "center", gap: 4, minWidth: 64 },
  toolAa: { color: "#fff", fontSize: 22, fontWeight: "800" },
  toolLabel: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "600" },
  error: { color: colors.error, fontSize: 13 },
  errorPad: {
    color: colors.error,
    fontSize: 13,
    textAlign: "center",
    paddingBottom: 8,
  },
});
