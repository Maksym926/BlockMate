import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, Button, Field, Muted, Screen, Title } from '../ui/components';
import { CODE_REQUIRED_MESSAGE, messageFor } from '../ui/messages';
import { useSingleFlight } from '../ui/useSingleFlight';

export function JoinCode({
  onBack,
  onCreateInstead,
  lookUp,
  cameraDenied,
  initialCode = '',
  initialError = null,
}: {
  onBack: () => void;
  onCreateInstead: () => void;
  /** Resolves when the code names a room (the app moves on), rejects otherwise. */
  lookUp: (code: string) => Promise<void>;
  cameraDenied: boolean;
  initialCode?: string;
  initialError?: string | null;
}) {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  const singleFlight = useSingleFlight();

  const submit = () =>
    singleFlight(async () => {
      if (!code.trim()) {
        setError(CODE_REQUIRED_MESSAGE);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await lookUp(code);
      } catch (e) {
        setError(messageFor(e)); // 4b: invalid code or room gone, stay here for a retry
        setBusy(false);
      }
    });

  return (
    <Screen onBack={onBack}>
      <View style={styles.form}>
        <Title>Type the code</Title>
        <Muted>No worries, the short code works just as well.</Muted>
        {cameraDenied ? (
          <Banner tone="warn">Camera access is off, so we can't scan. You can allow it later in Settings.</Banner>
        ) : null}
        <Field
          label="Room code"
          value={code}
          onChangeText={(t) => {
            setCode(t.toUpperCase());
            setError(null);
          }}
          error={error}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9} // 6 characters plus room for a space or dash typed in the middle, which the server ignores
          returnKeyType="go"
          onSubmitEditing={submit}
        />
      </View>
      <View style={{ gap: 12 }}>
        <Button label="Join room" onPress={submit} loading={busy} />
        {error ? <Button label="Create a room instead" variant="ghost" onPress={onCreateInstead} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ form: { flex: 1, gap: 20 } });
