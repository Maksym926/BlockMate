import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Room } from '../data/app';
import { Banner, Button, Card, ResidentRow, Screen } from '../ui/components';
import { joinedLabel } from '../ui/format';
import { color, font } from '../ui/theme';
import { useResidents } from '../ui/useResidents';

export function RoomHome({ room, onShowCode }: { room: Room; onShowCode: () => void }) {
  const { residents, loaded, error } = useResidents(room.id);
  const [newcomer, setNewcomer] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!loaded) return;
    // First load only records who is here; later arrivals raise the "just joined" banner (story 10).
    if (known.current) {
      const arrived = residents.find((r) => !known.current!.has(r.id) && !r.isYou);
      if (arrived) setNewcomer(arrived.displayName);
    }
    known.current = new Set(residents.map((r) => r.id));
  }, [residents, loaded]);

  const now = new Date();
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={{ gap: 8 }}>
          <Text style={styles.over}>YOUR ROOM</Text>
          <Text style={styles.title}>{room.name}</Text>
        </View>
        {error ? <Banner tone="warn">{error}</Banner> : null}
        {newcomer ? (
          <Banner tone="brand">
            {`${newcomer} just joined. ${residents.length === 2 ? "You're both in." : "You're all in."}`}
          </Banner>
        ) : null}
        <View style={{ gap: 12 }}>
          <Text style={styles.over}>{loaded ? `FLATMATES · ${residents.length}` : 'FLATMATES'}</Text>
          <Card style={{ gap: 16 }}>
            {residents.map((r, i) => (
              <ResidentRow key={r.id} resident={r} index={i} caption={joinedLabel(r.joinedAt, now, i === 0)} />
            ))}
          </Card>
          <Button label="Show QR to invite more" variant="tint" onPress={onShowCode} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 24, paddingTop: 24 },
  over: { ...font.overline, color: color.inkMuted },
  title: { ...font.largeTitle, color: color.ink },
});
