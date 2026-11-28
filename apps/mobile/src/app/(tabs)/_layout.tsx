import { Tabs } from "expo-router";
import { colors, font, minTouch } from "@/theme";

// Sekmeler yalnızca metin etiketi taşır. Simge paketi eklenmedi.
const screenOptions = {
  headerStyle: { backgroundColor: colors.canvas },
  headerShadowVisible: false,
  headerTitleStyle: { color: colors.text, fontWeight: "700" as const },
  tabBarActiveTintColor: colors.action,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.hairline,
    minHeight: minTouch + 8,
  },
  tabBarLabelStyle: { ...font.small, fontWeight: "600" as const },
  tabBarIconStyle: { display: "none" as const },
  tabBarItemStyle: { justifyContent: "center" as const },
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen name="index" options={{ title: "Harita", tabBarAccessibilityLabel: "Yoğunluk haritası" }} />
      <Tabs.Screen name="bildir" options={{ title: "Bildir", tabBarAccessibilityLabel: "Bildirim formu" }} />
      <Tabs.Screen name="takip" options={{ title: "Takip", tabBarAccessibilityLabel: "Takip kodu sorgusu" }} />
      <Tabs.Screen name="karne" options={{ title: "Karne", tabBarAccessibilityLabel: "Kurum karnesi" }} />
      <Tabs.Screen name="baglanti" options={{ title: "Bağlantı", tabBarAccessibilityLabel: "API bağlantı denemesi" }} />
    </Tabs>
  );
}
