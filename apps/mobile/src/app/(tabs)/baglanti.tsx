import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Text } from "react-native";
import { apiBaseUrl, createReport, describeDetail, describeError, getMap } from "@/api/client";
import { Body, Button, Card, Notice, Screen, Small, Subhead, Title } from "@/components/ui";
import { colors, font } from "@/theme";

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
    <Screen>
      <Title>Bağlantı denemesi</Title>
      <Body muted>Telefonun sunucuya ulaşıp ulaşamadığını burada denersiniz.</Body>

      <Card>
        <Subhead>API adresi</Subhead>
        {baseUrl ? (
          <Text selectable style={{ ...font.body, color: colors.text }}>
            {baseUrl}
          </Text>
        ) : (
          <Notice kind="error">
            Adres ayarlanmamış. apps/mobile/.env.local dosyasına EXPO_PUBLIC_API_URL ekleyin ve uygulamayı yeniden başlatın.
          </Notice>
        )}
      </Card>

      <Card>
        <Subhead>1. Sunucuya ulaş</Subhead>
        <Body muted>Harita ucunu çağırır. Hiçbir kayıt oluşturmaz.</Body>
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
          <>
            <Notice kind="error">{ping.message}</Notice>
            {ping.detail ? <Small>Teknik ayrıntı: {ping.detail}</Small> : null}
          </>
        )}
      </Card>

      <Card>
        <Subhead>2. Test bildirimi gönder</Subhead>
        <Body muted>
          Test veritabanına tek bir kurgu kayıt yazar ve takip kodunu gösterir. Gerçek bir olayı bildirmez.
        </Body>
        <Button
          label="Test bildirimi gönder"
          onPress={() => sendTestReport(false)}
          loading={send.status === "loading"}
          disabled={!baseUrl}
        />
        {send.status === "success" && (
          <>
            <Notice kind="success">
              {send.created ? "Yeni kayıt oluşturuldu" : "Aynı gönderim tekrar edildi, yeni kayıt açılmadı"} (HTTP{" "}
              {send.httpStatus}).
            </Notice>
            <Text accessibilityLabel={`Takip kodu: ${send.trackingCode}`} selectable style={{ ...font.subhead, fontWeight: "700", color: colors.action }}>
              {send.trackingCode}
            </Text>
            <Small>Kodu Takip sekmesinde yazarak durumu sorgulayabilirsiniz.</Small>
            <Button label="Aynı gönderimi tekrar dene" variant="secondary" onPress={() => sendTestReport(true)} />
          </>
        )}
        {send.status === "error" && (
          <>
            <Notice kind="error">{send.message}</Notice>
            {send.detail ? <Small>Teknik ayrıntı: {send.detail}</Small> : null}
            {submissionId && (
              <Button label="Aynı gönderimi tekrar dene" variant="secondary" onPress={() => sendTestReport(true)} />
            )}
          </>
        )}
      </Card>
    </Screen>
  );
}
