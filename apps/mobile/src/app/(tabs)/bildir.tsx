import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Field, Notice, Screen, Small, Subhead, Title } from "@/components/ui";
import { colors, font, space } from "@/theme";

const MAX_DESCRIPTION = 2000;

// Taslak ekran. Konum, zaman ve fotoğraf seçimi sonraki adımda eklenecek.
// Gönderim düğmesi bu yüzden kapalı ve nedeni düğmenin altında yazıyor.
export default function ReportScreen() {
  const [description, setDescription] = useState("");

  return (
    <Screen>
      <Title>Bildirim oluştur</Title>
      <Body muted>Kimlik bilgisi paylaşmadan, hesap açmadan bildirebilirsiniz.</Body>

      <Notice kind="info">Bu ekran taslak. Konum ve zaman seçimi bir sonraki adımda eklenecek.</Notice>

      <Card>
        <Subhead>1. Konum</Subhead>
        <Body muted>Haritadan olayın yerini seçeceksiniz.</Body>
      </Card>

      <Card>
        <Subhead>2. Olay zamanı</Subhead>
        <Body muted>Olayın tarihini ve saatini seçeceksiniz. Son bir yıl içinde olmalı.</Body>
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
        <Body muted>Fotoğraf yükleme sonraki aşamada eklenecek.</Body>
      </Card>

      <Button label="Bildirimi gönder" onPress={() => undefined} disabled />
      <Small>Konum ve zaman seçimi eklenince gönderim açılacak.</Small>
    </Screen>
  );
}

const styles = StyleSheet.create({
  counter: { alignItems: "flex-end", marginTop: -space.s2 },
  counterText: { ...font.small, color: colors.muted },
});
