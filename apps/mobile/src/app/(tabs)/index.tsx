import { StyleSheet, Text, View } from "react-native";
import { getMap } from "@/api/client";
import type { MapResponse } from "@/api/contract";
import { useApi } from "@/api/useApi";
import { DensityBar } from "@/components/density-bar";
import { Body, Card, ErrorNotice, Loading, Notice, Screen, Small, Subhead, Title } from "@/components/ui";
import { bandInfo, formatDay } from "@/lib/format";
import { colors, font, space } from "@/theme";

export default function MapScreen() {
  const { state, reload } = useApi<MapResponse>(getMap);

  return (
    <Screen>
      <Title>Bildirim yoğunluğu</Title>

      {state.status === "loading" && <Loading label="Harita özeti yükleniyor" />}
      {state.status === "error" && <ErrorNotice message={state.message} onRetry={reload} />}

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
          </Card>

          {state.data.areas.length === 0 ? (
            <Notice kind="info">Gösterilecek bölge yok.</Notice>
          ) : (
            state.data.areas.map((area) => (
              <View
                key={area.id}
                accessible
                accessibilityLabel={`${area.name}: ${bandInfo[area.band].label}`}
                style={styles.row}
              >
                <View style={styles.rowText}>
                  <Text style={styles.areaName}>{area.name}</Text>
                  <Text style={styles.bandLabel}>{bandInfo[area.band].label}</Text>
                </View>
                <DensityBar band={area.band} />
              </View>
            ))
          )}

          <Small>
            Harita katmanı bir sonraki adımda eklenecek. Şimdilik bölgeler liste olarak gösteriliyor.
          </Small>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.s3,
    gap: space.s2,
  },
  rowText: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space.s2 },
  areaName: { ...font.body, fontWeight: "600", color: colors.text, flexShrink: 1 },
  bandLabel: { ...font.body, color: colors.text, textAlign: "right", flexShrink: 1 },
});
