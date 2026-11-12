import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, StatusBar,
  Modal, FlatList, AppState, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { initDB, addSession, getSessions, MAX_VALEUR } from './database';
import { hasPin, setPin, verifyPin, isPinFormatValid, isPinWeak } from './security';

// ---------- Utilitaires ----------

// Échappe le HTML : un nom de produit comme "<b>" ou "</td>" ne peut plus casser/injecter le PDF.
const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// "1 234,5" / "1234.5" -> 1234.5 ; vide ou invalide -> NaN. (parseFloat("1,5") donnait 1 !)
const toNumber = (s) => {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const fmt = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [entier, dec] = String(Math.abs(v)).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  return (v < 0 ? '-' : '') + groupe + (dec ? ',' + dec : '');
};

// SQLite renvoie "YYYY-MM-DD HH:MM:SS" (UTC) : ce format donne "Invalid Date" sur certains moteurs.
const parseDate = (s) => {
  if (!s) return null;
  const str = String(s);
  const d = new Date(str.includes('T') ? str : str.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d;
};
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (s) => {
  const d = parseDate(s);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—';
};

// ---------- Application ----------

function MainApp() {
  const [historique, setHistorique] = useState([]);

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sécurité
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinMode, setPinMode] = useState(null); // null | 'verify' | 'create'
  const [pinStep, setPinStep] = useState('enter'); // 'enter' | 'confirm' (création)
  const [firstPin, setFirstPin] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinBusy, setPinBusy] = useState(false);

  // Formulaire
  const [ingredient, setIngredient] = useState('');
  const [prix, setPrix] = useState('');
  const [kwh, setKwh] = useState('');

  const loadHistorique = useCallback(async () => {
    try {
      setHistorique(await getSessions());
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de lire les données.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
      } catch (e) {
        Alert.alert('Erreur', 'Base de données inaccessible.');
        return;
      }
      loadHistorique();
    })();
  }, [loadHistorique]);

  // Verrouillage automatique dès que l'app quitte l'écran (retour accueil, changement d'app...)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setIsUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  const totaux = useMemo(
    () => ({
      ca: historique.reduce((s, i) => s + (i.prix_facture || 0), 0),
      kwh: historique.reduce((s, i) => s + (i.kwh_consomme || 0), 0),
      cout: historique.reduce((s, i) => s + (i.cout_energie || 0), 0),
      benefice: historique.reduce((s, i) => s + (i.benefice_net || 0), 0),
    }),
    [historique]
  );

  // ----- Ajout d'une opération -----
  const handleSave = async () => {
    if (saving) return; // évite les doublons si on appuie deux fois
    const prixNum = toNumber(prix);
    const kwhNum = toNumber(kwh);

    if (Number.isNaN(prixNum) || Number.isNaN(kwhNum)) {
      Alert.alert('Action requise', 'Veuillez saisir un prix et des kWh valides (ex : 1500 et 2,5).');
      return;
    }
    if (prixNum < 0 || kwhNum < 0 || prixNum > MAX_VALEUR || kwhNum > MAX_VALEUR) {
      Alert.alert('Valeur incorrecte', 'Les valeurs doivent être positives et raisonnables.');
      return;
    }

    setSaving(true);
    try {
      await addSession(ingredient.trim() || 'Standard', prixNum, kwhNum);
      setIngredient('');
      setPrix('');
      setKwh('');
      setAddModalVisible(false);
      await loadHistorique();
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'enregistrer.");
    } finally {
      setSaving(false);
    }
  };

  // ----- Code PIN -----
  const resetPinUi = () => {
    setPinMode(null);
    setPinStep('enter');
    setFirstPin('');
    setPinInput('');
  };

  const openPinModal = (mode) => {
    setPinStep('enter');
    setFirstPin('');
    setPinInput('');
    setPinMode(mode);
  };

  const onLockPress = async () => {
    if (isUnlocked) {
      setIsUnlocked(false);
      return;
    }
    try {
      openPinModal((await hasPin()) ? 'verify' : 'create');
    } catch (e) {
      Alert.alert('Erreur', 'Coffre sécurisé indisponible sur ce téléphone.');
    }
  };

  const submitPin = async () => {
    if (pinBusy) return;
    setPinBusy(true);
    try {
      if (pinMode === 'verify') {
        const r = await verifyPin(pinInput);
        setPinInput('');
        if (r.ok) {
          setIsUnlocked(true);
          resetPinUi();
        } else if (r.locked) {
          Alert.alert('Trop de tentatives', `Accès bloqué. Réessayez dans ${r.seconds} seconde(s).`);
        } else {
          Alert.alert('Accès refusé', `Code incorrect. ${r.remaining} essai(s) restant(s).`);
        }
        return;
      }

      // Création / changement du code
      if (!isPinFormatValid(pinInput)) {
        Alert.alert('Code invalide', 'Le code doit contenir 4 à 6 chiffres.');
        return;
      }
      if (pinStep === 'enter') {
        if (isPinWeak(pinInput)) {
          Alert.alert('Code trop faible', 'Évitez 1234, 0000, 1111... Choisissez un code moins prévisible.');
          return;
        }
        setFirstPin(pinInput);
        setPinInput('');
        setPinStep('confirm');
        return;
      }
      if (pinInput !== firstPin) {
        Alert.alert('Codes différents', 'Les deux codes ne correspondent pas. Recommencez.');
        setPinStep('enter');
        setFirstPin('');
        setPinInput('');
        return;
      }
      await setPin(pinInput);
      setIsUnlocked(true);
      resetPinUi();
      Alert.alert('Code enregistré', 'Retenez-le bien : il ne peut pas être récupéré.');
    } catch (e) {
      Alert.alert('Erreur', 'Opération de sécurité impossible.');
    } finally {
      setPinBusy(false);
    }
  };

  // ----- Export PDF -----
  const generatePDF = async () => {
    if (!isUnlocked) return;

    const rows = historique
      .map(
        (item) => `
      <tr>
        <td>${escapeHtml(fmtDate(item.date_session))}</td>
        <td class="b">${escapeHtml(item.ingredient)}</td>
        <td>${escapeHtml(fmt(item.prix_facture))} FCFA</td>
        <td>${escapeHtml(fmt(item.kwh_consomme))} kWh</td>
        <td class="${item.benefice_net < 0 ? 'neg' : 'pos'}">${escapeHtml(fmt(item.benefice_net))} FCFA</td>
      </tr>`
      )
      .join('');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1E293B; }
            h1 { color: #000; text-align: center; }
            .card { background: #F8FAFC; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; text-align: left; }
            th { padding: 12px; background-color: #F1F5F9; border-bottom: 2px solid #E2E8F0; }
            td { padding: 12px; border-bottom: 1px solid #E2E8F0; }
            .b { font-weight: 500; } .pos { color: #10B981; font-weight: bold; } .neg { color: #EF4444; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>MON MOULIN - CONFIDENTIEL</h1>
          <p style="text-align:center">Édité le ${escapeHtml(fmtDate(new Date().toISOString()))}</p>
          <div class="card">
            <h3>Bilan Financier Réel</h3>
            <p><strong>Chiffre d'Affaires :</strong> ${escapeHtml(fmt(totaux.ca))} FCFA</p>
            <p><strong>Coût Électrique :</strong> ${escapeHtml(fmt(totaux.cout))} FCFA</p>
            <h2 class="${totaux.benefice < 0 ? 'neg' : 'pos'}">Bénéfice Net : ${escapeHtml(fmt(totaux.benefice))} FCFA</h2>
          </div>
          <table>
            <tr><th>Date</th><th>Produit</th><th>CA</th><th>Énergie</th><th>Bénéfice</th></tr>
            ${rows}
          </table>
        </body>
      </html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Partage indisponible', "Le partage de fichiers n'est pas disponible sur cet appareil.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Rapport Mon Moulin' });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer le document PDF.');
    }
  };

  const MASQUE = '••••••';

  // Verrouillé : montants et kWh masqués (sinon le bénéfice se recalcule : montant - kWh x tarif).
  const renderItem = ({ item }) => (
    <View style={styles.tweetCard}>
      <View style={styles.avatar} />
      <View style={styles.tweetContent}>
        <View style={styles.tweetHeader}>
          <Text style={styles.tweetName} numberOfLines={1}>{item.ingredient}</Text>
          <Text style={styles.tweetHandle}>@{fmtDate(item.date_session)}</Text>
        </View>
        <Text style={styles.tweetText}>
          Montant encaissé :{' '}
          <Text style={styles.highlight}>{isUnlocked ? `${fmt(item.prix_facture)} FCFA` : MASQUE}</Text>
        </Text>
        <Text style={styles.tweetText}>
          Énergie consommée : {isUnlocked ? `${fmt(item.kwh_consomme)} kWh` : MASQUE}
        </Text>
      </View>
    </View>
  );

  const pinTitle =
    pinMode === 'verify' ? 'Code de sécurité'
    : pinStep === 'enter' ? 'Créer votre code'
    : 'Confirmer le code';
  const pinSub =
    pinMode === 'verify' ? 'Saisissez votre code pour voir les bénéfices.'
    : pinStep === 'enter' ? 'Choisissez un code de 4 à 6 chiffres.'
    : 'Saisissez à nouveau le même code.';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Accueil</Text>
        <TouchableOpacity onPress={onLockPress}>
          <Text style={styles.lockButton}>{isUnlocked ? '🔓 Bilan Ouvert' : '🔒 Voir Bénéfices'}</Text>
        </TouchableOpacity>
      </View>

      {isUnlocked && (
        <View style={styles.confidentialZone}>
          <Text style={styles.confidentialTitle}>Espace Gérant</Text>
          <Text style={[styles.confidentialText, totaux.benefice < 0 && { color: '#EF4444' }]}>
            Total Bénéfice Net : {fmt(totaux.benefice)} FCFA
          </Text>
          <TouchableOpacity style={styles.exportBtn} onPress={generatePDF}>
            <Text style={styles.exportBtnText}>Exporter le rapport détaillé (PDF)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => openPinModal('create')}>
            <Text style={styles.linkBtnText}>Changer le code</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={historique}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        extraData={isUnlocked}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<Text style={styles.emptyText}>Aucune opération pour le moment.</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* MODAL AJOUT */}
      <Modal animationType="slide" transparent visible={isAddModalVisible} onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Nouvelle opération</Text>

            <TextInput style={styles.input} placeholder="Produit (ex: Maïs, Tomate...)" placeholderTextColor="#657786" maxLength={60} value={ingredient} onChangeText={setIngredient} />
            <TextInput style={styles.input} placeholder="Montant encaissé (FCFA)" placeholderTextColor="#657786" keyboardType="decimal-pad" value={prix} onChangeText={setPrix} />
            <TextInput style={styles.input} placeholder="Consommation (kWh)" placeholderTextColor="#657786" keyboardType="decimal-pad" value={kwh} onChangeText={setKwh} />

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.submitBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL CODE PIN */}
      <Modal animationType="fade" transparent visible={pinMode !== null} onRequestClose={resetPinUi}>
        <View style={styles.modalOverlayCenter}>
          <View style={styles.securityBox}>
            <Text style={styles.securityTitle}>{pinTitle}</Text>
            <Text style={styles.securitySub}>{pinSub}</Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
              value={pinInput}
              onChangeText={(t) => setPinInput(t.replace(/\D/g, ''))}
              autoFocus
              autoCorrect={false}
              autoComplete="off"
              importantForAutofill="no"
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetPinUi}>
                <Text style={styles.cancelBtnText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, pinBusy && { opacity: 0.5 }]} onPress={submitPin} disabled={pinBusy}>
                <Text style={styles.submitBtnText}>
                  {pinMode === 'verify' ? 'Déverrouiller' : pinStep === 'enter' ? 'Suivant' : 'Valider'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#2F3336' },
  headerTitle: { color: '#E7E9EA', fontSize: 20, fontWeight: 'bold' },
  lockButton: { color: '#1D9BF0', fontSize: 16, fontWeight: 'bold' },

  tweetCard: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#2F3336' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2F3336', marginRight: 10 },
  tweetContent: { flex: 1 },
  tweetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  tweetName: { color: '#E7E9EA', fontWeight: 'bold', fontSize: 16, marginRight: 5, flexShrink: 1 },
  tweetHandle: { color: '#71767B', fontSize: 14 },
  tweetText: { color: '#E7E9EA', fontSize: 15, marginTop: 2 },
  highlight: { color: '#1D9BF0', fontWeight: 'bold' },
  emptyText: { color: '#71767B', textAlign: 'center', marginTop: 50, fontSize: 16 },

  confidentialZone: { backgroundColor: '#16181C', margin: 15, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#333639' },
  confidentialTitle: { color: '#E7E9EA', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  confidentialText: { color: '#10B981', fontSize: 22, fontWeight: '900', marginBottom: 15 },
  exportBtn: { backgroundColor: '#E7E9EA', padding: 12, borderRadius: 20, alignItems: 'center' },
  exportBtnText: { color: '#0F1419', fontWeight: 'bold', fontSize: 15 },
  linkBtn: { alignItems: 'center', paddingTop: 14 },
  linkBtnText: { color: '#1D9BF0', fontSize: 14, fontWeight: '600' },

  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#1D9BF0', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#1D9BF0', shadowOpacity: 0.3, shadowRadius: 10 },
  fabIcon: { color: '#FFFFFF', fontSize: 32, fontWeight: '300', marginTop: -4 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, minHeight: 350 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { color: '#0F1419', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  input: { backgroundColor: '#F7F9F9', borderWidth: 1, borderColor: '#E1E8ED', borderRadius: 12, padding: 15, fontSize: 16, color: '#0F1419', marginBottom: 15 },

  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, padding: 15, alignItems: 'center', backgroundColor: '#F7F9F9', borderRadius: 25, marginRight: 10 },
  cancelBtnText: { color: '#0F1419', fontWeight: 'bold', fontSize: 16 },
  submitBtn: { flex: 1, padding: 15, alignItems: 'center', backgroundColor: '#0F1419', borderRadius: 25 },
  submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },

  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  securityBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 25 },
  securityTitle: { fontSize: 20, fontWeight: 'bold', color: '#0F1419', marginBottom: 10, textAlign: 'center' },
  securitySub: { fontSize: 14, color: '#657786', textAlign: 'center', marginBottom: 20 },
  pinInput: { backgroundColor: '#F7F9F9', borderWidth: 1, borderColor: '#E1E8ED', borderRadius: 12, padding: 15, fontSize: 24, letterSpacing: 10, textAlign: 'center', color: '#0F1419', marginBottom: 20 },
});
