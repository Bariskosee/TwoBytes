import type { ReactNode } from "react";
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
import { colors, font, minTouch, radius, space } from "@/theme";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
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

/** Etiket her zaman alanın üstünde durur. */
export function Field({
  label,
  hint,
  ...inputProps
}: { label: string; hint?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, inputProps.multiline && styles.inputMultiline]}
        {...inputProps}
      />
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
      <Text style={styles.body}>{children}</Text>
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
    <View style={styles.stack}>
      <Notice kind="error">{message}</Notice>
      {detail ? <Small>Teknik ayrıntı: {detail}</Small> : null}
      <Button label="Tekrar dene" variant="secondary" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space.s3, gap: space.s3, paddingBottom: space.s5 },
  stack: { gap: space.s3 },
  title: { ...font.title, fontWeight: "700", color: colors.text },
  subhead: { ...font.subhead, fontWeight: "600", color: colors.text },
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
  button: {
    minHeight: minTouch,
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
  buttonText: { ...font.body, fontWeight: "600" },
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
  inputMultiline: { minHeight: 120, textAlignVertical: "top" },
  notice: { borderRadius: radius.control, padding: space.s3, gap: space.s1, borderWidth: 1 },
  noticeInfo: { backgroundColor: colors.infoSurface, borderColor: colors.hairline },
  noticeError: { backgroundColor: colors.errorSurface, borderColor: colors.error },
  noticeSuccess: { backgroundColor: colors.successSurface, borderColor: colors.success },
  noticeLabel: { ...font.small, fontWeight: "700", color: colors.muted },
  noticeLabelError: { color: colors.error },
  noticeLabelSuccess: { color: colors.success },
  loading: { flexDirection: "row", alignItems: "center", gap: space.s2, paddingVertical: space.s3 },
});
