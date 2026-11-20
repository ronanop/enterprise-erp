import { Image, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

type Props = {
  height?: number;
  href?: string;
};

/** Official CACHE mark — mirrors PWA CacheBrandLogo. */
export function CacheBrandLogo({ height = 40, href = "/(tabs)/home" }: Props) {
  const router = useRouter();
  const width = Math.round(height * (992 / 394));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="CACHE — Endeavouring Perfection"
      onPress={() => router.push(href as never)}
      style={{ width, height }}
    >
      <Image
        source={require("../../assets/images/brand/cache-logo-full.png")}
        style={styles.img}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  img: { width: "100%", height: "100%" },
});
