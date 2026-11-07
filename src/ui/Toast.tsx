import { StyleSheet, Text, View } from 'react-native';
import { color, font, radius } from './theme';

/** Floating alert banner, absolutely positioned near the top of its parent. */
export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View
      style={styles.toast}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: color.ink,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 100,
    elevation: 8,
  },
  text: { ...font.callout, color: color.white },
});
