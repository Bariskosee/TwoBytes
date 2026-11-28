import { StyleSheet, Text, View } from "react-native";
import { getScorecard } from "@/api/client";
import type { ScorecardResponse } from "@/api/contract";
import { useApi } from "@/api/useApi";
import { ProgressBar } from "@/components/progress-bar";
import { Button, ErrorNotice, Loading, Notice, Screen, Section } from "@/components/ui";
import { formatDay } from "@/lib/format";
import { colors, font, radius, space, tabularNums } from "@/theme";

export default function ScorecardScreen() {
  const { state, reload } = useApi<ScorecardResponse>(getScorecard);

  // Tarih aralığı açıklamada tek satırda, "kaç önlem" bilgisi kartlarda.
  const intro =
    state.status === "success"
      ? `${formatDay(state.data.period.start)} – ${formatDay(state.data.period.end)} (İstanbul saati)`
      : "Kurumların açtığı önlemlerin tamamlanma durumu.";

  return (
    <Screen intro={intro}>
      {state.status === "loading" && <Loading label="Karne yükleniyor" />}
      {state.status === "error" && <ErrorNotice message={state.message} detail={state.detail} onRetry={reload} />}

      {state.status === "success" && (
        <>
          {state.sample && (
            <Notice kind="info">Örnek veri gösteriliyor. Değerler gerçek önlem kayıtlarından hesaplanmadı.</Notice>
          )}

          {state.data.institutions.length === 0 ? (
            <Section>
              <Notice kind="info">Henüz gösterilecek kurum yok. Kurumlar önlem açtıkça burada görünür.</Notice>
              <Button label="Yenile" variant="secondary" onPress={reload} />
            </Section>
          ) : (
            <View style={styles.list}>
              {state.data.institutions.map((item) => {
                const rate = item.completionRate;
                const percent = rate === null ? 0 : Math.round(rate * 100);

                // Önlem kaydı olmayan kurum ayrı, sade bir durumdur: oran veya çubuk gösterilmez.
                if (rate === null) {
                  return (
                    <View key={item.institutionId} style={styles.emptyCard}>
                      <Text accessibilityRole="header" style={styles.name}>
                        {item.institutionName}
                      </Text>
                      <Text style={styles.emptyText}>Bu dönemde önlem kaydı yok</Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={item.institutionId}
                    accessible
                    accessibilityRole="progressbar"
                    accessibilityLabel={`${item.institutionName}: ${item.totalMeasures} önlemden ${item.completedMeasures} tanesi tamamlandı, yüzde ${percent}`}
                    accessibilityValue={{ min: 0, max: 100, now: percent }}
                    style={styles.card}
                  >
                    <Text style={styles.name}>{item.institutionName}</Text>
                    <View style={styles.figureRow}>
                      <Text style={styles.big}>
                        {item.completedMeasures}
                        <Text style={styles.bigTotal}> / {item.totalMeasures}</Text>
                      </Text>
                      <View style={styles.percentTag}>
                        <Text style={styles.percent}>%{percent}</Text>
                      </View>
                    </View>
                    <Text style={styles.unit}>önlem tamamlandı</Text>
                    <ProgressBar fraction={rate} color={colors.action} height={14} />
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.s3,
    gap: space.s2,
  },
  name: { ...font.subhead, fontWeight: "700", color: colors.text },
  figureRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.s2 },
  big: { ...font.display, ...tabularNums, fontWeight: "700", color: colors.action },
  bigTotal: { ...font.subhead, ...tabularNums, fontWeight: "600", color: colors.muted },
  percentTag: {
    backgroundColor: colors.selected,
    borderRadius: radius.control,
    paddingHorizontal: space.s3,
    paddingVertical: space.s1,
  },
  percent: { ...font.subhead, ...tabularNums, fontWeight: "700", color: colors.action },
  unit: { ...font.body, color: colors.text, marginTop: -space.s1 },
  emptyCard: {
    gap: space.s1,
    padding: space.s3,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    backgroundColor: colors.canvas,
  },
  emptyText: { ...font.body, color: colors.muted },
});
