import { View } from "react-native";
import type { MapResponse } from "@/api/contract";
import { loadMap } from "@/api/demo-map";
import { useApi } from "@/api/useApi";
import type { Coordinate } from "@/components/location-picker";
import { Body, Button, Choice, Section, Small } from "@/components/ui";
import { centroidOf, samePlace } from "@/lib/map-geometry";
import { space } from "@/theme";

/**
 * Haritaya dokunmanın alternatifi. Yayımlanan bölgelerin listesinden birini seçince bölgenin ortası
 * yaklaşık konum olarak alınır. Ekran okuyucu veya sınırlı el hareketi kullananlar formu bu yolla tamamlayabilir.
 * Bölge listesi harita ucundan gelir. Gelmezse harita seçimi tek başına çalışmaya devam eder.
 */
export function AreaLocationOptions({
  value,
  onChange,
}: {
  value: Coordinate | null;
  onChange: (coordinate: Coordinate) => void;
}) {
  const { state, reload } = useApi<MapResponse>(loadMap);

  if (state.status === "loading") {
    return <Small>Bölge listesi yükleniyor.</Small>;
  }

  if (state.status === "error") {
    return (
      <Section>
        <Small>Bölge listesi yüklenemedi. Haritaya dokunarak yer seçebilirsiniz.</Small>
        <Button label="Bölge listesini yenile" variant="secondary" onPress={reload} />
      </Section>
    );
  }

  const options = state.data.areas.flatMap((area) => {
    const center = centroidOf(area.boundary);
    return center ? [{ id: area.id, name: area.name, center }] : [];
  });
  if (options.length === 0) return null;

  return (
    <Section>
      <Body>Ya da bölgeden seçin</Body>
      <Small>Bölgenin ortası yaklaşık yer olarak gönderilir. Ekran okuyucu kullananlar için en kolay yoldur.</Small>
      <View accessibilityRole="radiogroup" style={{ gap: space.s1 }}>
        {options.map((option) => (
          <Choice
            key={option.id}
            label={option.name}
            selected={value !== null && samePlace(value, option.center)}
            onPress={() => onChange(option.center)}
          />
        ))}
      </View>
    </Section>
  );
}
