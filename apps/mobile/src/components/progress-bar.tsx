import { StyleSheet, View } from "react-native";
import { colors } from "@/theme";

/**
 * Yatay doluluk çubuğu. Asıl bilgi her zaman yanındaki metindedir, çubuk ekran okuyucudan gizlenir.
 * `fraction` 0 ile 1 arasındadır.
 */
export function ProgressBar({ fraction, color }: { fraction: number; color: string }) {
  const percent = Math.round(Math.min(Math.max(fraction, 0), 1) * 100);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%" },
});
