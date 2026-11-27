import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { createReport, createReportWithPhoto, describeDetail, describeError } from "@/api/client";
import { EventTimeField } from "@/components/event-time-field";
import { type Coordinate, LocationPicker } from "@/components/location-picker";
import { PhotoField, type PickedPhoto } from "@/components/photo-field";
import { Body, Button, Card, Field, Notice, Screen, Small, Subhead, Title } from "@/components/ui";
import { floorToMinute, toIstanbulIso, validateEventTime } from "@/lib/event-time";
import { colors, font, space } from "@/theme";

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

  if (outcome.status === "success") {
    return (
      <Screen>
        <Title>Bildirim alındı</Title>
        <Notice kind={outcome.created ? "success" : "info"}>
          {outcome.created
            ? "Bildiriminiz kaydedildi."
            : "Bu gönderim daha önce kaydedilmişti. Yeni kayıt açılmadı."}
        </Notice>
        <Card>
          <Subhead>Takip kodunuz</Subhead>
          <Text
            selectable
            accessibilityLabel={`Takip kodunuz: ${outcome.trackingCode}`}
            style={styles.code}
          >
            {outcome.trackingCode}
          </Text>
          <Body muted>
            Bu kodu saklayın. Bildiriminizin durumunu Takip sekmesinde bu kodla görebilirsiniz. Kodu kopyalamak için
            uzun basın.
          </Body>
        </Card>
        <Button label="Yeni bildirim" variant="secondary" onPress={startOver} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Bildirim oluştur</Title>
      <Body muted>Kimlik bilgisi paylaşmadan, hesap açmadan bildirebilirsiniz.</Body>

      <Card>
        <Subhead>1. Olayın yeri</Subhead>
        <Body muted>Haritaya dokunarak yeri seçin. Başka bir yere dokunursanız işaretçi oraya taşınır.</Body>
        <LocationPicker value={location} onChange={setLocation} />
        <Text accessibilityLiveRegion="polite" style={styles.coords}>
          {location
            ? `Seçilen konum: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
            : "Henüz konum seçilmedi."}
        </Text>
        <Small>Sayfayı kaydırmak için haritanın dışına dokunarak sürükleyin.</Small>
      </Card>

      <Card>
        <Subhead>2. Olayın zamanı</Subhead>
        <EventTimeField value={occurredAt} onChange={setOccurredAt} error={timeError} />
      </Card>

      <Field
        label="3. Açıklama (isteğe bağlı)"
        hint={`En fazla ${MAX_DESCRIPTION} karakter.`}
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

      <Card>
        <Subhead>4. Fotoğraf (isteğe bağlı)</Subhead>
        <PhotoField value={photo} onChange={setPhoto} disabled={submitting} />
      </Card>

      {outcome.status === "error" && (
        <>
          <Notice kind="error">{outcome.message}</Notice>
          {outcome.detail ? <Small>Teknik ayrıntı: {outcome.detail}</Small> : null}
          <Small>Tekrar denerseniz aynı bildirim gönderilir. Tek kayıt oluşur.</Small>
        </>
      )}

      <Button
        label={outcome.status === "error" ? "Tekrar dene" : "Bildirimi gönder"}
        onPress={submit}
        loading={submitting}
        disabled={!canSubmit && !submitting}
      />
      {!location && <Small>Haritadan konum seçince gönderim açılır.</Small>}
      {location && timeError && <Small>Zamanı düzeltince gönderim açılır.</Small>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  coords: { ...font.body, color: colors.text },
  counter: { alignItems: "flex-end", marginTop: -space.s2 },
  counterText: { ...font.small, color: colors.muted },
  code: { ...font.title, fontWeight: "700", color: colors.action, letterSpacing: 1 },
});
