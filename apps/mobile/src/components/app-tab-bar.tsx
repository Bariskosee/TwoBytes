import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, minTouch, radius, space } from "@/theme";

type TabBarRenderer = NonNullable<ComponentProps<typeof Tabs>["tabBar"]>;
type TabBarProps = Parameters<TabBarRenderer>[0];

/**
 * Beş sekmenin tek ortak çubuğu. Her sekme aynı boyutta ve aynı biçimdedir.
 * Seçili sekme açık mor zemin, mor kalın yazı ve erişilebilir "seçili" durumuyla ayrılır.
 * Alt güvenli alan (ana ekran çubuğu) çubuğun içine eklenir.
 */
export function AppTabBar({ state, descriptors, emitter, navigateToTab, insets }: TabBarProps) {
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.s2) }]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = typeof options.title === "string" ? options.title : route.name;
        const selected = state.index === index;

        function onPress() {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            accessibilityState={{ selected }}
            onPress={onPress}
            style={({ pressed }) => [styles.tab, selected && styles.tabSelected, pressed && styles.pressed]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.label, selected && styles.labelSelected]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: space.s1,
    paddingHorizontal: space.s2,
    paddingTop: space.s2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  tab: {
    flex: 1,
    minHeight: minTouch,
    paddingHorizontal: space.s1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.control,
  },
  tabSelected: { backgroundColor: colors.selected },
  pressed: { opacity: 0.85 },
  label: { ...font.small, fontWeight: "600", color: colors.muted },
  labelSelected: { fontWeight: "700", color: colors.action },
});
