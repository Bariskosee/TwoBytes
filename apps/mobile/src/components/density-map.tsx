import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import type { MapArea } from "@/api/contract";
import { bandColor } from "@/lib/band-colors";
import { bandInfo } from "@/lib/format";
import { centroidOf, regionFor, toPolygonCoordinates, withAlpha } from "@/lib/map-geometry";
import { colors, font, radius, space, tabularNums } from "@/theme";

// Hiç bölge gelmezse gösterilecek yedek görünüm (üç demo bölgenin çevresi).
const FALLBACK_REGION = {
  latitude: 40.982,
  longitude: 29.03,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

/**
 * Yayımlanan haftanın bölge yoğunluklarını haritada gösterir. Bölgeye dokunmak onu seçer.
 * Her bölgenin ortasında bant etiketi durur, böylece bant yalnızca renkle okunmaz.
 * Seçili bölge kalın çerçeveyle ve koyu etiketle belirtilir. Ad ve bant haritanın altındaki metinde de yazılır.
 */
export function DensityMap({
  areas,
  selectedId,
  onSelect,
  height,
}: {
  areas: MapArea[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  height: number;
}) {
  const region = useMemo(
    () => regionFor(areas.map((area) => area.boundary), FALLBACK_REGION),
    [areas],
  );

  return (
    <View style={[styles.frame, { height }]}>
      <MapView
        style={styles.map}
        initialRegion={region}
        showsUserLocation={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        accessibilityLabel="Bölgelerin bildirim yoğunluğunu gösteren harita. Ayrıntılar altındaki listede."
      >
        {areas.map((area) => {
          const color = bandColor[area.band];
          const selected = area.id === selectedId;
          return (
            <Polygon
              key={area.id}
              coordinates={toPolygonCoordinates(area.boundary)}
              fillColor={withAlpha(color, area.band === "insufficient_data" ? 0.18 : 0.5)}
              strokeColor={color}
              strokeWidth={selected ? 4 : 2}
              lineDashPattern={area.band === "insufficient_data" ? [6, 4] : undefined}
              tappable
              onPress={() => onSelect(area.id)}
            />
          );
        })}
        {areas.map((area) => {
          const center = centroidOf(area.boundary);
          if (!center) return null;
          const selected = area.id === selectedId;
          return (
            <Marker
              // Görünüm değişiklikleri izlenmediği için seçim değişince işaretçi yeniden oluşturulur.
              key={`label-${area.id}-${selected ? "secili" : "normal"}`}
              coordinate={center}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => onSelect(area.id)}
            >
              <View
                style={[
                  styles.chip,
                  { borderColor: bandColor[area.band] },
                  selected && styles.chipSelected,
                ]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {bandInfo[area.band].short}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Harita ekranın iki kenarına kadar uzanır (içerik kenar boşluğunu geri alır).
  frame: {
    marginHorizontal: -space.s3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  map: { flex: 1 },
  chip: {
    paddingHorizontal: space.s2,
    paddingVertical: space.s1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: radius.control,
  },
  chipSelected: { backgroundColor: colors.text, borderColor: colors.text },
  chipText: { ...font.small, ...tabularNums, fontWeight: "700", color: colors.text },
  chipTextSelected: { color: colors.surface },
});
