import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChoreWithOccurrence, Room, SuggestionResult } from '../data/app';
import { choresApi } from '../data/app';
import { Banner, Button, Card, ResidentRow, TabBar } from '../ui/components';
import { defaultDueAt, joinedLabel, nextDueAt } from '../ui/format';
import { color, font } from '../ui/theme';
import { Toast } from '../ui/Toast';
import { useChoreAlerts } from '../ui/useChoreAlerts';
import { useChores } from '../ui/useChores';
import { useReminders } from '../ui/useReminders';
import { useResidents } from '../ui/useResidents';
import { useToast } from '../ui/useToast';
import type { ChoreFormData } from './AddChore';
import { AddChore } from './AddChore';
import { AssigneePicker } from './AssigneePicker';
import { ChoreDetail } from './ChoreDetail';
import type { CompleteViewResult } from './ChoreCompleted';
import { ChoreCompleted } from './ChoreCompleted';
import { ChoreList } from './ChoreList';
import { ShoppingList } from './ShoppingList';

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
  useReminders(choreItems, residents);
  const { message: toastMessage, show: showToast } = useToast();
  const myResidentId = residents.find((r) => r.isYou)?.id;
  useChoreAlerts(choreItems, residents, myResidentId, showToast);
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
    const { item } = view;
    const canPass =
      item.chore.scope === 'person' &&
      item.occurrence.status !== 'done' &&
      item.occurrence.assigneeId !== null &&
      residents.find((r) => r.id === item.occurrence.assigneeId)?.isYou === true;

    return (
      <ChoreDetail
        item={item}
        residents={residents}
        onBack={() => setView({ name: 'tabs', activeTab: 'chores' })}
        onComplete={async () => {
          const completion = await choresApi.complete(item.occurrence.id);
          // Navigate to success screen immediately; create next occurrence in background (D-007).
          setView({
            name: 'choreCompleted',
            result: {
              completion,
              choreTitle: item.chore.title,
              flatmateCount: residents.length,
            },
          });
          if (item.chore.repeatInterval) {
            void (async () => {
              try {
                const due = nextDueAt(item.occurrence.dueAt, item.chore.repeatInterval, item.chore.repeatDays);
                const nextId = await choresApi.createNextOccurrence(item.chore.id, due);
                if (item.chore.scope === 'person') {
                  const suggestion = await choresApi.suggest(room.id, item.chore.title, [], item.occurrence.assigneeId);
                  if (suggestion) {
                    await choresApi.assign(nextId, suggestion.assigneeId, suggestion.reason, suggestion.source);
                  } else {
                    // Client-side rotation fallback
                    const sorted = [...residents].sort(
                      (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime(),
                    );
                    const lastIdx = sorted.findIndex((r) => r.id === item.occurrence.assigneeId);
                    const next = sorted[(lastIdx + 1) % sorted.length];
                    if (next) await choresApi.assign(nextId, next.id, null, 'fallback');
                  }
                }
                // room-scope: no assignee needed; Realtime will propagate the new occurrence
              } catch {
                // Silently ignore — user is on the success screen, Realtime will refresh
              }
            })();
          }
        }}
        onPass={canPass ? async () => {
          const passResult = await choresApi.pass(item.occurrence.id);
          if (!passResult.allPassed) {
            // Get new AI suggestion (Edge Function handles rotation fallback internally)
            const suggestion = await choresApi.suggest(
              room.id,
              item.chore.title,
              passResult.passedBy,
              passResult.oldAssigneeId,
            );
            if (suggestion) {
              await choresApi.assign(item.occurrence.id, suggestion.assigneeId, suggestion.reason, suggestion.source);
            } else {
              // Client-side rotation: first eligible resident by join order
              const eligible = residents
                .filter((r) => !passResult.passedBy.includes(r.id))
                .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
              if (eligible[0]) {
                await choresApi.assign(item.occurrence.id, eligible[0].id, null, 'fallback');
              }
            }
          }
          setView({ name: 'tabs', activeTab: 'chores' });
        } : undefined}
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
          <ShoppingList roomId={room.id} residents={residents} />
        ) : (
          flatContent
        )}
      </View>
      <TabBar activeTab={activeTab} onTab={(tab) => setView({ name: 'tabs', activeTab: tab })} />
      <Toast message={toastMessage} />
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
});
