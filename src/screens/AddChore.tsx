import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChoreScope, RepeatInterval } from '../data/app';
import { Banner, Button, Field, Screen, Title } from '../ui/components';
import { defaultDueAt, repeatLabel } from '../ui/format';
import { choreMessageFor } from '../ui/messages';
import { color, font, radius } from '../ui/theme';
import { useSingleFlight } from '../ui/useSingleFlight';

export interface ChoreFormData {
  title: string;
  repeatInterval: RepeatInterval;
  repeatDays: number | null;
  scope: ChoreScope;
}

/** Repeat options shown as pills (D-021). 'custom'/30 maps to Monthly. */
const REPEAT_OPTIONS: { label: string; interval: RepeatInterval; days: number | null }[] = [
  { label: 'Once', interval: null, days: null },
  { label: 'Daily', interval: 'daily', days: null },
  { label: 'Weekly', interval: 'weekly', days: null },
  { label: 'Monthly', interval: 'custom', days: 30 },
];

export function AddChore({
  onClose,
  /** Called when scope=person; app navigates to AssigneePicker before creating. */
  onPickAssignee,
  /** Called directly when scope=room; creates the chore without an assignee. */
  onCreateRoomScope,
}: {
  onClose: () => void;
  onPickAssignee: (data: ChoreFormData) => void;
  onCreateRoomScope: (data: ChoreFormData) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [repeat, setRepeat] = useState<(typeof REPEAT_OPTIONS)[number]>(REPEAT_OPTIONS[0]!);
  const [scope, setScope] = useState<ChoreScope>('person');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const singleFlight = useSingleFlight();

  const submit = () =>
    singleFlight(async () => {
      if (!title.trim()) {
        setError('Give the chore a name.');
        return;
      }
      const data: ChoreFormData = {
        title: title.trim(),
        repeatInterval: repeat.interval,
        repeatDays: repeat.days,
        scope,
      };
      if (scope === 'person') {
        onPickAssignee(data);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await onCreateRoomScope(data);
      } catch (e) {
        setError(choreMessageFor(e));
        setBusy(false);
      }
    });

  return (
    <Screen onClose={onClose}>
      <View style={styles.form}>
        <Title>New chore</Title>
        <Field
          label="What needs doing?"
          placeholder="e.g. Take out the bins"
          value={title}
          onChangeText={(t) => { setTitle(t); setError(null); }}
          error={error}
          returnKeyType="done"
          onSubmitEditing={submit}
        />

        {/* Repeat pills */}
        <View style={styles.section}>
          <Text style={styles.label}>Repeat</Text>
          <View style={styles.pills}>
            {REPEAT_OPTIONS.map((opt) => {
              const active = opt.interval === repeat.interval && opt.days === repeat.days;
              return (
                <View
                  key={opt.label}
                  style={[styles.pill, active && styles.pillActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[styles.pillText, active && styles.pillTextActive]}
                    onPress={() => setRepeat(opt)}
                  >
                    {active && repeat.interval ? `✓ ${opt.label}` : opt.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Scope toggle */}
        <View style={styles.section}>
          <Text style={styles.label}>Who's it for?</Text>
          <View style={styles.toggle}>
            <View style={[styles.toggleOption, scope === 'person' && styles.toggleActive]}>
              <Text
                style={[styles.toggleText, scope === 'person' && styles.toggleTextActive]}
                onPress={() => setScope('person')}
              >
                One person
              </Text>
            </View>
            <View style={[styles.toggleOption, scope === 'room' && styles.toggleActive]}>
              <Text
                style={[styles.toggleText, scope === 'room' && styles.toggleTextActive]}
                onPress={() => setScope('room')}
              >
                Whole room
              </Text>
            </View>
          </View>
          <Text style={styles.helper}>
            {scope === 'person'
              ? 'One person at a time, taking turns.'
              : 'Anyone can tick it off and get the credit.'}
          </Text>
        </View>

        {error ? <Banner tone="danger">{error}</Banner> : null}
      </View>

      <Button
        label={scope === 'person' ? 'Next: pick who →' : 'Add chore'}
        onPress={submit}
        loading={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1, gap: 24 },
  section: { gap: 10 },
  label: { ...font.caption, fontWeight: '600', color: color.inkMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.hairline,
    backgroundColor: color.surface1,
  },
  pillActive: { backgroundColor: color.brand, borderColor: color.brand },
  pillText: { ...font.callout, color: color.ink },
  pillTextActive: { color: color.brandInk },
  toggle: { flexDirection: 'row', borderRadius: radius.md, overflow: 'hidden', borderWidth: 1.5, borderColor: color.hairline },
  toggleOption: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: color.surface1 },
  toggleActive: { backgroundColor: color.brand },
  toggleText: { ...font.callout, color: color.ink },
  toggleTextActive: { color: color.brandInk },
  helper: { ...font.caption, color: color.inkMuted },
});
