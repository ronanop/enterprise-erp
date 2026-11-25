import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar } from "@/components/ui";
import { IconPlus } from "@/components/icons";
import { colors } from "@/theme/colors";
import type { EssStoryTrayAuthor } from "@/types/api";

type Props = {
  authors: EssStoryTrayAuthor[];
  onOpenAuthor: (author: EssStoryTrayAuthor) => void;
  onAddStory: () => void;
};

/** Instagram-style horizontal story rings above the feed. */
export function StoriesTray({ authors, onOpenAuthor, onAddStory }: Props) {
  const mine = authors.find((a) => a.is_me);
  const others = authors.filter((a) => !a.is_me);

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <StoryRing
          name={mine ? "Your story" : "Your story"}
          authorName={mine?.author_name ?? "You"}
          hasStory={Boolean(mine && mine.story_count > 0)}
          hasUnseen={Boolean(mine?.has_unseen)}
          isMe
          onPress={() => {
            if (mine && mine.story_count > 0) onOpenAuthor(mine);
            else onAddStory();
          }}
          onAdd={onAddStory}
        />
        {others.map((a) => (
          <StoryRing
            key={a.author_employee_id}
            name={a.author_name.split(" ")[0] || a.author_name}
            authorName={a.author_name}
            hasStory
            hasUnseen={a.has_unseen}
            onPress={() => onOpenAuthor(a)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function StoryRing({
  name,
  authorName,
  hasStory,
  hasUnseen,
  isMe,
  onPress,
  onAdd,
}: {
  name: string;
  authorName: string;
  hasStory: boolean;
  hasUnseen: boolean;
  isMe?: boolean;
  onPress: () => void;
  onAdd?: () => void;
}) {
  // Keep ring + add-badge as siblings (not nested Pressables) so RN-web
  // does not emit <button> inside <button>.
  const ringFace = (
    <View style={styles.avatarWrap}>
      <Avatar name={authorName} size="md" />
    </View>
  );

  return (
    <View style={styles.item}>
      <View style={styles.ringHit}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} story`}
          onPress={onPress}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          {hasStory ? (
            <LinearGradient
              colors={
                hasUnseen
                  ? ["#f09433", "#e6683c", "#dc2743", "#cc2366", "#bc1888"]
                  : ["#c3c6d7", "#c3c6d7"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ring}
            >
              <View style={styles.ringInner}>{ringFace}</View>
            </LinearGradient>
          ) : (
            <View style={[styles.ring, styles.ringEmpty]}>
              <View style={styles.ringInner}>{ringFace}</View>
            </View>
          )}
        </Pressable>
        {isMe ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add story"
            onPress={onAdd ?? onPress}
            style={styles.addBadge}
            hitSlop={6}
          >
            <IconPlus size={12} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} story`}
        onPress={onPress}
      >
        <Text style={styles.label} numberOfLines={1}>
          {name}
        </Text>
      </Pressable>
    </View>
  );
}

const RING = 68;
const INNER = 62;

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surfaceLowest,
    paddingTop: 10,
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 12,
    gap: 14,
    alignItems: "flex-start",
  },
  item: {
    width: 76,
    alignItems: "center",
    gap: 6,
  },
  ringHit: {
    width: RING,
    height: RING,
    position: "relative",
  },
  pressed: { opacity: 0.75 },
  ring: {
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  ringEmpty: {
    backgroundColor: colors.outlineVariant,
  },
  ringInner: {
    width: INNER,
    height: INNER,
    borderRadius: INNER / 2,
    backgroundColor: colors.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarWrap: {
    position: "relative",
  },
  addBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.onSurface,
    textAlign: "center",
    width: "100%",
  },
});
