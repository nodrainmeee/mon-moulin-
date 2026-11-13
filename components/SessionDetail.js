import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';
import { Btn, MASK } from './ui';
import { fmt, fmtPct, fmtDateTime, colorForName, initial } from '../utils';

export default function SessionDetail({ item, unlocked, onClose, onEdit, onDelete, onUnlock }) {
  if (!item) return null;
  const tarif = Number.isFinite(item.tarif) ? item.tarif : null;
  const marge = item.prix_facture > 0 ? (item.benefice_net / item.prix_facture) * 100 : null;
  const v = (txt) => (unlocked ? txt : MASK);

  return (
    <Modal animationType="slide" transparent visible onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <View style={s.handle} />
          <View style={s.head}>
            <View style={[s.avatar, { backgroundColor: colorForName(item.ingredient) }]}>
              <Text style={s.avatarText}>{initial(item.ingredient)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>{item.ingredient}</Text>
              <Text style={s.date}>{fmtDateTime(item.date_session)}</Text>
            </View>
          </View>

          <Row label="Montant encaissé" value={v(`${fmt(item.prix_facture)} FCFA`)} />
          <Row label="Énergie consommée" value={v(`${fmt(item.kwh_consomme)} kWh`)} />
          {tarif !== null && <Row label="Tarif appliqué" value={v(`${fmt(tarif)} FCFA/kWh`)} />}
          <Row label="Coût énergie" value={v(`${fmt(item.cout_energie)} FCFA`)} />
          <Row
            label="Bénéfice net"
            value={v(`${fmt(item.benefice_net)} FCFA`)}
            color={unlocked ? (item.benefice_net < 0 ? C.red : C.green) : undefined}
            big
          />
          <Row label="Marge" value={v(marge === null ? '—' : fmtPct(marge))} />
          {item.note ? <Row label="Note" value={item.note} /> : null}

          {unlocked ? (
            <View style={{ flexDirection: 'row', marginTop: 18 }}>
              <Btn title="Supprimer" kind="danger" onPress={() => onDelete(item)} style={{ flex: 1, marginRight: 10 }} />
              <Btn title="Modifier" onPress={() => onEdit(item)} style={{ flex: 1 }} />
            </View>
          ) : (
            <View style={{ marginTop: 18 }}>
              <Text style={s.hint}>🔒 Déverrouillez pour voir les montants, modifier ou supprimer.</Text>
              <Btn title="Déverrouiller" onPress={onUnlock} />
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const Row = ({ label, value, color, big }) => (
  <View style={s.row}>
    <Text style={s.label}>{label}</Text>
    <Text style={[s.value, big && { fontSize: 18, fontWeight: '900' }, color && { color }]}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 30, borderWidth: 1, borderColor: C.border },
  handle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: C.white, fontWeight: '900', fontSize: 20 },
  name: { color: C.text, fontSize: 19, fontWeight: '800' },
  date: { color: C.muted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { color: C.muted, fontSize: 14 },
  value: { color: C.text, fontSize: 15, fontWeight: '700', flexShrink: 1, textAlign: 'right', paddingLeft: 12 },
  hint: { color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 12 },
});
