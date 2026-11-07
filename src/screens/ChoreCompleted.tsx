import { StyleSheet, Text, View } from 'react-native';
import type { CompletionResult } from '../data/app';
import { Button, Card, Screen } from '../ui/components';
import { completionTime } from '../ui/format';
import { color, font, radius } from '../ui/theme';

export interface CompleteViewResult {
  completion: CompletionResult;
  choreTitle: string;
  flatmateCount: number;
}

export function ChoreCompleted({
  result,
  onDone,
}: {
  result: CompleteViewResult;
  onDone: () => void;
}) {
  const { completion, choreTitle, flatmateCount } = result;
  const now = new Date();
  const timeLabel = completionTime(completion.completedAt, now);
  const othersCount = flatmateCount - 1;

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkGlyph}>✓</Text>
        </View>
        <Text style={styles.headline}>
          {`Nice one, ${completion.displayName}!`}
        </Text>
        <Text style={styles.subline}>{choreTitle}</Text>
      </View>

      <Card style={styles.logCard}>
        <Text style={styles.logLabel}>LOGGED</Text>
        <Text style={styles.logTime}>{timeLabel}</Text>
        {othersCount > 0 ? (
          <Text style={styles.logFlatmates}>
            {othersCount === 1
              ? '1 flatmate has been notified.'
              : `${othersCount} flatmates have been notified.`}
          </Text>
        ) : null}
      </Card>

      <View style={{ flex: 1 }} />

      <Button label="Back to chores" onPress={onDone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12, paddingTop: 24 },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { color: color.brandInk, fontSize: 40, lineHeight: 44, fontWeight: '700' },
  headline: { ...font.largeTitle, color: color.ink, textAlign: 'center' },
  subline: { ...font.body, color: color.inkMuted, textAlign: 'center' },
  logCard: { gap: 6 },
  logLabel: { ...font.overline, color: color.inkMuted },
  logTime: { ...font.callout, color: color.ink },
  logFlatmates: { ...font.caption, color: color.inkMuted },
});
