import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { C } from '../theme';
import { fmt } from '../utils';

export const MASK = '••••••';

export const Card = ({ children, style, onPress }) =>
  onPress ? (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[s.card, style]}>{children}</TouchableOpacity>
  ) : (
    <View style={[s.card, style]}>{children}</View>
  );

export const SectionTitle = ({ children, right, onRight }) => (
  <View style={s.sectionRow}>
    <Text style={s.sectionTitle}>{children}</Text>
    {right ? (
      <TouchableOpacity onPress={onRight}><Text style={s.sectionRight}>{right}</Text></TouchableOpacity>
    ) : null}
  </View>
);

export const Segmented = ({ options, value, onChange }) => (
  <View style={s.seg}>
    {options.map((o) => (
      <TouchableOpacity key={o.key} style={[s.segItem, value === o.key && s.segActive]} onPress={() => onChange(o.key)}>
        <Text style={[s.segText, value === o.key && s.segTextActive]} numberOfLines={1}>{o.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

export const Chip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
    <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

export const Btn = ({ title, onPress, kind = 'primary', disabled, style }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={onPress}
    disabled={disabled}
    style={[s.btn, kind === 'primary' && s.btnPrimary, kind === 'ghost' && s.btnGhost, kind === 'danger' && s.btnDanger, disabled && { opacity: 0.4 }, style]}
  >
    <Text style={[s.btnText, kind === 'primary' && { color: C.white }, kind === 'ghost' && { color: C.text }, kind === 'danger' && { color: C.red }]}>{title}</Text>
  </TouchableOpacity>
);

// Affiche un montant, ou •••••• tant que l'app est verrouillée
export const Money = ({ value, unlocked, suffix = 'FCFA', style, signColor }) => {
  const color = unlocked && signColor ? (value < 0 ? C.red : C.green) : null;
  return <Text style={[style, color && { color }]}>{unlocked ? `${fmt(value)}${suffix ? ' ' + suffix : ''}` : MASK}</Text>;
};

export const Progress = ({ ratio, color = C.blue }) => (
  <View style={s.track}>
    <View style={[s.fill, { width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: color }]} />
  </View>
);

export const LockedCard = ({ title = 'Données confidentielles', text = 'Saisissez votre code pour afficher les chiffres.', onUnlock }) => (
  <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
    <Text style={{ fontSize: 34, marginBottom: 8 }}>🔒</Text>
    <Text style={s.lockTitle}>{title}</Text>
    <Text style={s.lockText}>{text}</Text>
    <Btn title="Déverrouiller" onPress={onUnlock} style={{ alignSelf: 'stretch', marginTop: 16 }} />
  </Card>
);

export const EmptyState = ({ icon = '🌾', title, text, action, onAction }) => (
  <View style={{ alignItems: 'center', padding: 32 }}>
    <Text style={{ fontSize: 44, marginBottom: 10 }}>{icon}</Text>
    <Text style={s.lockTitle}>{title}</Text>
    {text ? <Text style={s.lockText}>{text}</Text> : null}
    {action ? <Btn title={action} onPress={onAction} style={{ marginTop: 16, paddingHorizontal: 28 }} /> : null}
  </View>
);

export function Toast({ toast, bottom = 100 }) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toast) return;
    op.setValue(0);
    Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(op, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [toast, op]);
  if (!toast) return null;
  return (
    <Animated.View pointerEvents="none" style={[s.toast, { bottom, opacity: op }]}>
      <Text style={s.toastText}>{toast.text}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 14 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { color: C.text, fontSize: 17, fontWeight: '800' },
  sectionRight: { color: C.blue, fontSize: 14, fontWeight: '600' },
  seg: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: C.border, marginBottom: 14 },
  segItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  segActive: { backgroundColor: C.blue },
  segText: { color: C.muted, fontWeight: '600', fontSize: 13 },
  segTextActive: { color: C.white },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, marginRight: 8 },
  chipActive: { backgroundColor: C.text, borderColor: C.text },
  chipText: { color: C.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: C.bg },
  btn: { paddingVertical: 14, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: C.blue },
  btnGhost: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.border },
  btnDanger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.red },
  btnText: { fontWeight: '700', fontSize: 15 },
  track: { height: 8, backgroundColor: C.card2, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  lockTitle: { color: C.text, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  lockText: { color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 6 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: C.text, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 22, elevation: 8 },
  toastText: { color: C.bg, fontWeight: '700', fontSize: 14 },
});
