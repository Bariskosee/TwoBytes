import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DensityBand, MapResponse } from "@/api/contract";
import { loadMap } from "@/api/demo-map";
import { useApi } from "@/api/useApi";
import { DensityMap } from "@/components/density-map";
import { Button, ErrorNotice, Loading, Notice, Section, Small, Subhead } from "@/components/ui";
import { bandColor } from "@/lib/band-colors";
import { bandInfo, formatDay } from "@/lib/format";
import { centroidOf } from "@/lib/map-geometry";
import { colors, elevation, font, maxContentWidth, minTouch, radius, space } from "@/theme";

/**
 * Bant işareti. Üç mor ton dolu kutudur. "Yetersiz veri" içi boş, gri kesik çizgili nötr kutudur.
 * İşaret tek başına anlam taşımaz, yanında her zaman metin etiketi yazar.
 */
function BandMark({ band }: { band: DensityBand }) {
  return (
    <View
      style={[
        styles.mark,
        band === "insufficient_data" ? styles.markInsufficient : { backgroundColor: bandColor[band] },
      ]}
    />
  );
}

export default function MapScreen() {
  const { state, reload } = useApi<MapResponse>(loadMap);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { height: windowHeight } = useWindowDimensions();
  // Küçük, etkileşimli harita. İlk açılışta altındaki listenin birkaç satırı görünür kalır.
  const mapHeight = Math.min(Math.max(Math.round(windowHeight * 0.28), 190), 280);

  const areas = state.status === "success" ? state.data.areas : [];
  const period = state.status === "success" ? state.data.period : null;
  const selected = areas.find((area) => area.id === selectedId) ?? null;
  const selectedCenter = selected ? centroidOf(selected.boundary) : null;

  // Bölgenin ortası yaklaşık konumdur. Bildir ekranı onu alır, kullanıcı orada değiştirebilir.
  function reportInSelected() {
    if (!selected || !selectedCenter) return;
    router.navigate({
      pathname: "/bildir",
      params: {
        lat: String(selectedCenter.latitude),
        lng: String(selectedCenter.longitude),
        area: selected.name,
        // Aynı bölge için art arda gelişte de parametre değişsin diye.
        n: String(Date.now()),
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          {state.status === "loading" && <Loading label="Harita özeti yükleniyor" />}
          {state.status === "error" && (
            <ErrorNotice message={state.message} detail={state.detail} onRetry={reload} />
          )}

          {state.status === "success" &&
            (areas.length === 0 ? (
              <Section>
                <Notice kind="info">
                  Gösterilecek bölge yok. Haftalık özet yayımlandığında bölgeler burada görünür.
                </Notice>
                <Button label="Yenile" variant="secondary" onPress={reload} />
              </Section>
            ) : (
              <>
                {/* Gölge dış kapsayıcıda, yuvarlatma ve kırpma iç kapsayıcıda (DensityMap).
                    Harita sağlayıcısının atıf yazısı haritanın içinde kalır, üzerine hiçbir öğe konmaz. */}
                <View style={styles.mapShadow}>
                  <DensityMap areas={areas} selectedId={selectedId} onSelect={setSelectedId} height={mapHeight} />
                </View>

                <View style={styles.listSection}>
                  <View style={styles.listHeader}>
                    <Subhead>Bölgeler</Subhead>
                    <Small>
                      {period
                        ? `${formatDay(period.start)} – ${formatDay(period.end)} haftası · haftalık bildirim sayısı`
                        : "Henüz yayımlanmış bir hafta yok."}
                    </Small>
                  </View>

                  <View style={styles.list}>
                    {areas.map((area) => {
                      const isSelected = area.id === selectedId;
                      return (
                        <Pressable
                          key={area.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${area.name}: ${bandInfo[area.band].label}`}
                          accessibilityHint="Haritada bölgeyi seçer"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => setSelectedId(area.id)}
                          style={({ pressed }) => [
                            styles.row,
                            isSelected && styles.rowSelected,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text numberOfLines={2} style={[styles.areaName, isSelected && styles.areaNameSelected]}>
                            {area.name}
                          </Text>
                          <View style={styles.bandCell}>
                            <BandMark band={area.band} />
                            <Text style={styles.bandLabel}>{bandInfo[area.band].short}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </>
            ))}
        </View>
      </ScrollView>

      {/* Alt işlem alanı: sekme çubuğundan ayrı, gölgeli yüzen kart. Liste kaydırma alanının dışında durur, son satırı kapatmaz. */}
      {state.status === "success" && areas.length > 0 && (
        <View style={styles.barWrap}>
          <View style={styles.bar}>
            <View accessibilityLiveRegion="polite" style={styles.barSummary}>
              {selected ? (
                <>
                  <Text numberOfLines={1} style={styles.barName}>
                    {selected.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.barBand}>
                    {bandInfo[selected.band].label}
                  </Text>
                </>
              ) : (
                <Text style={styles.barHint}>Önce haritadan veya listeden bir bölge seçin.</Text>
              )}
            </View>
            <Button label="Seçili bölgede bildir" onPress={reportInSelected} disabled={!selectedCenter} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
    padding: space.s3,
    paddingBottom: space.s4,
    gap: space.s3,
  },
  // Dış kapsayıcı: gölge ve arka plan. Köşeyi kırpan DensityMap'in kendisidir.
  mapShadow: {
    borderRadius: radius.panel,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  mark: { width: 14, height: 14, borderRadius: 4 },
  markInsufficient: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.insufficient,
    borderStyle: "dashed",
  },
  listSection: { gap: space.s2 },
  listHeader: { gap: 2 },
  list: { gap: space.s1 },
  // Sakin satır: beyaz yüzey ve ince kenarlık. Seçili satırı dolgu (lavanta) ve mor kenarlık ayırır.
  row: {
    minHeight: minTouch + 4,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowSelected: { backgroundColor: colors.selected, borderColor: colors.action },
  pressed: { opacity: 0.85 },
  areaName: { ...font.body, fontWeight: "600", color: colors.text, flex: 1 },
  areaNameSelected: { fontWeight: "700" },
  bandCell: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  bandLabel: { ...font.body, fontWeight: "600", color: colors.text, textAlign: "right" },
  // Alt işlem alanı. Zemin lavanta, kart beyaz ve gölgeli: sekme çubuğundan (beyaz, ince çizgi) açıkça ayrılır.
  barWrap: {
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
    paddingHorizontal: space.s3,
    paddingTop: space.s3,
    paddingBottom: space.s3,
  },
  bar: {
    gap: space.s2,
    padding: space.s3,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...elevation.bar,
  },
  barSummary: { minHeight: 36, justifyContent: "center" },
  barName: { ...font.subhead, fontWeight: "700", color: colors.text },
  barBand: { ...font.small, fontWeight: "600", color: colors.muted },
  barHint: { ...font.body, color: colors.muted },
});
