import { StyleSheet, Text, View } from "react-native";
import type { ReportStatus } from "@/api/contract";
import { statusLabels, statusOrder } from "@/lib/format";
import { colors, font, radius, space } from "@/theme";

/**
 * Bildirimin üç aşamadaki yerini gösterir: İncelemede, Önlem planlandı, Tamamlandı.
 * Koyu veya renkli bir blok üzerinde kullanılır (beyaz çubuk ve yazı).
 * Anlam çubuğun renginde değil, altındaki metinlerde ve ekran okuyucunun okuduğu cümlededir.
 */
export function StatusTrack({ status }: { status: ReportStatus }) {
  const current = statusOrder.indexOf(status);

  return (
    <View
      accessible
      accessibilityLabel={`Durum: ${statusLabels[status]}. ${statusOrder.length} aşamadan ${current + 1}. aşama.`}
      style={styles.track}
    >
      {statusOrder.map((step, index) => {
        const reached = index <= current;
        return (
          <View key={step} style={styles.step}>
            <View style={[styles.bar, reached && styles.barReached]} />
            <Text style={[styles.label, index === current && styles.labelCurrent]}>{statusLabels[step]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", gap: space.s2 },
  step: { flex: 1, gap: space.s1 },
  bar: {
    height: 8,
    borderRadius: radius.control / 2,
    borderWidth: 1,
    borderColor: colors.onInverseMuted,
  },
  barReached: { backgroundColor: colors.onInverse, borderColor: colors.onInverse },
  label: { ...font.small, color: colors.onInverseMuted },
  labelCurrent: { fontWeight: "700", color: colors.onInverse },
});
