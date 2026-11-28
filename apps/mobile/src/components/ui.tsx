import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, focusWidth, font, maxContentWidth, minTouch, radius, space } from "@/theme";

/**
 * Ekranın iskeleti. Sayfa başlığını gezinme çubuğu taşır, güvenli alanı ve durum çubuğunu da o yönetir.
 * `intro` başlığın altında tek satırlık kısa açıklamadır. Bölümler arasında 24, kenarlarda 16 boşluk bırakır.
 */
export function Screen({ intro, children }: { intro?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.content}>
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/** Birbiriyle ilişkili öğeleri 8 birim aralıkla toplar. */
export function Section({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function Subhead({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.subhead}>
      {children}
    </Text>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Small({ children }: { children: ReactNode }) {
  return <Text style={styles.small}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/** Başlıklı kart. Formdaki bir bölümü (ör. "1. Yer") tek bir kutuda toplar. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Subhead>{title}</Subhead>
      {children}
    </View>
  );
}

/** Küçük etiket. Düğmenin yanında düğmenin ne yaptığını kısaca söyler. */
export function Tag({ label }: { label: string }) {
  return <Text style={styles.tag}>{label}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, variant = "primary", disabled, loading }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" ? styles.buttonPrimary : styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === "primary" ? styles.buttonTextPrimary : styles.buttonTextSecondary,
          disabled && styles.buttonTextDisabled,
        ]}
      >
        {loading ? `${label}…` : label}
      </Text>
    </Pressable>
  );
}

/**
 * Etiket her zaman alanın üstünde durur. Odak alınca kenarlık odak rengine ve kalın çizgiye geçer.
 * `error` verilirse hata metni alanın hemen altında yazılır, girilen değer korunur.
 */
export function Field({
  label,
  hint,
  error,
  style,
  onFocus,
  onBlur,
  ...inputProps
}: { label: string; hint?: string; error?: string | null } & TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          inputProps.multiline && styles.inputMultiline,
          error ? styles.inputError : null,
          focused && styles.inputFocused,
          style,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.fieldError}>
          Hata: {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Tek seçimli kompakt satır. Seçili durum zemin, kalın kenarlık ve "Seçildi" metniyle gösterilir. */
export function Choice({
  label,
  detail,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.buttonPressed]}
    >
      <View style={styles.choiceText}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {detail ? <Text style={styles.small}>{detail}</Text> : null}
      </View>
      <Text style={[styles.choiceState, selected && styles.choiceStateSelected]}>{selected ? "Seçildi" : "Seç"}</Text>
    </Pressable>
  );
}

/** Takip kodunun koyu mürekkep panelde iri, seçilebilir gösterimi. */
export function CodeBox({ code }: { code: string }) {
  return (
    <View style={styles.codeBox}>
      <Text style={styles.codeCaption}>TAKİP KODU</Text>
      <Text selectable accessibilityLabel={`Takip kodunuz: ${code}`} style={styles.code}>
        {code}
      </Text>
    </View>
  );
}

type BlockTone = "neutral" | "progress" | "done";

/** Renkli durum bloğu. Renk durumu pekiştirir, anlam her zaman blokta yazan metindedir. */
export function StatusBlock({
  tone,
  caption,
  headline,
  children,
}: {
  tone: BlockTone;
  caption: string;
  headline: string;
  children?: ReactNode;
}) {
  const toneStyle =
    tone === "done" ? styles.blockDone : tone === "progress" ? styles.blockProgress : styles.blockNeutral;
  return (
    <View style={[styles.block, toneStyle]}>
      <Text style={styles.blockCaption}>{caption}</Text>
      <Text accessibilityRole="header" style={styles.blockHeadline}>
        {headline}
      </Text>
      {children}
    </View>
  );
}

type NoticeKind = "info" | "error" | "success";

const noticeLabel: Record<NoticeKind, string> = {
  info: "Bilgi",
  error: "Hata",
  success: "Başarılı",
};

/** Renge ek olarak metin etiketi taşır. Ekran okuyucu değişikliği duyurur. */
export function Notice({ kind, children }: { kind: NoticeKind; children: ReactNode }) {
  const tone =
    kind === "error" ? styles.noticeError : kind === "success" ? styles.noticeSuccess : styles.noticeInfo;
  const labelTone =
    kind === "error" ? styles.noticeLabelError : kind === "success" ? styles.noticeLabelSuccess : null;
  return (
    <View
      accessibilityRole={kind === "error" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
      style={[styles.notice, tone]}
    >
      <Text style={[styles.noticeLabel, labelTone]}>{noticeLabel[kind]}</Text>
      <Text selectable style={styles.body}>
        {children}
      </Text>
    </View>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}>
      <ActivityIndicator color={colors.action} />
      <Text style={styles.body}>{label}</Text>
    </View>
  );
}

export function ErrorNotice({
  message,
  detail,
  onRetry,
}: {
  message: string;
  detail?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.group}>
      <Notice kind="error">{message}</Notice>
      {detail ? <Small>Teknik ayrıntı: {detail}</Small> : null}
      <Button label="Tekrar dene" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { flexGrow: 1 },
  content: {
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
    padding: space.s3,
    paddingBottom: space.s5,
    gap: space.s4,
  },
  // Açıklama ile ilk bölüm arası 24 yerine 16 olsun.
  intro: { ...font.body, color: colors.muted, marginBottom: -space.s2 },
  group: { gap: space.s2 },
  subhead: { ...font.subhead, fontWeight: "700", color: colors.text },
  body: { ...font.body, color: colors.text },
  muted: { color: colors.muted },
  small: { ...font.small, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: space.s3,
    gap: space.s2,
  },
  tag: {
    ...font.small,
    fontWeight: "700",
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: space.s2,
    paddingVertical: 2,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  button: {
    minHeight: minTouch + 4,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: { backgroundColor: colors.action },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  buttonDisabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  buttonPressed: { opacity: 0.85 },
  buttonText: { ...font.body, fontWeight: "700", textAlign: "center" },
  buttonTextPrimary: { color: colors.onAction },
  buttonTextSecondary: { color: colors.action },
  buttonTextDisabled: { color: colors.onDisabled },
  field: { gap: space.s1 },
  fieldLabel: { ...font.body, fontWeight: "600", color: colors.text },
  input: {
    ...font.body,
    minHeight: minTouch,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  // Kenarlık kalınlaşırken içerik kaymasın diye iç boşluk aynı oranda azaltılır.
  inputError: {
    borderColor: colors.error,
    borderWidth: focusWidth,
    paddingHorizontal: space.s3 - (focusWidth - 1),
    paddingVertical: space.s2 - (focusWidth - 1),
  },
  inputFocused: {
    borderColor: colors.focus,
    borderWidth: focusWidth,
    paddingHorizontal: space.s3 - (focusWidth - 1),
    paddingVertical: space.s2 - (focusWidth - 1),
  },
  fieldError: { ...font.small, fontWeight: "600", color: colors.error },
  choice: {
    minHeight: minTouch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s2,
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
  },
  choiceSelected: {
    borderColor: colors.action,
    borderWidth: focusWidth,
    paddingHorizontal: space.s3 - (focusWidth - 1),
    paddingVertical: space.s2 - (focusWidth - 1),
    backgroundColor: colors.selected,
  },
  choiceText: { flex: 1, gap: 2 },
  choiceLabel: { ...font.body, fontWeight: "600", color: colors.text },
  choiceState: { ...font.small, fontWeight: "600", color: colors.muted },
  choiceStateSelected: { color: colors.action },
  codeBox: {
    alignItems: "center",
    gap: space.s1,
    paddingVertical: space.s4,
    paddingHorizontal: space.s3,
    backgroundColor: colors.inverse,
    borderRadius: radius.panel,
  },
  codeCaption: { ...font.small, fontWeight: "700", letterSpacing: 1.5, color: colors.onInverseMuted },
  code: {
    ...font.title,
    fontVariant: ["tabular-nums"],
    fontWeight: "700",
    color: colors.onInverse,
    letterSpacing: 2,
    textAlign: "center",
  },
  block: { borderRadius: radius.panel, padding: space.s3, gap: space.s2 },
  blockNeutral: { backgroundColor: colors.inverse },
  blockProgress: { backgroundColor: colors.action },
  blockDone: { backgroundColor: colors.success },
  blockCaption: { ...font.small, fontWeight: "700", letterSpacing: 1, color: colors.onInverse },
  blockHeadline: { ...font.title, fontWeight: "700", color: colors.onInverse },
  notice: { borderRadius: radius.control, padding: space.s3, gap: space.s1, borderWidth: 1 },
  noticeInfo: { backgroundColor: colors.infoSurface, borderColor: colors.hairline },
  noticeError: { backgroundColor: colors.errorSurface, borderColor: colors.error },
  noticeSuccess: { backgroundColor: colors.successSurface, borderColor: colors.success },
  noticeLabel: { ...font.small, fontWeight: "700", color: colors.muted },
  noticeLabelError: { color: colors.error },
  noticeLabelSuccess: { color: colors.success },
  loading: { flexDirection: "row", alignItems: "center", gap: space.s2, minHeight: minTouch },
});
