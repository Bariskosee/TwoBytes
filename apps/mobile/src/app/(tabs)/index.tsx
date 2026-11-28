import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { DensityBand, MapResponse } from "@/api/contract";
import { loadMap } from "@/api/demo-map";
import { useApi } from "@/api/useApi";
import { DensityMap } from "@/components/density-map";
import { Button, ErrorNotice, Loading, Notice, Screen, Section, Small } from "@/components/ui";
import { bandColor } from "@/lib/band-colors";
import { bandInfo, formatDay } from "@/lib/format";
import { colors, focusWidth, font, minTouch, radius, space } from "@/theme";

/** Satırın sol kenarındaki bant şeridi. Yetersiz veri gri ve kesik çizgilidir. */
function BandStripe({ band }: { band: DensityBand }) {
  return (
    <View
      style={[
        styles.stripe,
        band === "insufficient_data" ? styles.stripeInsufficient : { backgroundColor: bandColor[band] },
      ]}
    />
  );
}

/** Lejant: açıktan koyuya üç mor ton ve ayrı bir gri kesik çizgili "Yetersiz veri". Her renk yazıyla da yazılır. */
function Legend() {
  const scale: DensityBand[] = ["5-9", "10-19", "20+"];
  return (
    <View
      accessible
      accessibilityLabel="Lejant. Haftalık bildirim sayısı: 5–9, 10–19 ve 20 ve üzeri. Renk koyulaştıkça sayı artar. Yetersiz veri ayrıca gösterilir."
      style={styles.legend}
    >
      <Text style={styles.legendTitle}>Haftalık bildirim</Text>
      <View style={styles.legendItems}>
        {scale.map((band) => (
          <View key={band} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: bandColor[band] }]} />
            <Text style={styles.legendText}>{bandInfo[band].short}</Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.swatch, styles.swatchInsufficient]} />
          <Text style={styles.legendText}>Yetersiz veri</Text>
        </View>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const { state, reload } = useApi<MapResponse>(loadMap);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  // Harita ekranın yaklaşık yarısını kaplar. Küçük telefonda da liste ve özet aşağıda görünür kalır.
  const mapHeight = Math.min(Math.max(Math.round(windowHeight * 0.46), 300), 460);

  const period = state.status === "success" ? state.data.period : null;
  const intro =
    state.status !== "success"
      ? "Bölgelerin haftalık bildirim yoğunluğu."
      : period
        ? `${formatDay(period.start)} – ${formatDay(period.end)} haftası (İstanbul saati)`
        : "Henüz yayımlanmış bir hafta yok.";

  return (
    <Screen intro={intro}>
      {state.status === "loading" && <Loading label="Harita özeti yükleniyor" />}
      {state.status === "error" && <ErrorNotice message={state.message} detail={state.detail} onRetry={reload} />}

      {state.status === "success" && (
        <>
          {state.sample && (
            <Notice kind="info">
              Örnek veri gösteriliyor. Bantlar gerçek bildirim sayılarından hesaplanmadı.
            </Notice>
          )}

          {state.data.areas.length === 0 ? (
            <Section>
              <Notice kind="info">
                Gösterilecek bölge yok. Haftalık özet yayımlandığında bölgeler burada görünür.
              </Notice>
              <Button label="Yenile" variant="secondary" onPress={reload} />
            </Section>
          ) : (
            <>
              {/* Harita ve altındaki özet bir arada durur. Harita sağlayıcısının atıf yazısı haritanın içinde, hiçbir şeyle örtülmez. */}
              <View style={styles.mapGroup}>
                <DensityMap
                  areas={state.data.areas}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  height={mapHeight}
                />

                <View accessibilityLiveRegion="polite" style={styles.selected}>
                  {(() => {
                    const selected = state.data.areas.find((area) => area.id === selectedId);
                    return selected ? (
                      <>
                        <BandStripe band={selected.band} />
                        <View style={styles.selectedText}>
                          <Text selectable style={styles.selectedName}>
                            {selected.name}
                          </Text>
                          <Text style={styles.selectedBand}>{bandInfo[selected.band].label}</Text>
                        </View>
                      </>
                    ) : (
                      <View style={styles.selectedText}>
                        <Text style={styles.selectedName}>Bir bölge seçin</Text>
                        <Small>Haritaya veya aşağıdaki listeye dokunun.</Small>
                      </View>
                    );
                  })()}
                </View>
              </View>

              <Legend />

              <View style={styles.list}>
                {state.data.areas.map((area) => {
                  const isSelected = area.id === selectedId;
                  return (
                    <Pressable
                      key={area.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${area.name}: ${bandInfo[area.band].label}`}
                      accessibilityHint="Haritada bölgeyi seçer"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setSelectedId(area.id)}
                      style={({ pressed }) => [styles.row, isSelected && styles.rowSelected, pressed && styles.pressed]}
                    >
                      <BandStripe band={area.band} />
                      <Text style={styles.areaName}>{area.name}</Text>
                      <Text style={styles.bandLabel}>{bandInfo[area.band].short}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stripe: { width: 6, alignSelf: "stretch" },
  stripeInsufficient: { backgroundColor: colors.hairline, borderRightWidth: 2, borderRightColor: colors.insufficient, borderStyle: "dashed" },
  mapGroup: { gap: space.s2 },
  selected: {
    minHeight: minTouch + space.s2,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.panel,
    overflow: "hidden",
  },
  selectedText: { flex: 1, paddingVertical: space.s2, paddingHorizontal: space.s3, justifyContent: "center" },
  selectedName: { ...font.subhead, fontWeight: "700", color: colors.text },
  selectedBand: { ...font.body, color: colors.text },
  legend: { gap: space.s1 },
  legendTitle: { ...font.small, fontWeight: "700", color: colors.muted },
  legendItems: { flexDirection: "row", flexWrap: "wrap", columnGap: space.s3, rowGap: space.s1 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.s1 },
  swatch: { width: 20, height: 14, borderRadius: 3 },
  swatchInsufficient: {
    backgroundColor: colors.hairline,
    borderWidth: 1,
    borderColor: colors.insufficient,
    borderStyle: "dashed",
  },
  legendText: { ...font.small, fontWeight: "600", color: colors.text },
  list: { gap: space.s1 },
  row: {
    minHeight: minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingRight: space.s3,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: "hidden",
  },
  rowSelected: { borderColor: colors.action, borderWidth: focusWidth, backgroundColor: colors.selected },
  pressed: { opacity: 0.85 },
  areaName: { ...font.body, fontWeight: "600", color: colors.text, flex: 1 },
  bandLabel: { ...font.body, fontWeight: "700", color: colors.text, textAlign: "right" },
});
