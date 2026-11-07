import { StyleSheet, Text, View } from 'react-native';
import type { ChoreWithOccurrence, Resident } from '../data/app';
import { Avatar, Banner, Button, Card, Screen, Tag, Title } from '../ui/components';
import { dueLabel, occurrenceGroup, repeatLabel } from '../ui/format';
import { choreMessageFor } from '../ui/messages';
import { color, font, radius } from '../ui/theme';
import { useSingleFlight } from '../ui/useSingleFlight';
import { useState } from 'react';

export function ChoreDetail({
  item,
  residents,
  onBack,
  onComplete,
}: {
  item: ChoreWithOccurrence;
  residents: Resident[];
  onBack: () => void;
  /** Called when "Mark as done" is pressed; should complete and navigate away. */
  onComplete: () => Promise<void>;
}) {
  const { chore, occurrence } = item;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const singleFlight = useSingleFlight();

  const residentById = Object.fromEntries(residents.map((r) => [r.id, r]));
  const residentIndex = Object.fromEntries(residents.map((r, i) => [r.id, i]));

  const assignee = occurrence.assigneeId ? residentById[occurrence.assigneeId] : null;
  const now = new Date();
  const done = occurrence.status === 'done';
  const isOverdue = occurrenceGroup(occurrence.dueAt, occurrence.status, now) === 'overdue';
  const due = dueLabel(occurrence.dueAt, now);

  const handleComplete = () =>
    singleFlight(async () => {
      setBusy(true);
      setError(null);
      try {
        await onComplete();
      } catch (e) {
        setError(choreMessageFor(e));
        setBusy(false);
      }
    });

  return (
    <Screen onBack={onBack}>
      <View style={styles.header}>
        <Title>{chore.title}</Title>
        <View style={styles.tags}>
          {isOverdue ? (
            <Tag tone="warn">{due}</Tag>
          ) : done ? null : (
            <Tag>{due}</Tag>
          )}
          {chore.scope === 'room' ? <Tag>Whole room</Tag> : null}
          {chore.repeatInterval ? (
            <Tag>{`↻ ${repeatLabel(chore.repeatInterval, chore.repeatDays)}`}</Tag>
          ) : null}
        </View>
      </View>

      {error ? <Banner tone="danger">{error}</Banner> : null}

      {chore.scope === 'person' && assignee ? (
        <Card style={styles.assigneeCard}>
          <Text style={styles.assigneeLabel}>ASSIGNED TO</Text>
          <View style={styles.assigneeRow}>
            <Avatar name={assignee.displayName} index={residentIndex[assignee.id] ?? 0} size={40} />
            <Text style={styles.assigneeName}>
              {assignee.isYou ? `${assignee.displayName} (you)` : assignee.displayName}
            </Text>
          </View>
        </Card>
      ) : chore.scope === 'room' ? (
        <Card style={styles.assigneeCard}>
          <Text style={styles.assigneeLabel}>FOR THE WHOLE FLAT</Text>
          <Text style={styles.assigneeBody}>Anyone can mark this done and get the credit.</Text>
        </Card>
      ) : null}

      <View style={{ flex: 1 }} />

      <Button
        label={done ? 'Already done' : '✓ Mark as done'}
        onPress={handleComplete}
        disabled={done}
        loading={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  assigneeCard: { gap: 10 },
  assigneeLabel: { ...font.overline, color: color.inkMuted },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assigneeName: { ...font.callout, color: color.ink },
  assigneeBody: { ...font.body, color: color.inkMuted },
});
