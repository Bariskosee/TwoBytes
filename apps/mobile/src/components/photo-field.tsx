import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Button, Notice, Small } from "@/components/ui";
import { colors, radius, space } from "@/theme";

export interface PickedPhoto {
  /** Hazırlanmış yerel JPEG dosyası. */
  uri: string;
  width: number;
  height: number;
}

// Sunucu en fazla 4 MiB ve 24 milyon piksel kabul eder. 2048 piksel sınırı ve %80 JPEG kalitesi
// tipik bir telefon fotoğrafını birkaç yüz KB'a indirir ve HEIC gibi biçimleri JPEG'e çevirir.
const MAX_SIDE = 2048;
const JPEG_QUALITY = 0.8;

/**
 * İsteğe bağlı tek fotoğraf. Kütüphaneden seçilir, küçültülüp JPEG'e çevrilir.
 * Kütüphane seçicisi izin istemez. Konum bilgisi (EXIF) seçiciden istenmez ve yeniden kodlamayla düşer.
 */
export function PhotoField({
  value,
  onChange,
  disabled,
}: {
  value: PickedPhoto | null;
  onChange: (photo: PickedPhoto | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    setError(null);
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const rendered = await ImageManipulator.manipulate(asset.uri, {
        maxWidth: MAX_SIDE,
        maxHeight: MAX_SIDE,
      }).renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
      onChange({ uri: saved.uri, width: saved.width, height: saved.height });
    } catch {
      setError("Fotoğraf hazırlanamadı. Başka bir fotoğraf seçin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      {value ? (
        <Image
          source={{ uri: value.uri }}
          style={styles.preview}
          resizeMode="cover"
          accessibilityLabel="Seçilen fotoğrafın önizlemesi"
        />
      ) : null}
      <Button
        label={value ? "Başka fotoğraf seç" : "Fotoğraf seç"}
        variant="secondary"
        onPress={pick}
        loading={busy}
        disabled={disabled}
      />
      {value && (
        <Button
          label="Fotoğrafı kaldır"
          variant="secondary"
          onPress={() => {
            setError(null);
            onChange(null);
          }}
          disabled={disabled || busy}
        />
      )}
      {error ? <Notice kind="error">{error}</Notice> : null}
      <Small>Yüz veya kimlik bilgisi seçilebiliyorsa fotoğraf eklemeyin. Konum gibi üst veriler sunucuda kaldırılır.</Small>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s2 },
  preview: {
    width: "100%",
    height: 200,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.hairline,
  },
});
