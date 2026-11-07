import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Resident, ShoppingItem } from '../data/app';
import { shoppingApi } from '../data/app';
import { Banner, Card } from '../ui/components';
import { completionTime } from '../ui/format';
import { color, font, radius } from '../ui/theme';
import { useShopping } from '../ui/useShopping';

export function ShoppingList({
  roomId,
  residents,
}: {
  roomId: string;
  residents: Resident[];
}) {
  const { active, bought, error } = useShopping(roomId);
  const [draft, setDraft] = useState('');
  const [duplicate, setDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const now = new Date();

  const residentById = useMemo(
    () => Object.fromEntries(residents.map((r) => [r.id, r])),
    [residents],
  );

  const tryAdd = async () => {
    const name = draft.trim();
    if (!name) return;
    // Case-insensitive duplicate check among active items (D-domain invariant)
    const existing = active.find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setDuplicate({ id: existing.id, name: existing.name });
      return;
    }
    setAdding(true);
    try {
      await shoppingApi.addItem(roomId, name, 1);
      setDraft('');
    } catch {}
    setAdding(false);
  };

  const handleIncrease = async () => {
    if (!duplicate) return;
    setBusyId(duplicate.id);
    try {
      await shoppingApi.increaseQuantity(duplicate.id, 1);
      setDraft('');
      setDuplicate(null);
    } catch {}
    setBusyId(null);
  };

  const handleAddAnyway = async () => {
    if (!duplicate) return;
    const name = draft.trim();
    setAdding(true);
    setDuplicate(null);
    try {
      await shoppingApi.addItem(roomId, name, 1);
      setDraft('');
    } catch {}
    setAdding(false);
  };

  const handleTick = async (item: ShoppingItem) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      if (item.status === 'active') {
        await shoppingApi.tickItem(item.id);
      } else {
        await shoppingApi.untickItem(item.id);
      }
    } catch {}
    setBusyId(null);
  };

  const confirmDelete = (item: ShoppingItem) => {
    Alert.alert('Remove item?', `"${item.name}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setBusyId(item.id);
          shoppingApi.deleteItem(item.id).finally(() => setBusyId(null));
        },
      },
    ]);
  };

  const renderItem = (item: ShoppingItem) => {
    const isBought = item.status === 'bought';
    const adder = residentById[item.addedBy];
    const buyer = item.boughtBy ? residentById[item.boughtBy] : null;
    const displayName = item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name;
    const busy = busyId === item.id;

    return (
      <Pressable
        key={item.id}
        style={[styles.item, isBought && styles.itemBought]}
        onLongPress={() => confirmDelete(item)}
        accessibilityHint="Long press to remove"
      >
        {/* Tick circle */}
        <Pressable
          onPress={() => !busy && handleTick(item)}
          style={[styles.circle, isBought && styles.circleBought]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isBought, busy }}
          accessibilityLabel={isBought ? `Un-tick ${item.name}` : `Tick ${item.name}`}
        >
          {isBought ? <Text style={styles.circleCheck}>✓</Text> : null}
        </Pressable>

        {/* Name + caption */}
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, isBought && styles.itemNameBought]}>{displayName}</Text>
          {isBought && buyer ? (
            <Text style={styles.itemCaption}>
              {buyer.isYou ? 'You' : buyer.displayName},{' '}
              {completionTime(item.boughtAt!, now)}
            </Text>
          ) : adder ? (
            <Text style={styles.itemCaption}>
              Added by {adder.isYou ? 'you' : adder.displayName}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const isEmpty = active.length === 0 && bought.length === 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>Shopping</Text>

        {error ? <Banner tone="warn">{error}</Banner> : null}

        {/* Add form */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="Add an item…"
            placeholderTextColor={color.inkMuted}
            value={draft}
            onChangeText={(t) => { setDraft(t); setDuplicate(null); }}
            onSubmitEditing={tryAdd}
            returnKeyType="done"
            editable={!adding}
            accessibilityLabel="Item name"
          />
          <Pressable
            style={[styles.addBtn, (!draft.trim() || adding) && { opacity: 0.45 }]}
            onPress={tryAdd}
            disabled={!draft.trim() || adding}
            accessibilityRole="button"
            accessibilityLabel="Add item"
          >
            <Text style={styles.addBtnLabel}>＋</Text>
          </Pressable>
        </View>

        {/* Duplicate warning */}
        {duplicate ? (
          <Card style={styles.dupCard}>
            <Text style={styles.dupText}>
              <Text style={{ fontWeight: '700' }}>{duplicate.name}</Text> is already on the list.
            </Text>
            <View style={styles.dupActions}>
              <Pressable
                style={styles.dupBtn}
                onPress={handleIncrease}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity by 1"
              >
                <Text style={styles.dupBtnPrimary}>Increase by 1</Text>
              </Pressable>
              <Pressable
                onPress={handleAddAnyway}
                accessibilityRole="button"
                accessibilityLabel="Add as separate item"
              >
                <Text style={styles.dupBtnGhost}>Add anyway</Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {/* Active items */}
        {isEmpty ? (
          <Card style={styles.empty}>
            <Text style={styles.emptyTitle}>List is empty</Text>
            <Text style={styles.emptyBody}>Add the first item above.</Text>
          </Card>
        ) : active.length > 0 ? (
          <View style={{ gap: 8 }}>
            {active.map(renderItem)}
          </View>
        ) : null}

        {/* Bought section */}
        {bought.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={styles.sectionLabel}>BOUGHT</Text>
            {bought.map(renderItem)}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, gap: 16 },
  heading: { ...font.largeTitle, color: color.ink },
  sectionLabel: { ...font.overline, color: color.inkMuted },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    minHeight: 48,
    backgroundColor: color.surface1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: color.hairline,
    ...font.body,
    color: color.ink,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: color.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnLabel: { color: color.brandInk, fontSize: 24, lineHeight: 28 },
  dupCard: { gap: 10 },
  dupText: { ...font.body, color: color.ink },
  dupActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  dupBtn: {
    backgroundColor: color.brand,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  dupBtnPrimary: { ...font.callout, color: color.brandInk },
  dupBtnGhost: { ...font.callout, color: color.inkMuted },
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
  itemBought: { opacity: 0.65 },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: color.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBought: { backgroundColor: color.brand, borderColor: color.brand },
  circleCheck: { color: color.brandInk, fontSize: 13, fontWeight: '700' },
  itemName: { ...font.callout, color: color.ink },
  itemNameBought: { textDecorationLine: 'line-through', color: color.inkMuted },
  itemCaption: { ...font.caption, color: color.inkMuted, marginTop: 2 },
  empty: { gap: 6, alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { ...font.heading, color: color.ink },
  emptyBody: { ...font.body, color: color.inkMuted },
});
