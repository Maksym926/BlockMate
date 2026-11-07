import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { roomsApi, type Room, type RoomPreview } from '../data/app';
import { Avatar, Button, Card, Field, Muted, Screen, Title } from '../ui/components';
import { alreadyInLabel } from '../ui/format';
import { messageFor, NAME_REQUIRED_MESSAGE } from '../ui/messages';
import { color, font, radius } from '../ui/theme';
import { useSingleFlight } from '../ui/useSingleFlight';

export function JoinName({
  code,
  preview,
  onBack,
  onJoined,
}: {
  code: string;
  preview: RoomPreview;
  onBack: () => void;
  onJoined: (room: Room) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const singleFlight = useSingleFlight();

  const submit = () =>
    singleFlight(async () => {
      if (!displayName.trim()) {
        setError(NAME_REQUIRED_MESSAGE); // 1a
        return;
      }
      setBusy(true);
      setError(null);
      try {
        onJoined(await roomsApi.join(code, displayName));
      } catch (e) {
        setError(messageFor(e, preview.roomName)); // D-013: name taken -> ask for another
        setBusy(false);
      }
    });

  return (
    <Screen onBack={onBack}>
      <View style={styles.form}>
        <Title>{`Found ${preview.roomName}`}</Title>
        <Muted>One last thing: what should we call you?</Muted>
        <Card style={styles.found}>
          <Avatar name={preview.residentNames[0] ?? '?'} index={0} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{preview.roomName}</Text>
            <Text style={styles.cap}>{alreadyInLabel(preview.residentNames)}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✓ Room found</Text>
          </View>
        </Card>
        <Field
          label="Your name"
          placeholder="e.g. Alex"
          value={displayName}
          onChangeText={(t) => {
            setDisplayName(t);
            setError(null);
          }}
          error={error}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <Button label={`Join ${preview.roomName}`} onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { flex: 1, gap: 20 },
  found: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: color.hairline },
  name: { ...font.callout, color: color.ink },
  cap: { ...font.caption, color: color.inkMuted },
  badge: { backgroundColor: color.brandTint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { ...font.caption, color: color.brandTintInk, fontWeight: '700' },
});
