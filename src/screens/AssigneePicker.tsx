import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Resident, SuggestionResult } from '../data/app';
import { Avatar, Banner, Button, Card, Screen, Title } from '../ui/components';
import { color, font, radius } from '../ui/theme';
import { useSingleFlight } from '../ui/useSingleFlight';
import { choreMessageFor } from '../ui/messages';

export function AssigneePicker({
  choreTitle,
  residents,
  suggestion,
  onBack,
  onAssign,
}: {
  choreTitle: string;
  residents: Resident[];
  /** AI or fallback suggestion from the Edge Function (null while loading or if unavailable). */
  suggestion: SuggestionResult | null;
  onBack: () => void;
  /** Called with the chosen resident; should create the chore and navigate away. */
  onAssign: (residentId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  // Pre-select the suggested resident on first render (only if user hasn't tapped yet).
  useEffect(() => {
    if (suggestion && !selected) setSelected(suggestion.assigneeId);
  }, [suggestion]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const singleFlight = useSingleFlight();

  const assignee = residents.find((r) => r.id === selected);

  const submit = () =>
    singleFlight(async () => {
      if (!selected) return;
      setBusy(true);
      setError(null);
      try {
        await onAssign(selected);
      } catch (e) {
        setError(choreMessageFor(e));
        setBusy(false);
      }
    });

  return (
    <Screen onBack={onBack}>
      <Title>Who's doing it?</Title>
      <Text style={styles.subtitle} numberOfLines={1}>{choreTitle}</Text>
      {suggestion ? (
        <Card style={styles.suggestionCard}>
          <Text style={styles.suggestionLabel}>✦ SUGGESTED</Text>
          <Text style={styles.suggestionReason}>
            {suggestion.reason ?? 'Suggested by rotation.'}
          </Text>
        </Card>
      ) : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        {residents.map((r, i) => {
          const active = r.id === selected;
          return (
            <Card
              key={r.id}
              style={[styles.row, active && styles.rowActive]}
            >
              <Text onPress={() => setSelected(r.id)} style={StyleSheet.absoluteFill} accessibilityRole="radio" accessibilityState={{ checked: active }} />
              <Avatar name={r.displayName} index={i} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{r.isYou ? `${r.displayName} (you)` : r.displayName}</Text>
                <Text style={styles.cap}>In room</Text>
              </View>
              <View style={[styles.radio, active && styles.radioActive]}>
                {active ? <Text style={styles.radioCheck}>✓</Text> : null}
              </View>
            </Card>
          );
        })}
      </ScrollView>
      <Button
        label={assignee ? `Assign to ${assignee.isYou ? 'yourself' : assignee.displayName}` : 'Pick someone'}
        onPress={submit}
        disabled={!selected}
        loading={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { ...font.callout, color: color.inkMuted, marginTop: -16 },
  suggestionCard: { gap: 4 },
  suggestionLabel: { ...font.overline, color: color.brand },
  suggestionReason: { ...font.body, color: color.ink },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: 'transparent' },
  rowActive: { borderColor: color.brand },
  name: { ...font.callout, color: color.ink },
  cap: { ...font.caption, color: color.inkMuted },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { backgroundColor: color.brand, borderColor: color.brand },
  radioCheck: { color: color.brandInk, fontSize: 13, fontWeight: '700' },
});
