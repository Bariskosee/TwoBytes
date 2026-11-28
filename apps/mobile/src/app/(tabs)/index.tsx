import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getMap } from "@/api/client";
import type { MapResponse } from "@/api/contract";
import { useApi } from "@/api/useApi";
import { DensityBar } from "@/components/density-bar";
import { DensityMap } from "@/components/density-map";
import { Body, Card, ErrorNotice, Loading, Notice, Screen, Small, Subhead, Title } from "@/components/ui";
import { bandColor, bandOrder } from "@/lib/band-colors";
import { bandInfo, formatDay } from "@/lib/format";
import { colors, font, space } from "@/theme";

export default function MapScreen() {
  const { state, reload } = useApi<MapResponse>(getMap);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Screen>
      <Title>Bildirim yoğunluğu</Title>

      {state.status === "loading" && <Loading label="Harita özeti yükleniyor" />}
      {state.status === "error" && <ErrorNotice message={state.message} detail={state.detail} onRetry={reload} />}

      {state.status === "success" && (
        <>
          {state.sample && (
            <Notice kind="info">
              Örnek veri gösteriliyor. Bantlar gerçek bildirim sayılarından hesaplanmadı.
            </Notice>
          )}

          <Card>
            <Subhead>Bildirim yoğunluğu</Subhead>
            {state.data.period ? (
              <Body muted>
                Veri dönemi: {formatDay(state.data.period.start)} – {formatDay(state.data.period.end)} (İstanbul saati)
              </Body>
            ) : (
              <Body muted>Henüz yayımlanmış bir hafta yok.</Body>
            )}
            <View style={styles.legend}>
              {bandOrder.map((band) => (
                <View key={band} style={styles.legendItem}>
                  <View
                    style={[
                      styles.swatch,
                      band === "insufficient_data"
                        ? styles.swatchDashed
                        : { backgroundColor: bandColor[band], borderColor: bandColor[band] },
                    ]}
                  />
                  <Text style={styles.legendText}>{bandInfo[band].label}</Text>
                </View>
              ))}
            </View>
          </Card>

          {state.data.areas.length === 0 ? (
            <Notice kind="info">Gösterilecek bölge yok.</Notice>
          ) : (
            <>
              <DensityMap areas={state.data.areas} selectedId={selectedId} onSelect={setSelectedId} />

              <View accessibilityLiveRegion="polite">
                {(() => {
                  const selected = state.data.areas.find((area) => area.id === selectedId);
                  return selected ? (
                    <Body>
                      Seçilen bölge: {selected.name}. {bandInfo[selected.band].label}.
                    </Body>
                  ) : (
                    <Small>Ayrıntı için haritada bir bölgeye dokunun.</Small>
                  );
                })()}
              </View>

              {state.data.areas.map((area) => (
                <View
                  key={area.id}
                  accessible
                  accessibilityLabel={`${area.name}: ${bandInfo[area.band].label}`}
                  style={[styles.row, area.id === selectedId && styles.rowSelected]}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.areaName}>{area.name}</Text>
                    <Text style={styles.bandLabel}>{bandInfo[area.band].label}</Text>
                  </View>
                  <DensityBar band={area.band} />
                </View>
              ))}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { gap: space.s2, marginTop: space.s1 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  swatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1 },
  swatchDashed: {
    backgroundColor: colors.hairline,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  legendText: { ...font.body, color: colors.text, flexShrink: 1 },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.s3,
    gap: space.s2,
  },
  rowSelected: { borderColor: colors.action, borderWidth: 2 },
  rowText: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.s2 },
  areaName: { ...font.body, fontWeight: "600", color: colors.text, flexShrink: 1 },
  bandLabel: { ...font.body, color: colors.text, textAlign: "right", flexShrink: 1 },
});
