import { StyleSheet, View } from "react-native";
import type { DensityBand } from "@/api/contract";
import { bandInfo } from "@/lib/format";
import { colors } from "@/theme";

const fillColor: Record<DensityBand, string> = {
  "5-9": colors.bandLow,
  "10-19": colors.bandMid,
  "20+": colors.bandHigh,
  insufficient_data: colors.hairline,
};

/**
 * Yoğunluk bandının uzunluğu bant sırasını gösterir. Anlam yalnızca renkte değildir.
 * Satırın metni (bant etiketi) asıl bilgiyi taşır. Ekran okuyucudan gizlenir.
 */
export function DensityBar({ band }: { band: DensityBand }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.track}
    >
      <View
        style={[
          styles.fill,
          { width: `${Math.round(bandInfo[band].fill * 100)}%`, backgroundColor: fillColor[band] },
        ]}
      />
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
