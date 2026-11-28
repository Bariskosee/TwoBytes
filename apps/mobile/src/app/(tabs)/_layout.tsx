import { Tabs } from "expo-router";
import { AppTabBar } from "@/components/app-tab-bar";
import { colors } from "@/theme";

// Sayfa başlığını yerel gezinme çubuğu taşır: iOS güvenli alanını ve durum çubuğunu o yönetir.
// Zemin ekranla aynı lavanta tonudur, durum çubuğu yazısı koyudur.
const screenOptions = {
  headerShown: true,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: colors.canvas },
  headerTintColor: colors.text,
  headerTitleStyle: { color: colors.text, fontWeight: "700" as const },
};

export default function TabLayout() {
  return (
    <Tabs screenOptions={screenOptions} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen
        name="index"
        options={{ title: "Harita", headerTitle: "Harita", tabBarAccessibilityLabel: "Yoğunluk haritası" }}
      />
      <Tabs.Screen
        name="bildir"
        options={{ title: "Bildir", headerTitle: "Bildirim oluştur", tabBarAccessibilityLabel: "Bildirim formu" }}
      />
      <Tabs.Screen
        name="takip"
        options={{ title: "Takip", headerTitle: "Takip kodu sorgusu", tabBarAccessibilityLabel: "Takip kodu sorgusu" }}
      />
      <Tabs.Screen
        name="karne"
        options={{ title: "Karne", headerTitle: "Kurum karnesi", tabBarAccessibilityLabel: "Kurum karnesi" }}
      />
      <Tabs.Screen
        name="baglanti"
        options={{ title: "Bağlantı", headerTitle: "Bağlantı denemesi", tabBarAccessibilityLabel: "API bağlantı denemesi" }}
      />
    </Tabs>
  );
}
