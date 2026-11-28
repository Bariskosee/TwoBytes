import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, type MapPressEvent } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/ui";
import { colors, font, radius, space, tabularNums } from "@/theme";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

// Üç demo bölgeyi (Çarşı ve çevresi, Moda, Fenerbahçe) birlikte gösteren başlangıç görünümü.
const INITIAL_REGION = {
  latitude: 40.982,
  longitude: 29.03,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

// Seçilen yerin çevresini gösteren yakın görünüm.
const FOCUS_DELTA = 0.012;

function describe(coordinate: Coordinate | null): string {
  return coordinate
    ? `Seçilen konum: ${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`
    : "Henüz konum seçilmedi.";
}

/**
 * Olay yerini seçtirir. Sayfada yalnızca dokunulmaz küçük bir önizleme durur, bu yüzden harita sayfayı
 * kaydırmayı engellemez. "Haritada yer seç" tam ekran bir harita açar: dokunarak işaretçi taşınır,
 * "Bu yeri seç" ile onaylanır. Konum izni istenmez: `showsUserLocation` kapalıdır ve konum API'si kullanılmaz.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: Coordinate | null;
  onChange: (coordinate: Coordinate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Coordinate | null>(null);

  function openPicker() {
    setDraft(value);
    setOpen(true);
  }

  function handlePress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setDraft({ latitude, longitude });
  }

  function confirm() {
    if (draft) onChange(draft);
    setOpen(false);
  }

  const previewRegion = value
    ? { ...value, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }
    : INITIAL_REGION;

  return (
    <View style={styles.stack}>
      {/* Önizleme süstür: dokunulmaz, ekran okuyucudan gizli. Konum bilgisi aşağıdaki metindedir. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.preview}
      >
        <MapView
          style={styles.map}
          region={previewRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          showsUserLocation={false}
          toolbarEnabled={false}
        >
          {value ? <Marker coordinate={value} pinColor={colors.action} /> : null}
        </MapView>
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.coords}>
        {describe(value)}
      </Text>

      <Button label={value ? "Yeri haritada değiştir" : "Haritada yer seç"} onPress={openPicker} />

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.modal} edges={["top", "bottom", "left", "right"]} accessibilityViewIsModal>
          <View style={styles.modalHeader}>
            <Text accessibilityRole="header" style={styles.modalTitle}>
              Olayın yerini seçin
            </Text>
            <View style={styles.close}>
              <Button label="Vazgeç" variant="secondary" onPress={() => setOpen(false)} />
            </View>
          </View>

          <MapView
            style={styles.map}
            initialRegion={value ? { ...value, latitudeDelta: FOCUS_DELTA * 3, longitudeDelta: FOCUS_DELTA * 3 } : INITIAL_REGION}
            onPress={handlePress}
            showsUserLocation={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            accessibilityLabel="Harita. Olayın yerini seçmek için dokunun. Ekran okuyucu kullanıyorsanız vazgeçip bölge listesinden seçin."
          >
            {draft ? <Marker coordinate={draft} pinColor={colors.action} /> : null}
          </MapView>

          <View style={styles.modalFooter}>
            <Text accessibilityLiveRegion="polite" style={styles.coords}>
              {draft ? describe(draft) : "Haritaya dokunarak yeri işaretleyin."}
            </Text>
            <Button label="Bu yeri seç" onPress={confirm} disabled={!draft} />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s2 },
  preview: {
    height: 140,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  map: { flex: 1 },
  coords: { ...font.body, ...tabularNums, color: colors.text },
  modal: { flex: 1, backgroundColor: colors.canvas },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s2,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
  },
  modalTitle: { ...font.subhead, fontWeight: "700", color: colors.text, flexShrink: 1 },
  close: { minWidth: 112 },
  modalFooter: {
    gap: space.s2,
    padding: space.s3,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
});
