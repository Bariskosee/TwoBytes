import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ApiRequestError, describeDetail, describeError, trackCode } from "@/api/client";
import type { ReportStatus, TrackResponse } from "@/api/contract";
import { StatusTrack } from "@/components/status-track";
import { Body, Button, Card, Field, Loading, Notice, Screen, Section, Small, StatusBlock } from "@/components/ui";
import { formatDay, formatInstant, statusLabels } from "@/lib/format";
import { colors, font, space } from "@/theme";

type Result =
  | { status: "idle" }
  | { status: "loading" }
  // `field` doğruysa hata kod alanının altında, değilse bildirim kutusunda gösterilir.
  | { status: "error"; message: string; detail?: string; field: boolean }
  | { status: "success"; data: TrackResponse };

const blockTone: Record<ReportStatus, "neutral" | "progress" | "done"> = {
  in_review: "neutral",
  measure_planned: "progress",
  completed: "done",
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>
        {value}
      </Text>
    </View>
  );
}

export default function TrackScreen() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>({ status: "idle" });

  const canSubmit = code.trim().length > 0 && result.status !== "loading";

  async function lookUp() {
    if (!canSubmit) return;
    setResult({ status: "loading" });
    try {
      const { data } = await trackCode(code.trim());
      setResult({ status: "success", data });
    } catch (error) {
      // Girilen kod ekranda kalır. Düzeltmek tek adım olsun.
      setResult({
        status: "error",
        message: describeError(error),
        detail: describeDetail(error),
        field: error instanceof ApiRequestError && error.code === "invalid_code",
      });
    }
  }

  const fieldError = result.status === "error" && result.field ? result.message : null;

  return (
    <Screen intro="Bildirimden sonra ekranda gösterilen kodu yazın.">
      {/* Kod alanı ve düğme ekranın üstünde bir arada durur. */}
      <Section>
        <Field
          label="Takip kodu"
          hint="Örnek: ABCD-EFGH-JKMN. Büyük küçük harf ve tire fark etmez."
          value={code}
          onChangeText={setCode}
          error={fieldError}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          returnKeyType="search"
          onSubmitEditing={lookUp}
          style={styles.codeInput}
        />
        <Button
          label="Durumu göster"
          onPress={lookUp}
          loading={result.status === "loading"}
          disabled={code.trim().length === 0}
        />
        {code.trim().length === 0 && result.status === "idle" && <Small>Kodu yazınca düğme açılır.</Small>}
      </Section>

      <View accessibilityLiveRegion="polite" style={styles.result}>
        {result.status === "loading" && <Loading label="Durum sorgulanıyor" />}

        {result.status === "error" && !result.field && (
          <Section>
            <Notice kind="error">{result.message}</Notice>
            {result.detail ? <Small>Teknik ayrıntı: {result.detail}</Small> : null}
          </Section>
        )}

        {result.status === "success" && (
          <>
            <StatusBlock
              tone={blockTone[result.data.status]}
              caption={result.data.institutionName.toLocaleUpperCase("tr-TR")}
              headline={statusLabels[result.data.status]}
            >
              <StatusTrack status={result.data.status} />
            </StatusBlock>

            <Card>
              {result.data.measure ? (
                <View style={styles.details}>
                  <Detail label="Önlem" value={result.data.measure.title} />
                  <Detail label="Sorumlu birim" value={result.data.measure.responsibleUnit} />
                  <Detail label="Hedef tarih" value={formatDay(result.data.measure.targetDate)} />
                  {result.data.measure.completedAt && (
                    <Detail label="Tamamlanma" value={formatInstant(result.data.measure.completedAt)} />
                  )}
                  {result.data.measure.outcomeSummary && (
                    <Detail label="Sonuç" value={result.data.measure.outcomeSummary} />
                  )}
                </View>
              ) : (
                <Body muted>
                  Bu bildirim henüz bir önleme bağlanmadı. Kurum inceledikçe durum burada güncellenir.
                </Body>
              )}
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeInput: { ...font.subhead, fontWeight: "600", letterSpacing: 1.5 },
  result: { gap: space.s3 },
  details: { gap: space.s3 },
  detail: { gap: 2 },
  detailLabel: { ...font.small, fontWeight: "700", color: colors.muted },
  detailValue: { ...font.body, color: colors.text },
});
