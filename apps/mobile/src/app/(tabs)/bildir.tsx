import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { createReport, createReportWithPhoto, describeDetail, describeError } from "@/api/client";
import { AreaLocationOptions } from "@/components/area-location-options";
import { EventTimeField } from "@/components/event-time-field";
import { type Coordinate, LocationPicker } from "@/components/location-picker";
import { PhotoField, type PickedPhoto } from "@/components/photo-field";
import { Button, CodeBox, Field, FormSection, Notice, Screen, Section, Small } from "@/components/ui";
import { floorToMinute, toIstanbulIso, validateEventTime } from "@/lib/event-time";
import { colors, font, radius, space, tabularNums } from "@/theme";

const MAX_DESCRIPTION = 2000;

type Outcome =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string; detail?: string }
  | { status: "success"; trackingCode: string; created: boolean };

export default function ReportScreen() {
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [occurredAt, setOccurredAt] = useState(() => floorToMinute(new Date()));
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ status: "idle" });

  // Aynı anda ikinci dokunuşu engeller. State güncellemesi bir sonraki çizimde görünür, ref anında.
  const inFlight = useRef(false);
  // Bir gönderime ait kimlik. Ağ hatasında aynı kimlikle tekrar denenir, sunucu tek kayıt açar.
  // İçerik değişirse yeni kimlik üretilir. Sunucu aynı kimliğe eski kaydı döndürür.
  const attempt = useRef<{ id: string; fingerprint: string } | null>(null);

  const timeError = validateEventTime(occurredAt, Date.now());
  const submitting = outcome.status === "submitting";
  const canSubmit = location !== null && timeError === null && !submitting;

  // Gönder düğmesinin hemen üstünde gösterilen eksikler.
  const missing: string[] = [];
  if (location === null) missing.push("Yer seçilmedi.");
  if (timeError !== null) missing.push(`Zaman: ${timeError}`);

  async function submit() {
    if (inFlight.current || !location) return;
    // Zaman, ekran açıkken eskimiş olabilir. Göndermeden hemen önce yeniden denetlenir.
    if (validateEventTime(occurredAt, Date.now()) !== null) return;

    inFlight.current = true;
    setOutcome({ status: "submitting" });

    const trimmed = description.trim();
    const payload = {
      location: { latitude: location.latitude, longitude: location.longitude },
      occurredAt: toIstanbulIso(occurredAt),
      description: trimmed.length > 0 ? trimmed : undefined,
    };
    const fingerprint = JSON.stringify([
      payload.location.latitude,
      payload.location.longitude,
      payload.occurredAt,
      payload.description ?? "",
      photo?.uri ?? "",
    ]);
    if (attempt.current?.fingerprint !== fingerprint) {
      attempt.current = { id: Crypto.randomUUID(), fingerprint };
    }

    try {
      const report = { submissionId: attempt.current.id, ...payload };
      const result = photo ? await createReportWithPhoto(report, photo) : await createReport(report);
      setOutcome({
        status: "success",
        trackingCode: result.data.trackingCode,
        created: result.data.created,
      });
    } catch (error) {
      // Girilenler ekranda kalır. Kimlik korunur, tekrar denemek tek kayıt açar.
      setOutcome({ status: "error", message: describeError(error), detail: describeDetail(error) });
    } finally {
      inFlight.current = false;
    }
  }

  function startOver() {
    attempt.current = null;
    setLocation(null);
    setOccurredAt(floorToMinute(new Date()));
    setDescription("");
    setPhoto(null);
    setOutcome({ status: "idle" });
  }

  // Sistem paylaşım sayfası kodu kopyalama, not alma ve mesajla gönderme seçenekleriyle açılır.
  async function shareCode(code: string) {
    try {
      await Share.share({ message: `Takip kodum: ${code}` });
    } catch {
      // Paylaşım sayfası açılamadıysa kod ekranda seçilebilir metin olarak kalır.
    }
  }

  if (outcome.status === "success") {
    return (
      <Screen intro="Kodu saklayın. Bildiriminizin durumunu bu kodla görürsünüz.">
        <Notice kind={outcome.created ? "success" : "info"}>
          {outcome.created
            ? "Bildiriminiz kaydedildi."
            : "Bu gönderim daha önce kaydedilmişti. Yeni kayıt açılmadı."}
        </Notice>

        <Section>
          <CodeBox code={outcome.trackingCode} />
          <Small>Kodu kopyalamak için uzun basabilir veya aşağıdaki düğmeyi kullanabilirsiniz.</Small>
          <Button label="Kodu kopyala veya paylaş" onPress={() => shareCode(outcome.trackingCode)} />
        </Section>

        <Section>
          <Button label="Takip sekmesine git" variant="secondary" onPress={() => router.navigate("/takip")} />
          <Button label="Yeni bildirim" variant="secondary" onPress={startOver} />
        </Section>
      </Screen>
    );
  }

  return (
    <Screen intro="Yeri ve zamanı seçin. Açıklama ve fotoğraf isteğe bağlıdır.">
      <FormSection title="1. Yer">
        <LocationPicker value={location} onChange={setLocation} />
        <AreaLocationOptions value={location} onChange={setLocation} />
      </FormSection>

      <FormSection title="2. Zaman">
        <EventTimeField value={occurredAt} onChange={setOccurredAt} error={timeError} />
      </FormSection>

      <FormSection title="3. Ek bilgi">
        <Field
          label="Olayı kısaca anlatın"
          hint="Kimlik veya iletişim bilgisi yazmayın."
          value={description}
          onChangeText={setDescription}
          maxLength={MAX_DESCRIPTION}
          multiline
        />
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {description.length} / {MAX_DESCRIPTION}
          </Text>
        </View>
        <PhotoField value={photo} onChange={setPhoto} disabled={submitting} />
      </FormSection>

      <Section>
        {missing.length > 0 && !submitting && (
          <View accessibilityLiveRegion="polite" style={styles.missing}>
            <Text style={styles.missingTitle}>Göndermek için eksik:</Text>
            {missing.map((item) => (
              <Text key={item} style={styles.missingItem}>
                {item}
              </Text>
            ))}
          </View>
        )}

        {outcome.status === "error" && (
          <>
            <Notice kind="error">{outcome.message}</Notice>
            {outcome.detail ? <Small>Teknik ayrıntı: {outcome.detail}</Small> : null}
            <Small>Girdiğiniz bilgiler korundu. Tekrar denerseniz aynı bildirim gönderilir, tek kayıt oluşur.</Small>
          </>
        )}

        <Button
          label={outcome.status === "error" ? "Tekrar dene" : "Bildirimi gönder"}
          onPress={submit}
          loading={submitting}
          disabled={!canSubmit && !submitting}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: { alignItems: "flex-end", marginTop: -space.s1 },
  counterText: { ...font.small, ...tabularNums, color: colors.muted },
  missing: {
    gap: 2,
    padding: space.s3,
    backgroundColor: colors.infoSurface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
  },
  missingTitle: { ...font.small, fontWeight: "700", color: colors.text },
  missingItem: { ...font.body, color: colors.text },
});
