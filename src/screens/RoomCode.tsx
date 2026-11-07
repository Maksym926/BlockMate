import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import type { Room } from '../data/app';
import { Banner, Button, Card, Muted, ResidentRow, Screen, Title } from '../ui/components';
import { useResidents } from '../ui/useResidents';
import { color, font } from '../ui/theme';

export function RoomCode({ room, onBack, onOpen }: { room: Room; onBack: () => void; onOpen: () => void }) {
  const { residents, error } = useResidents(room.id);

  const share = () =>
    Share.share({ message: `Join ${room.name} on Shared Space with code ${room.joinCode}` }).catch(() => {});

  return (
    <Screen onBack={onBack}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        <Title>{room.name} is ready</Title>
        <Muted>Ask your flatmates to open the app, tap Join room and scan this.</Muted>
        <Card style={styles.qrCard}>
          {/* D-023: the QR encodes the join code only. */}
          <QRCode value={room.joinCode} size={200} color={color.ink} backgroundColor={color.white} />
          <Text style={styles.over}>OR TYPE THIS CODE</Text>
          <Text accessibilityLabel={`Room code ${room.joinCode.split('').join(' ')}`} style={styles.code}>
            {room.joinCode}
          </Text>
        </Card>
        {error ? <Banner tone="warn">{error}</Banner> : null}
        {residents.map((r, i) => (
          <Card key={r.id} style={styles.resident}>
            <ResidentRow
              resident={r}
              index={i}
              caption={residents.length === 1 ? 'Waiting for flatmates…' : 'In the room'}
            />
          </Card>
        ))}
        <Text style={styles.count}>{residents.length} in room</Text>
      </ScrollView>
      <View style={{ gap: 12 }}>
        <Button label="Open room" onPress={onOpen} />
        <Button label="Share code" variant="ghost" onPress={share} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  qrCard: { alignItems: 'center', gap: 12, padding: 24 },
  over: { ...font.overline, color: color.inkMuted },
  code: { ...font.title, letterSpacing: 4, color: color.ink },
  resident: { borderWidth: 1, borderColor: color.hairline },
  count: { ...font.caption, color: color.brandTintInk, alignSelf: 'flex-start' },
});
