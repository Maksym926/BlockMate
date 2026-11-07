import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, Muted, Screen, Title } from '../ui/components';
import { color, font } from '../ui/theme';

export function Welcome({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.mark} />
        <Title>Your flat, sorted.</Title>
        <Muted>Bins, cleaning, washing liquid. See who did what and keep it fair, with no sign-up.</Muted>
      </View>
      <View style={styles.actions}>
        <Card>
          <View style={styles.avatars}>
            <Avatar name="M" index={0} size={28} />
            <Avatar name="A" index={1} size={28} />
            <Avatar name="A" index={2} size={28} />
            <Text style={styles.caption}>Everyone in the flat, one room</Text>
          </View>
        </Card>
        <Button label="Create room" onPress={onCreate} />
        <Button label="Join room" variant="tint" onPress={onJoin} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', gap: 16, alignItems: 'flex-start' },
  mark: { width: 56, height: 56, borderRadius: 16, backgroundColor: color.brand },
  actions: { gap: 12 },
  avatars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  caption: { ...font.caption, color: color.inkMuted, marginLeft: 8 },
});
