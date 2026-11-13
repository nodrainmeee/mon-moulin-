import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { C } from '../theme';
import { Card, Btn, LockedCard } from '../components/ui';
import { toNumber, fmt } from '../utils';

export default function Settings({ unlocked, onUnlock, settings, sessionsCount, onSaveSetting, onChangePin, onLockNow, onExportPDF, onExportCSV, onWipe }) {
  const [tarif, setTarif] = useState(String(settings.tarif).replace('.', ','));
  const [objectif, setObjectif] = useState(settings.objectif ? String(settings.objectif) : '');

  useEffect(() => {
    setTarif(String(settings.tarif).replace('.', ','));
    setObjectif(settings.objectif ? String(settings.objectif) : '');
  }, [settings]);

  if (!unlocked) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <LockedCard title="Réglages protégés" text="Le tarif, l'objectif et les exports sont réservés au gérant." onUnlock={onUnlock} />
      </ScrollView>
    );
  }

  const saveTarif = () => {
    const n = toNumber(tarif);
    if (Number.isNaN(n) || n <= 0 || n > 1e6) return Alert.alert('Tarif invalide', 'Saisissez un prix par kWh supérieur à 0 (ex : 200).');
    onSaveSetting('tarif', n, `Tarif enregistré : ${fmt(n)} FCFA/kWh ✓`);
  };
  const saveObjectif = () => {
    const n = objectif.trim() === '' ? 0 : toNumber(objectif);
    if (Number.isNaN(n) || n < 0 || n > 1e9) return Alert.alert('Objectif invalide', 'Saisissez un montant positif (ou laissez vide pour désactiver).');
    onSaveSetting('objectif', n, n === 0 ? 'Objectif désactivé' : `Objectif enregistré : ${fmt(n)} FCFA ✓`);
  };

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={s.group}>Activité</Text>
      <Card>
        <Text style={s.label}>Prix de l'électricité (FCFA par kWh)</Text>
        <View style={s.inline}>
          <TextInput style={s.input} keyboardType="decimal-pad" value={tarif} onChangeText={setTarif} placeholder="200" placeholderTextColor={C.muted} />
          <Btn title="Enregistrer" onPress={saveTarif} style={s.inlineBtn} />
        </View>
        <Text style={s.help}>S'applique aux nouvelles opérations. L'historique garde le tarif de l'époque.</Text>

        <Text style={[s.label, { marginTop: 18 }]}>Objectif de bénéfice mensuel (FCFA)</Text>
        <View style={s.inline}>
          <TextInput style={s.input} keyboardType="decimal-pad" value={objectif} onChangeText={setObjectif} placeholder="Ex : 150000" placeholderTextColor={C.muted} />
          <Btn title="Enregistrer" onPress={saveObjectif} style={s.inlineBtn} />
        </View>
        <Text style={s.help}>Une barre de progression s'affiche sur le tableau de bord. Laissez vide pour la masquer.</Text>
      </Card>

      <Text style={s.group}>Exporter</Text>
      <Card>
        <Text style={s.help}>Le PDF et le CSV suivent la période choisie sur le tableau de bord. Le CSV s'ouvre dans Excel.</Text>
        <Btn title="📄  Rapport PDF" kind="ghost" onPress={onExportPDF} style={{ marginTop: 12 }} />
        <Btn title="📊  Export CSV (Excel)" kind="ghost" onPress={onExportCSV} style={{ marginTop: 10 }} />
      </Card>

      <Text style={s.group}>Sécurité</Text>
      <Card>
        <Btn title="🔒  Verrouiller maintenant" kind="ghost" onPress={onLockNow} />
        <Btn title="🔑  Changer mon code" kind="ghost" onPress={onChangePin} style={{ marginTop: 10 }} />
        <Text style={s.help}>L'app se verrouille seule dès que vous la quittez. 5 mauvais codes = blocage temporaire.</Text>
      </Card>

      <Text style={s.group}>Zone dangereuse</Text>
      <Card style={{ borderColor: C.red }}>
        <Text style={s.help}>{sessionsCount} opération(s) enregistrée(s). Exportez un CSV avant d'effacer : il n'y a pas de sauvegarde automatique.</Text>
        <Btn title="Effacer toutes les données" kind="danger" onPress={onWipe} style={{ marginTop: 12 }} />
      </Card>

      <Text style={s.version}>Mon Moulin · version 2.0 · 100 % hors-ligne</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120 },
  group: { color: C.muted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, marginTop: 6 },
  label: { color: C.text, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  inline: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 13, fontSize: 16, color: C.text, marginRight: 10 },
  inlineBtn: { paddingHorizontal: 16, paddingVertical: 13 },
  help: { color: C.muted, fontSize: 12, marginTop: 8, lineHeight: 17 },
  version: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
