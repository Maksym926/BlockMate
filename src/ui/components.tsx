import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Resident } from '../data/app';
import { avatarColor, initial } from './format';
import { color, font, radius } from './theme';

/** Screen frame with an optional back button, matching the canvas layout. */
export function Screen({ onBack, children }: { onBack?: () => void; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}>
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
      ) : null}
      <View style={styles.main}>{children}</View>
    </SafeAreaView>
  );
}

export const Title = ({ children }: { children: ReactNode }) => <Text style={styles.title}>{children}</Text>;
export const Muted = ({ children }: { children: ReactNode }) => <Text style={styles.muted}>{children}</Text>;

type ButtonVariant = 'primary' | 'tint' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
}) {
  const bg: ViewStyle = {
    primary: { backgroundColor: color.brand },
    tint: { backgroundColor: color.brandTint },
    ghost: { backgroundColor: 'transparent' },
  }[variant];
  const fg = variant === 'primary' ? color.brandInk : variant === 'tint' ? color.brandTintInk : color.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[styles.button, bg, (disabled || loading) && { opacity: 0.45 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  help,
  ...input
}: { label: string; error?: string | null; help?: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.inkMuted}
        style={[styles.input, error ? styles.inputError : null]}
        {...input}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {error}
        </Text>
      ) : help ? (
        <Text style={styles.help}>{help}</Text>
      ) : null}
    </View>
  );
}

export function Banner({ tone, children }: { tone: 'warn' | 'danger' | 'brand'; children: ReactNode }) {
  const palette = {
    warn: [color.warnTint, color.warnTintInk],
    danger: [color.dangerTint, color.dangerTintInk],
    brand: [color.brandTint, color.brandTintInk],
  }[tone];
  return (
    <View
      accessibilityRole={tone === 'brand' ? undefined : 'alert'}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: palette[0] }]}
    >
      <Text style={[styles.bannerText, { color: palette[1] }]}>{children}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Avatar({ name, index, size = 40 }: { name: string; index: number; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(index),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: color.avatarInk, fontWeight: '700', fontSize: size * 0.4 }}>{initial(name)}</Text>
    </View>
  );
}

/** One resident in a list: avatar, name ("(you)" for the signed-in user) and a caption. */
export function ResidentRow({
  resident,
  index,
  caption,
}: {
  resident: Resident;
  index: number;
  caption: string;
}) {
  return (
    <View style={styles.residentRow}>
      <Avatar name={resident.displayName} index={index} />
      <View style={{ flex: 1 }}>
        <Text style={styles.residentName}>
          {resident.isYou ? `${resident.displayName} (you)` : resident.displayName}
        </Text>
        <Text style={styles.residentCaption}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  residentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  residentName: { ...font.callout, color: color.ink },
  residentCaption: { ...font.caption, color: color.inkMuted },
  screen: { flex: 1, backgroundColor: color.surface0 },
  main: { flex: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 24 },
  back: { width: 44, height: 44, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { fontSize: 34, lineHeight: 36, color: color.ink },
  title: { ...font.largeTitle, color: color.ink },
  muted: { ...font.body, color: color.inkMuted },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonLabel: { ...font.callout },
  field: { gap: 8 },
  fieldLabel: { ...font.caption, fontWeight: '600', color: color.inkMuted },
  input: {
    minHeight: 52,
    borderRadius: radius.sm,
    paddingHorizontal: 16,
    backgroundColor: color.surface2,
    borderWidth: 2,
    borderColor: 'transparent',
    fontSize: 16,
    color: color.ink,
  },
  inputError: { borderColor: color.danger, backgroundColor: color.surface1 },
  help: { ...font.caption, color: color.inkMuted },
  errorText: { ...font.caption, color: color.dangerTintInk },
  banner: { padding: 14, borderRadius: radius.md },
  bannerText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  card: { backgroundColor: color.surface1, borderRadius: radius.md, padding: 16 },
});
