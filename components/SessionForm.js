import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../theme';
import { Btn, Chip, Card, MASK } from './ui';
import { toNumber, fmt, fmtPct } from '../utils';
import { MAX_VALEUR } from '../database';

const QUICK = [500, 1000, 5000];
const asText = (n) => String(n).replace('.', ',');

export default function SessionForm({ visible, initial, settings, unlocked, recentProducts, onClose, onSubmit }) {
  const [ingredient, setIngredient] = useState('');
  const [prix, setPrix] = useState('');
  const [kwh, setKwh] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const editing = !!initial;
  const tarif = Number.isFinite(initial?.tarif) ? initial.tarif : settings.tarif;

  useEffect(() => {
    if (!visible) return;
    setIngredient(initial?.ingredient ?? '');
    setPrix(initial ? asText(initial.prix_facture) : '');
    setKwh(initial ? asText(initial.kwh_consomme) : '');
    setNote(initial?.note ?? '');
    setTouched(false);
    setSaving(false);
  }, [visible, initial]);

  const prixNum = toNumber(prix);
  const kwhNum = toNumber(kwh);
  const prixOk = !Number.isNaN(prixNum) && prixNum >= 0 && prixNum <= MAX_VALEUR;
  const kwhOk = !Number.isNaN(kwhNum) && kwhNum >= 0 && kwhNum <= MAX_VALEUR;
  const valid = prixOk && kwhOk;

  const cout = kwhOk ? kwhNum * tarif : 0;
  const benefice = valid ? prixNum - cout : null;
  const marge = valid && prixNum > 0 ? (benefice / prixNum) * 100 : null;

  const addPrix = (n) => {
    const base = Number.isNaN(prixNum) ? 0 : prixNum;
    setPrix(asText(base + n));
  };

  const save = async (another) => {
    setTouched(true);
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit(
        { ingredient: ingredient.trim() || 'Standard', prix: prixNum, kwh: kwhNum, note: note.trim(), tarif },
        initial?.id
      );
      if (another && !editing) {
        setIngredient('');
        setPrix('');
        setKwh('');
        setNote('');
        setTouched(false);
      } else {
        onClose();
      }
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal animationType="slide" visible={visible} onRequestClose={onClose}>
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.close}>✕</Text>
          </TouchableOpacity>
          <Text style={s.title}>{editing ? "Modifier l'opération" : 'Nouvelle opération'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Produit</Text>
            <TextInput style={s.input} placeholder="Ex : Maïs, Manioc, Tomate…" placeholderTextColor={C.muted} maxLength={60} value={ingredient} onChangeText={setIngredient} />
            {recentProducts.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 14 }}>
                {recentProducts.map((p) => (
                  <Chip key={p} label={p} active={ingredient.trim().toLowerCase() === p.toLowerCase()} onPress={() => setIngredient(p)} />
                ))}
              </ScrollView>
            )}

            <Text style={s.label}>Montant encaissé (FCFA)</Text>
            <TextInput style={[s.input, touched && !prixOk && s.inputErr]} placeholder="0" placeholderTextColor={C.muted} keyboardType="decimal-pad" value={prix} onChangeText={setPrix} />
            {touched && !prixOk ? <Text style={s.err}>Saisissez un montant valide (ex : 1500).</Text> : null}
            <View style={s.quickRow}>
              {QUICK.map((n) => (
                <TouchableOpacity key={n} style={s.quick} onPress={() => addPrix(n)}>
                  <Text style={s.quickText}>+{fmt(n)}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.quick} onPress={() => setPrix('')}>
                <Text style={s.quickText}>Effacer</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Consommation électrique (kWh)</Text>
            <TextInput style={[s.input, touched && !kwhOk && s.inputErr]} placeholder="0" placeholderTextColor={C.muted} keyboardType="decimal-pad" value={kwh} onChangeText={setKwh} />
            {touched && !kwhOk ? <Text style={s.err}>Saisissez les kWh (ex : 2,5).</Text> : null}

            <Text style={[s.label, { marginTop: 14 }]}>Note (facultatif)</Text>
            <TextInput style={s.input} placeholder="Ex : client Koffi, sac de 50 kg…" placeholderTextColor={C.muted} maxLength={200} value={note} onChangeText={setNote} />

            <Card style={{ marginTop: 6 }}>
              <Text style={s.previewTitle}>Aperçu en direct</Text>
              {unlocked ? (
                <>
                  <View style={s.pRow}><Text style={s.pLabel}>Coût énergie ({fmt(tarif)} F/kWh)</Text><Text style={s.pValue}>{fmt(cout)} FCFA</Text></View>
                  <View style={s.pRow}>
                    <Text style={s.pLabel}>Bénéfice estimé</Text>
                    <Text style={[s.pValue, s.pBig, benefice !== null && { color: benefice < 0 ? C.red : C.green }]}>{benefice === null ? '—' : `${fmt(benefice)} FCFA`}</Text>
                  </View>
                  <View style={s.pRow}><Text style={s.pLabel}>Marge</Text><Text style={s.pValue}>{marge === null ? '—' : fmtPct(marge)}</Text></View>
                  {benefice !== null && benefice < 0 ? <Text style={s.warn}>⚠️ Cette opération est à perte : l'électricité coûte plus que l'encaissement.</Text> : null}
                </>
              ) : (
                <>
                  <View style={s.pRow}><Text style={s.pLabel}>Coût énergie</Text><Text style={s.pValue}>{MASK}</Text></View>
                  <View style={s.pRow}><Text style={s.pLabel}>Bénéfice estimé</Text><Text style={s.pValue}>{MASK}</Text></View>
                  <Text style={s.hint}>🔒 Déverrouillez l'application pour voir le bénéfice en direct.</Text>
                </>
              )}
            </Card>

            <Btn title={editing ? 'Enregistrer les modifications' : 'Enregistrer'} onPress={() => save(false)} disabled={saving} />
            {!editing && <Btn title="Enregistrer et en ajouter une autre" kind="ghost" onPress={() => save(true)} disabled={saving} style={{ marginTop: 10 }} />}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  close: { color: C.text, fontSize: 22 },
  title: { color: C.text, fontSize: 18, fontWeight: '800' },
  label: { color: C.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 16, color: C.text, marginBottom: 10 },
  inputErr: { borderColor: C.red },
  err: { color: C.red, fontSize: 12, marginTop: -4, marginBottom: 8 },
  quickRow: { flexDirection: 'row', marginBottom: 14 },
  quick: { backgroundColor: C.card2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, borderWidth: 1, borderColor: C.border },
  quickText: { color: C.text, fontSize: 13, fontWeight: '600' },
  previewTitle: { color: C.text, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  pRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  pLabel: { color: C.muted, fontSize: 14, flexShrink: 1, paddingRight: 8 },
  pValue: { color: C.text, fontSize: 14, fontWeight: '700' },
  pBig: { fontSize: 17, fontWeight: '900' },
  warn: { color: C.orange, fontSize: 13, marginTop: 8 },
  hint: { color: C.muted, fontSize: 13, marginTop: 8 },
});
