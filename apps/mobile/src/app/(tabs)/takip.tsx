import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { describeError, trackCode } from "@/api/client";
import type { TrackResponse } from "@/api/contract";
import { Body, Button, Card, Field, Notice, Screen, Small, Subhead, Title } from "@/components/ui";
import { formatDay, formatInstant, statusLabels } from "@/lib/format";
import { colors, font, space } from "@/theme";

type Result =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; data: TrackResponse };

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
      setResult({ status: "error", message: describeError(error) });
    }
  }

  return (
    <Screen>
      <Title>Takip kodu sorgusu</Title>
      <Body muted>Bildirim gönderdikten sonra telefonda gösterilen kodu yazın.</Body>

      <Field
        label="Takip kodu"
        hint="Örnek: ABCD-EFGH-JKMN. Büyük küçük harf ve tire fark etmez."
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        returnKeyType="search"
        onSubmitEditing={lookUp}
      />
      <Button
        label="Durumu göster"
        onPress={lookUp}
        loading={result.status === "loading"}
        disabled={code.trim().length === 0}
      />
      {code.trim().length === 0 && <Small>Kodu yazınca düğme açılır.</Small>}

      {result.status === "error" && <Notice kind="error">{result.message}</Notice>}

      {result.status === "success" && (
        <Card>
          <Subhead>{result.data.institutionName}</Subhead>
          <Text style={styles.status}>{statusLabels[result.data.status]}</Text>
          {result.data.measure ? (
            <View style={styles.measure}>
              <Text style={styles.measureTitle}>{result.data.measure.title}</Text>
              <Body muted>Sorumlu birim: {result.data.measure.responsibleUnit}</Body>
              <Body muted>Hedef tarih: {formatDay(result.data.measure.targetDate)}</Body>
              {result.data.measure.completedAt && (
                <Body muted>Tamamlanma: {formatInstant(result.data.measure.completedAt)}</Body>
              )}
              {result.data.measure.outcomeSummary && <Body>{result.data.measure.outcomeSummary}</Body>}
            </View>
          ) : (
            <Body muted>Bu bildirim henüz bir önleme bağlanmadı.</Body>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { ...font.subhead, fontWeight: "700", color: colors.action },
  measure: { gap: space.s1 },
  measureTitle: { ...font.body, fontWeight: "600", color: colors.text },
});
