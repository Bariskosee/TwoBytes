import { StyleSheet, Text, View } from "react-native";
import { getScorecard } from "@/api/client";
import type { ScorecardResponse } from "@/api/contract";
import { useApi } from "@/api/useApi";
import { Body, Card, ErrorNotice, Loading, Notice, Screen, Subhead, Title } from "@/components/ui";
import { formatDay } from "@/lib/format";
import { colors, font, space } from "@/theme";

export default function ScorecardScreen() {
  const { state, reload } = useApi<ScorecardResponse>(getScorecard);

  return (
    <Screen>
      <Title>Kurum karnesi</Title>

      {state.status === "loading" && <Loading label="Karne yükleniyor" />}
      {state.status === "error" && <ErrorNotice message={state.message} detail={state.detail} onRetry={reload} />}

      {state.status === "success" && (
        <>
          {state.sample && (
            <Notice kind="info">Örnek veri gösteriliyor. Değerler gerçek önlem kayıtlarından hesaplanmadı.</Notice>
          )}
          <Body muted>
            Dönem: {formatDay(state.data.period.start)} – {formatDay(state.data.period.end)} (İstanbul saati)
          </Body>

          {state.data.institutions.length === 0 ? (
            <Notice kind="info">Henüz gösterilecek kurum yok.</Notice>
          ) : (
            state.data.institutions.map((item) => {
              const rate = item.completionRate;
              return (
                <Card key={item.institutionId}>
                  <Subhead>{item.institutionName}</Subhead>
                  {rate === null ? (
                    <Body muted>Bu dönemde önlem kaydı yok</Body>
                  ) : (
                    <View
                      accessible
                      accessibilityLabel={`${item.completedMeasures} / ${item.totalMeasures} önlem tamamlandı, yüzde ${Math.round(rate * 100)}`}
                      style={styles.figures}
                    >
                      <Text style={styles.big}>
                        {item.completedMeasures} / {item.totalMeasures}
                      </Text>
                      <Text style={styles.unit}>önlem tamamlandı · %{Math.round(rate * 100)}</Text>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  figures: { gap: space.s1 },
  big: { ...font.title, fontWeight: "700", color: colors.action },
  unit: { ...font.body, color: colors.text },
});
