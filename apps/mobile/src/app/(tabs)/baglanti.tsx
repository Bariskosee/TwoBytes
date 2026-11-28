import * as Crypto from "expo-crypto";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { apiBaseUrl, createReport, describeDetail, describeError, getMap } from "@/api/client";
import { Body, Button, CodeBox, Notice, Screen, Section, Small, Subhead, Tag } from "@/components/ui";
import { colors, font, radius, space } from "@/theme";

type Ping =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; detail?: string }
  | { status: "success"; httpStatus: number; durationMs: number; sample: boolean; areaCount: number };

type Send =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string; detail?: string }
  | { status: "success"; httpStatus: number; created: boolean; trackingCode: string };

// Kurgu test konumu: İskele ve Çarşı bölgesinin yaklaşık merkezi.
const TEST_LOCATION = { latitude: 40.992, longitude: 29.025 };

export default function ConnectionScreen() {
  const baseUrl = apiBaseUrl();
  const [ping, setPing] = useState<Ping>({ status: "idle" });
  const [send, setSend] = useState<Send>({ status: "idle" });
  // Ağ hatasında aynı gönderim kimliği korunur. Sunucu tek kayıt açar ve aynı kodu döndürür.
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  async function testConnection() {
    setPing({ status: "loading" });
    try {
      const result = await getMap();
      setPing({
        status: "success",
        httpStatus: result.status,
        durationMs: result.durationMs,
        sample: result.sample,
        areaCount: result.data.areas.length,
      });
    } catch (error) {
      setPing({ status: "error", message: describeError(error), detail: describeDetail(error) });
    }
  }

  async function sendTestReport(reuse: boolean) {
    const id = reuse && submissionId ? submissionId : Crypto.randomUUID();
    setSubmissionId(id);
    setSend({ status: "loading" });
    try {
      const result = await createReport({
        submissionId: id,
        location: TEST_LOCATION,
        occurredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        description: "Kurgu test kaydı: mobil bağlantı denemesi.",
      });
      setSend({
        status: "success",
        httpStatus: result.status,
        created: result.data.created,
        trackingCode: result.data.trackingCode,
      });
    } catch (error) {
      setSend({ status: "error", message: describeError(error), detail: describeDetail(error) });
    }
  }

  return (
    <Screen intro="Telefonun sunucuya ulaşıp ulaşamadığını burada denersiniz.">
      <View style={styles.address}>
        <Text style={styles.addressLabel}>API ADRESİ</Text>
        {baseUrl ? (
          <Text selectable style={styles.addressValue}>
            {baseUrl}
          </Text>
        ) : (
          <Notice kind="error">
            Adres ayarlanmamış. apps/mobile/.env.local dosyasına EXPO_PUBLIC_API_URL ekleyin ve uygulamayı yeniden başlatın.
          </Notice>
        )}
      </View>

      {/* 1. Güvenli işlem: yalnızca okur. */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Subhead>Bağlantıyı dene</Subhead>
          <Tag label="Veri yazmaz" />
        </View>
        <Body muted>Harita ucunu çağırır ve ne kadar sürdüğünü gösterir.</Body>
        <Button
          label="Bağlantıyı dene"
          onPress={testConnection}
          loading={ping.status === "loading"}
          disabled={!baseUrl}
        />
        {ping.status === "success" && (
          <Notice kind="success">
            Bağlandı. HTTP {ping.httpStatus}, {ping.durationMs} ms, {ping.areaCount} bölge
            {ping.sample ? ", örnek veri" : ""}.
          </Notice>
        )}
        {ping.status === "error" && (
          <Section>
            <Notice kind="error">{ping.message}</Notice>
            {ping.detail ? <Small>Teknik ayrıntı: {ping.detail}</Small> : null}
          </Section>
        )}
      </View>

      {/* 2. Veri yazan işlem: ayrı, kesik kenarlıklı kutuda. */}
      <View style={[styles.card, styles.writeCard]}>
        <View style={styles.cardHeader}>
          <Subhead>Test bildirimi gönder</Subhead>
          <Tag label="Veri yazar" />
        </View>
        <Body muted>
          Sunucunun veritabanına tek bir kurgu kayıt yazar. Kayıt kurum panelinde de görünebilir. Gerçek bir olayı
          bildirmez.
        </Body>
        <Button
          label="Test bildirimi gönder"
          onPress={() => sendTestReport(false)}
          loading={send.status === "loading"}
          disabled={!baseUrl}
        />
        {send.status === "success" && (
          <Section>
            <Notice kind="success">
              {send.created ? "Yeni kayıt oluşturuldu" : "Aynı gönderim tekrar edildi, yeni kayıt açılmadı"} (HTTP{" "}
              {send.httpStatus}).
            </Notice>
            <CodeBox code={send.trackingCode} />
            <Small>Kodu Takip sekmesinde yazarak durumu sorgulayabilirsiniz.</Small>
            <Button label="Aynı gönderimi tekrar dene" variant="secondary" onPress={() => sendTestReport(true)} />
          </Section>
        )}
        {send.status === "error" && (
          <Section>
            <Notice kind="error">{send.message}</Notice>
            {send.detail ? <Small>Teknik ayrıntı: {send.detail}</Small> : null}
            {submissionId && (
              <Button label="Aynı gönderimi tekrar dene" variant="secondary" onPress={() => sendTestReport(true)} />
            )}
          </Section>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  address: { gap: space.s1 },
  addressLabel: { ...font.small, fontWeight: "700", letterSpacing: 1, color: colors.muted },
  addressValue: { ...font.body, color: colors.text },
  card: {
    gap: space.s2,
    padding: space.s3,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  writeCard: { borderColor: colors.border, borderStyle: "dashed", backgroundColor: colors.infoSurface },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.s2 },
});
