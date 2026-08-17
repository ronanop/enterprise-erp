import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsub();
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>You&apos;re offline — some actions may fail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#fff3cd",
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#856404",
  },
});
