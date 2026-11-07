import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Muted, Screen, Title } from '../ui/components';
import { messageFor } from '../ui/messages';
import { color, font } from '../ui/theme';

export function JoinScan({
  onBack,
  onTypeInstead,
  lookUp,
  onScanFailed,
}: {
  onBack: () => void;
  /** Camera denied (4a) or the resident prefers typing. */
  onTypeInstead: (cameraDenied: boolean) => void;
  /** Resolves when the code names a room (the app moves on), rejects otherwise. */
  lookUp: (code: string) => Promise<void>;
  /** Scan read a code but it did not work (4b): the type-the-code screen shows the message for a retry. */
  onScanFailed: (message: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!permission || permission.granted) return;
    if (permission.status === 'undetermined') {
      if (!asked.current) {
        asked.current = true; // ask once, even if this effect re-runs while the prompt is open
        void requestPermission();
      }
      return;
    }
    onTypeInstead(true); // denied (4a)
  }, [permission, requestPermission, onTypeInstead]);

  async function onScanned({ data }: { data: string }) {
    if (handled.current) return; // one lookup per scan, not one per camera frame
    handled.current = true;
    try {
      await lookUp(data);
    } catch (e) {
      onScanFailed(messageFor(e));
    }
  }

  return (
    <Screen onBack={onBack}>
      <Title>Join a room</Title>
      <Muted>Point your camera at the QR code on your flatmate's phone.</Muted>
      <View style={styles.viewfinder}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
        ) : null}
        {permission?.granted ? <Text style={styles.hint}>Looking for a code…</Text> : null}
      </View>
      <Button label="Type the code instead" variant="tint" onPress={() => onTypeInstead(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  viewfinder: { flex: 1, backgroundColor: color.scannerBackdrop, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  hint: {
    ...font.callout,
    color: color.brandInk,
    marginBottom: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
