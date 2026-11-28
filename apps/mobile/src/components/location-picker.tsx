import { StyleSheet, View } from "react-native";
import MapView, { Marker, type MapPressEvent } from "react-native-maps";
import { colors, radius } from "@/theme";

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

/**
 * Haritaya dokunarak olay yerini seçtirir. İşaretçi, son dokunulan yere taşınır.
 * Konum izni istenmez: `showsUserLocation` kapalı ve konum API'si kullanılmaz.
 */
export function LocationPicker({
  value,
  onChange,
}: {
  value: Coordinate | null;
  onChange: (coordinate: Coordinate) => void;
}) {
  function handlePress(event: MapPressEvent) {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    onChange({ latitude, longitude });
  }

  return (
    <View style={styles.frame}>
      <MapView
        style={styles.map}
        initialRegion={INITIAL_REGION}
        onPress={handlePress}
        showsUserLocation={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        accessibilityLabel="Harita. Olayın yerini seçmek için dokunun."
      >
        {value ? <Marker coordinate={value} pinColor={colors.action} /> : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 280,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  map: { flex: 1 },
});
