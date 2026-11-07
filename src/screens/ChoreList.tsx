import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChoreWithOccurrence, Resident } from '../data/app';
import { Avatar, Banner, Card, Tag } from '../ui/components';
import { avatarColor, dueLabel, occurrenceGroup, repeatLabel } from '../ui/format';
import { color, font, radius } from '../ui/theme';

export function ChoreList({
  roomName,
  items,
  residents,
  error,
  onAdd,
  onDelete,
  onSelect,
}: {
  roomName: string;
  items: ChoreWithOccurrence[];
  residents: Resident[];
  error: string | null;
  onAdd: () => void;
  onDelete: (choreId: string) => void;
  onSelect: (item: ChoreWithOccurrence) => void;
}) {
  const now = new Date();

  const groups = {
    overdue: items.filter((i) => occurrenceGroup(i.occurrence.dueAt, i.occurrence.status, now) === 'overdue'),
    today: items.filter((i) => occurrenceGroup(i.occurrence.dueAt, i.occurrence.status, now) === 'today'),
    week: items.filter((i) => occurrenceGroup(i.occurrence.dueAt, i.occurrence.status, now) === 'week'),
    later: items.filter((i) => occurrenceGroup(i.occurrence.dueAt, i.occurrence.status, now) === 'later'),
    done: items.filter((i) => occurrenceGroup(i.occurrence.dueAt, i.occurrence.status, now) === 'done'),
  };

  const residentById = Object.fromEntries(residents.map((r) => [r.id, r]));
  const residentIndex = Object.fromEntries(residents.map((r, i) => [r.id, i]));

  const confirmDelete = (choreId: string, title: string) => {
    Alert.alert('Delete chore?', `"${title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(choreId) },
    ]);
  };

  const renderItem = (item: ChoreWithOccurrence) => {
    const { chore, occurrence } = item;
    const assignee = occurrence.assigneeId ? residentById[occurrence.assigneeId] : null;
    const done = occurrence.status === 'done';
    const isOverdue = occurrenceGroup(occurrence.dueAt, occurrence.status, now) === 'overdue';
    const due = dueLabel(occurrence.dueAt, now);

    return (
      <Pressable
        key={occurrence.id}
        onPress={() => onSelect(item)}
        onLongPress={() => confirmDelete(chore.id, chore.title)}
        style={[styles.item, isOverdue && styles.itemOverdue]}
        accessibilityHint="Long press to delete"
      >
        {/* Checkbox circle */}
        <View style={[styles.circle, done && styles.circleDone]}>
          {done ? <Text style={styles.circleCheck}>✓</Text> : null}
        </View>

        {/* Title + meta */}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.itemTitle, done && styles.dimmed]}>{chore.title}</Text>
          <View style={styles.tags}>
            {isOverdue ? (
              <Tag tone="warn">{due}</Tag>
            ) : done ? null : (
              <Tag>{due}</Tag>
            )}
            {chore.scope === 'room' ? (
              <Tag>Whole room</Tag>
            ) : null}
            {chore.repeatInterval ? (
              <Tag>{`↻ ${repeatLabel(chore.repeatInterval, chore.repeatDays)}`}</Tag>
            ) : null}
          </View>
        </View>

        {/* Assignee avatar */}
        {chore.scope === 'person' && assignee ? (
          <Avatar name={assignee.displayName} index={residentIndex[assignee.id] ?? 0} size={36} />
        ) : null}
      </Pressable>
    );
  };

  const isEmpty = items.length === 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ gap: 4 }}>
          <Text style={styles.over}>{roomName.toUpperCase()}</Text>
          <Text style={styles.heading}>Chores</Text>
        </View>

        {error ? <Banner tone="warn">{error}</Banner> : null}

        {isEmpty ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>No chores yet</Text>
            <Text style={styles.emptyBody}>Add one and we'll suggest who should take it.</Text>
          </Card>
        ) : null}

        {groups.overdue.length > 0 ? (
          <Section label="NEEDS DOING">{groups.overdue.map(renderItem)}</Section>
        ) : null}
        {groups.today.length > 0 ? (
          <Section label="DUE TODAY">{groups.today.map(renderItem)}</Section>
        ) : null}
        {groups.week.length > 0 ? (
          <Section label="THIS WEEK">{groups.week.map(renderItem)}</Section>
        ) : null}
        {groups.later.length > 0 ? (
          <Section label="LATER">{groups.later.map(renderItem)}</Section>
        ) : null}
        {groups.done.length > 0 ? (
          <Section label="DONE">{groups.done.map(renderItem)}</Section>
        ) : null}
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={onAdd} accessibilityRole="button" accessibilityLabel="Add chore">
        <Text style={styles.fabLabel}>＋</Text>
      </Pressable>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100, gap: 24 },
  over: { ...font.overline, color: color.inkMuted },
  heading: { ...font.largeTitle, color: color.ink },
  sectionLabel: { ...font.overline, color: color.inkMuted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: color.surface1,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  itemOverdue: { borderColor: color.danger, backgroundColor: '#FFF5F5' },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: color.brand, borderColor: color.brand },
  circleCheck: { color: color.brandInk, fontSize: 13, fontWeight: '700' },
  itemTitle: { ...font.callout, color: color.ink },
  dimmed: { color: color.inkMuted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  empty: { gap: 8, alignItems: 'center' },
  emptyTitle: { ...font.heading, color: color.ink },
  emptyBody: { ...font.body, color: color.inkMuted, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabLabel: { color: color.brandInk, fontSize: 28, lineHeight: 32 },
});
