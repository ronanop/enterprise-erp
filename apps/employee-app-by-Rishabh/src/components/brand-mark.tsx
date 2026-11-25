import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii } from "@/theme/colors";

const LOGO = require("../../assets/images/icon.png");

type BrandMarkProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Official iConnect Plus app mark (same asset as Expo icon). */
export function BrandMark({ size = 64, style }: BrandMarkProps) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radii.md }, style]}>
      <Image
        source={LOGO}
        style={{ width: size, height: size, borderRadius: radii.md }}
        accessibilityLabel="iConnect Plus"
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
});
