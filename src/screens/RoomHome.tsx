import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChoreWithOccurrence, Room, SuggestionResult } from '../data/app';
import { choresApi } from '../data/app';
import { Banner, Button, Card, ResidentRow, TabBar } from '../ui/components';
import { defaultDueAt, joinedLabel } from '../ui/format';
import { color, font } from '../ui/theme';
import { useChores } from '../ui/useChores';
import { useResidents } from '../ui/useResidents';
import type { ChoreFormData } from './AddChore';
import { AddChore } from './AddChore';
import { AssigneePicker } from './AssigneePicker';
import { ChoreDetail } from './ChoreDetail';
import type { CompleteViewResult } from './ChoreCompleted';
import { ChoreCompleted } from './ChoreCompleted';
import { ChoreList } from './ChoreList';

type Tab = 'chores' | 'shopping' | 'flat';

type InRoomView =
  | { name: 'tabs'; activeTab: Tab }
  | { name: 'addChore' }
  | { name: 'pickAssignee'; data: ChoreFormData; suggestion: SuggestionResult | null }
  | { name: 'choreDetail'; item: ChoreWithOccurrence }
  | { name: 'choreCompleted'; result: CompleteViewResult };

export function RoomHome({ room, onShowCode }: { room: Room; onShowCode: () => void }) {
  const { residents, loaded, error: residentsError } = useResidents(room.id);
  const { items: choreItems, error: choreError } = useChores(room.id);
  const [view, setView] = useState<InRoomView>({ name: 'tabs', activeTab: 'flat' });
  const [newcomer, setNewcomer] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    if (known.current) {
      const arrived = residents.find((r) => !known.current!.has(r.id) && !r.isYou);
      if (arrived) setNewcomer(arrived.displayName);
    }
    known.current = new Set(residents.map((r) => r.id));
  }, [residents, loaded]);

  // ── Chore creation helpers ───────────────────────────────────────────────

  const createChore = async (
    data: ChoreFormData,
    assigneeId: string | null,
    suggestionSource: 'ai' | 'fallback' | 'manual' = 'manual',
    suggestionReason: string | null = null,
  ) => {
    await choresApi.create({
      roomId: room.id,
      title: data.title,
      repeatInterval: data.repeatInterval,
      repeatDays: data.repeatDays,
      scope: data.scope,
      assigneeId,
      dueAt: defaultDueAt(),
      suggestionSource,
      suggestionReason,
    });
    setView({ name: 'tabs', activeTab: 'chores' });
  };

  const handleDelete = (choreId: string) => {
    choresApi.delete(choreId).catch(() => {});
  };

  // ── Full-screen overlays (above tab structure) ───────────────────────────

  if (view.name === 'addChore') {
    return (
      <AddChore
        onClose={() => setView({ name: 'tabs', activeTab: 'chores' })}
        onPickAssignee={async (data) => {
          // Call the AI Edge Function while the button shows loading; fall back silently.
          let suggestion: SuggestionResult | null = null;
          try { suggestion = await choresApi.suggest(room.id, data.title); } catch {}
          setView({ name: 'pickAssignee', data, suggestion });
        }}
        onCreateRoomScope={(data) => createChore(data, null)}
      />
    );
  }

  if (view.name === 'pickAssignee') {
    const { suggestion } = view;
    return (
      <AssigneePicker
        choreTitle={view.data.title}
        residents={residents}
        suggestion={suggestion}
        onBack={() => setView({ name: 'addChore' })}
        onAssign={(residentId) => {
          const isAiPick = suggestion && residentId === suggestion.assigneeId;
          return createChore(
            view.data,
            residentId,
            isAiPick ? suggestion.source : 'manual',
            isAiPick ? suggestion.reason : null,
          );
        }}
      />
    );
  }

  if (view.name === 'choreDetail') {
    return (
      <ChoreDetail
        item={view.item}
        residents={residents}
        onBack={() => setView({ name: 'tabs', activeTab: 'chores' })}
        onComplete={async () => {
          const completion = await choresApi.complete(view.item.occurrence.id);
          setView({
            name: 'choreCompleted',
            result: {
              completion,
              choreTitle: view.item.chore.title,
              flatmateCount: residents.length,
            },
          });
        }}
      />
    );
  }

  if (view.name === 'choreCompleted') {
    return (
      <ChoreCompleted
        result={view.result}
        onDone={() => setView({ name: 'tabs', activeTab: 'chores' })}
      />
    );
  }

  // ── Tabbed view ──────────────────────────────────────────────────────────

  const { activeTab } = view;

  const flatContent = (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={{ gap: 8 }}>
        <Text style={styles.over}>YOUR ROOM</Text>
        <Text style={styles.title}>{room.name}</Text>
      </View>
      {residentsError ? <Banner tone="warn">{residentsError}</Banner> : null}
      {newcomer ? (
        <Banner tone="brand">
          {`${newcomer} just joined. ${residents.length === 2 ? "You're both in." : "You're all in."}`}
        </Banner>
      ) : null}
      <View style={{ gap: 12 }}>
        <Text style={styles.over}>{loaded ? `FLATMATES · ${residents.length}` : 'FLATMATES'}</Text>
        <Card style={{ gap: 16 }}>
          {residents.map((r, i) => (
            <ResidentRow key={r.id} resident={r} index={i} caption={joinedLabel(r.joinedAt, new Date(), i === 0)} />
          ))}
        </Card>
        <Button label="Show QR to invite more" variant="tint" onPress={onShowCode} />
      </View>
      {/* No chores yet nudge */}
      {choreItems.length === 0 ? (
        <Card style={styles.choreNudge}>
          <Text style={styles.nudgeTitle}>No chores yet</Text>
          <Text style={styles.nudgeBody}>Add the first one and we'll suggest who should take it.</Text>
          <Pressable
            style={styles.nudgeBtn}
            onPress={() => setView({ name: 'addChore' })}
            accessibilityRole="button"
          >
            <Text style={styles.nudgeBtnLabel}>＋ Add chore</Text>
          </Pressable>
        </Card>
      ) : null}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ flex: 1 }}>
        {activeTab === 'chores' ? (
          <ChoreList
            roomName={room.name}
            items={choreItems}
            residents={residents}
            error={choreError}
            onAdd={() => setView({ name: 'addChore' })}
            onDelete={handleDelete}
            onSelect={(item) => setView({ name: 'choreDetail', item })}
          />
        ) : activeTab === 'shopping' ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>Shopping list coming soon</Text>
          </View>
        ) : (
          flatContent
        )}
      </View>
      <TabBar activeTab={activeTab} onTab={(tab) => setView({ name: 'tabs', activeTab: tab })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.surface0 },
  scroll: { gap: 24, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16 },
  over: { ...font.overline, color: color.inkMuted },
  title: { ...font.largeTitle, color: color.ink },
  choreNudge: { gap: 10, alignItems: 'flex-start' },
  nudgeTitle: { ...font.heading, color: color.ink },
  nudgeBody: { ...font.body, color: color.inkMuted },
  nudgeBtn: {
    backgroundColor: color.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  nudgeBtnLabel: { ...font.callout, color: color.brandInk },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { ...font.body, color: color.inkMuted },
});
