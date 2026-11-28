import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Button, Notice } from "@/components/ui";
import { floorToMinute, formatIstanbul } from "@/lib/event-time";
import { colors, font, minTouch, space } from "@/theme";

const TIME_ZONE = "Europe/Istanbul";

/**
 * Olayın tarihini ve saatini İstanbul saatiyle seçtirir.
 * Seçiciye min/max sınırı verilmez, böylece geçersiz bir zaman seçilebilir ve nedeni alanın altında yazılır.
 */
export function EventTimeField({
  value,
  onChange,
  error,
}: {
  value: Date;
  onChange: (date: Date) => void;
  error: string | null;
}) {
  // Android seçicisi iki adımlıdır: önce tarih, sonra saat.
  function openAndroid() {
    DateTimePickerAndroid.open({
      value,
      mode: "date",
      timeZoneName: TIME_ZONE,
      onValueChange: (_event, pickedDate) => {
        DateTimePickerAndroid.open({
          value: pickedDate,
          mode: "time",
          is24Hour: true,
          timeZoneName: TIME_ZONE,
          onValueChange: (_timeEvent, pickedTime) => onChange(floorToMinute(pickedTime)),
        });
      },
    });
  }

  return (
    <View style={styles.stack}>
      {Platform.OS === "ios" ? (
        <View style={styles.pickerRow}>
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            locale="tr-TR"
            timeZoneName={TIME_ZONE}
            accentColor={colors.action}
            accessibilityLabel="Olayın tarihi ve saati"
            onValueChange={(_event, picked) => onChange(floorToMinute(picked))}
          />
        </View>
      ) : (
        <Button label="Tarih ve saati seç" variant="secondary" onPress={openAndroid} />
      )}
      <Text style={styles.selected}>Seçilen zaman: {formatIstanbul(value)} (İstanbul saati)</Text>
      {error ? <Notice kind="error">{error}</Notice> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.s2 },
  pickerRow: { minHeight: minTouch, justifyContent: "center", alignItems: "flex-start" },
  selected: { ...font.body, color: colors.text },
});
