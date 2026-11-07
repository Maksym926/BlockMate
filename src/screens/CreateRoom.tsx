import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { roomsApi, RoomError, type Room } from '../data/app';
import { Banner, Button, Field, Muted, Screen, Title } from '../ui/components';
import { messageFor, NAME_REQUIRED_MESSAGE, ROOM_NAME_REQUIRED_MESSAGE } from '../ui/messages';
import { useSingleFlight } from '../ui/useSingleFlight';

type Errors = { room?: string; name?: string; general?: string };

export function CreateRoom({ onBack, onCreated }: { onBack: () => void; onCreated: (room: Room) => void }) {
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const singleFlight = useSingleFlight(); // Enter bypasses the disabled button, so guard against double submits

  const submit = () =>
    singleFlight(async () => {
      // 1a: empty names are caught here; the server enforces the same rules.
      const missing: Errors = {};
      if (!roomName.trim()) missing.room = ROOM_NAME_REQUIRED_MESSAGE;
      if (!displayName.trim()) missing.name = NAME_REQUIRED_MESSAGE;
      setErrors(missing);
      if (missing.room || missing.name) return;

      setBusy(true);
      try {
        onCreated(await roomsApi.create(roomName, displayName));
      } catch (e) {
        const code = e instanceof RoomError ? e.code : 'UNKNOWN';
        const field = code === 'NAME_REQUIRED' ? 'name' : code === 'ROOM_NAME_REQUIRED' ? 'room' : 'general';
        setErrors({ [field]: messageFor(e) });
        setBusy(false);
      }
    });

  const edit = (field: 'room' | 'name', set: (text: string) => void) => (text: string) => {
    set(text);
    setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
  };

  return (
    <Screen onBack={onBack}>
      <View style={styles.form}>
        <Title>Set up your room</Title>
        <Muted>One room per flat. Flatmates join with a QR code.</Muted>
        {errors.general ? <Banner tone="danger">{errors.general}</Banner> : null}
        <Field
          label="Room name"
          placeholder="Flat 12B"
          value={roomName}
          onChangeText={edit('room', setRoomName)}
          error={errors.room}
          returnKeyType="next"
        />
        <Field
          label="Your name"
          placeholder="e.g. Maya"
          value={displayName}
          onChangeText={edit('name', setDisplayName)}
          error={errors.name}
          help="This is what your flatmates will see."
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </View>
      <Button label="Create room" onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { flex: 1, gap: 20 } });
