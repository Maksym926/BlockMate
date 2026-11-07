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
  onPass,
}: {
  item: ChoreWithOccurrence;
  residents: Resident[];
  onBack: () => void;
  /** Called when "Mark as done" is pressed; should complete and navigate away. */
  onComplete: () => Promise<void>;
  /** If provided, shows the Pass button. Only present when the current user is the assignee. */
  onPass?: () => Promise<void>;
}) {
  const { chore, occurrence } = item;
  const [busy, setBusy] = useState(false);
  const [passing, setPassing] = useState(false);
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

  const handlePass = () =>
    singleFlight(async () => {
      setPassing(true);
      setError(null);
      try {
        await onPass!();
      } catch (e) {
        setError(choreMessageFor(e));
        setPassing(false);
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

      {occurrence.suggestionSource === 'ai' && occurrence.suggestionReason ? (
        <Card style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>✦ WHY</Text>
          <Text style={styles.reasonText}>{occurrence.suggestionReason}</Text>
        </Card>
      ) : null}

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
      ) : chore.scope === 'person' && !assignee && occurrence.passedBy.length > 0 ? (
        <Card style={styles.assigneeCard}>
          <Text style={styles.assigneeLabel}>OPEN TO EVERYONE</Text>
          <Text style={styles.assigneeBody}>All flatmates passed — anyone can step up and get the credit.</Text>
        </Card>
      ) : chore.scope === 'room' ? (
        <Card style={styles.assigneeCard}>
          <Text style={styles.assigneeLabel}>FOR THE WHOLE FLAT</Text>
          <Text style={styles.assigneeBody}>Anyone can mark this done and get the credit.</Text>
        </Card>
      ) : null}

      <View style={{ flex: 1 }} />

      {onPass && !done ? (
        <Button
          label="Pass to someone else"
          variant="ghost"
          onPress={handlePass}
          loading={passing}
          disabled={busy}
        />
      ) : null}

      <Button
        label={done ? 'Already done' : '✓ Mark as done'}
        onPress={handleComplete}
        disabled={done || passing}
        loading={busy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  reasonCard: { gap: 4 },
  reasonLabel: { ...font.overline, color: color.brand },
  reasonText: { ...font.body, color: color.ink },
  assigneeCard: { gap: 10 },
  assigneeLabel: { ...font.overline, color: color.inkMuted },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assigneeName: { ...font.callout, color: color.ink },
  assigneeBody: { ...font.body, color: color.inkMuted },
});
