import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StatusBar, Alert, AppState, BackHandler, StyleSheet } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from './theme';
import {
  initDB, getSessions, getSettings, setSetting, addSession, updateSession, deleteSession, deleteAllSessions, DEFAULT_SETTINGS,
} from './database';
import { hasPin } from './security';
import { exportPDF, exportCSV } from './report';
import { periodRange, periodLabel, inRange, normName } from './utils';
import { Toast } from './components/ui';
import PinModal from './components/PinModal';
import SessionForm from './components/SessionForm';
import SessionDetail from './components/SessionDetail';
import Dashboard from './screens/Dashboard';
import Journal from './screens/Journal';
import Stats from './screens/Stats';
import Settings from './screens/Settings';

const TABS = [
  { key: 'dashboard', icon: '📊', label: 'Accueil', title: 'Tableau de bord' },
  { key: 'journal', icon: '🧾', label: 'Journal', title: 'Journal' },
  { key: 'add' },
  { key: 'stats', icon: '📈', label: 'Analyses', title: 'Analyses' },
  { key: 'settings', icon: '⚙️', label: 'Réglages', title: 'Réglages' },
];

function Root() {
  const insets = useSafeAreaInsets();

  const [loaded, setLoaded] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const [tab, setTab] = useState('dashboard');
  const [period, setPeriod] = useState('7d');
  const [unlocked, setUnlocked] = useState(false);

  const [form, setForm] = useState({ visible: false, item: null });
  const [detail, setDetail] = useState(null);
  const [pin, setPinState] = useState({ visible: false, mode: 'verify' });
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text) => setToast({ id: Date.now(), text }), []);

  const reload = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([getSessions(), getSettings()]);
      setSessions(s);
      setSettings(st);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de lire les données.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await reload();
      } catch (e) {
        Alert.alert('Erreur', 'Base de données inaccessible.');
      } finally {
        setLoaded(true);
      }
    })();
  }, [reload]);

  // Verrouillage automatique dès que l'app quitte l'écran
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setUnlocked(false);
    });
    return () => sub.remove();
  }, []);

  // Si l'app se reverrouille pendant une modification, on ferme le formulaire (il contient des montants).
  useEffect(() => {
    if (!unlocked) setForm((f) => (f.visible && f.item ? { visible: false, item: null } : f));
  }, [unlocked]);

  // Bouton retour Android : revenir à l'accueil avant de quitter
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'dashboard') {
        setTab('dashboard');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);

  const recentProducts = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const s of sessions) {
      const k = normName(s.ingredient);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(String(s.ingredient || '').trim() || 'Standard');
      if (out.length >= 8) break;
    }
    return out;
  }, [sessions]);

  // ----- Verrouillage -----
  const requestUnlock = async () => {
    try {
      setPinState({ visible: true, mode: (await hasPin()) ? 'verify' : 'create' });
    } catch (e) {
      Alert.alert('Erreur', 'Coffre sécurisé indisponible sur ce téléphone.');
    }
  };
  const lockNow = () => {
    setUnlocked(false);
    showToast('Application verrouillée 🔒');
  };
  const onPinSuccess = (mode) => {
    setUnlocked(true);
    setPinState({ visible: false, mode: 'verify' });
    showToast(mode === 'create' ? 'Code enregistré. Retenez-le bien !' : 'Déverrouillé 🔓');
  };

  // ----- Opérations -----
  const openAdd = () => setForm({ visible: true, item: null });

  const submitSession = async (payload, id) => {
    if (id) await updateSession(id, payload);
    else await addSession(payload);
    await reload();
    showToast(id ? 'Opération modifiée ✓' : 'Opération enregistrée ✓');
  };

  const editFromDetail = (item) => {
    setDetail(null);
    setTimeout(() => setForm({ visible: true, item }), 250);
  };

  const confirmDelete = (item) => {
    Alert.alert('Supprimer cette opération ?', `${item.ingredient} — cette action est définitive.`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSession(item.id);
            setDetail(null);
            await reload();
            showToast('Opération supprimée');
          } catch (e) {
            Alert.alert('Erreur', 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  // ----- Réglages / exports -----
  const saveSetting = async (key, value, message) => {
    try {
      await setSetting(key, value);
      await reload();
      showToast(message);
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'enregistrer le réglage.");
    }
  };

  const currentList = () => {
    const range = periodRange(period);
    return range ? inRange(sessions, range.start, range.end) : sessions;
  };
  const handleExportError = (e) =>
    Alert.alert('Export impossible', e && e.message === 'share-unavailable' ? "Le partage n'est pas disponible sur cet appareil." : "Le fichier n'a pas pu être créé.");

  const doPDF = async () => {
    if (!unlocked) return;
    try { await exportPDF({ sessions: currentList(), label: periodLabel(period) }); } catch (e) { handleExportError(e); }
  };
  const doCSV = async () => {
    if (!unlocked) return;
    try { await exportCSV(currentList()); } catch (e) { handleExportError(e); }
  };

  const wipe = () =>
    Alert.alert('Tout effacer ?', 'Toutes les opérations seront supprimées définitivement.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Tout effacer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAllSessions();
            await reload();
            showToast('Toutes les données ont été effacées');
          } catch (e) {
            Alert.alert('Erreur', 'Effacement impossible.');
          }
        },
      },
    ]);

  if (!loaded) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <Text style={{ fontSize: 46 }}>🌬️</Text>
        <Text style={{ color: C.muted, marginTop: 10 }}>Chargement…</Text>
      </View>
    );
  }

  const current = TABS.find((t) => t.key === tab);
  const show = (k) => ({ flex: 1, display: tab === k ? 'flex' : 'none' });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>MON MOULIN</Text>
          <Text style={styles.title}>{current.title}</Text>
        </View>
        <TouchableOpacity style={[styles.pill, unlocked && styles.pillOpen]} onPress={unlocked ? lockNow : requestUnlock}>
          <Text style={[styles.pillText, unlocked && { color: C.green }]}>{unlocked ? '🔓 Ouvert' : '🔒 Verrouillé'}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <View style={show('dashboard')}>
          <Dashboard
            sessions={sessions} settings={settings} unlocked={unlocked} period={period} setPeriod={setPeriod}
            onUnlock={requestUnlock} onAdd={openAdd} onOpen={setDetail}
            onGoJournal={() => setTab('journal')} onGoSettings={() => setTab('settings')}
          />
        </View>
        <View style={show('journal')}>
          <Journal sessions={sessions} unlocked={unlocked} onOpen={setDetail} onAdd={openAdd} onRefresh={reload} />
        </View>
        <View style={show('stats')}>
          <Stats sessions={sessions} period={period} setPeriod={setPeriod} unlocked={unlocked} onUnlock={requestUnlock} onAdd={openAdd} />
        </View>
        <View style={show('settings')}>
          <Settings
            unlocked={unlocked} onUnlock={requestUnlock} settings={settings} sessionsCount={sessions.length}
            onSaveSetting={saveSetting} onChangePin={() => setPinState({ visible: true, mode: 'create' })}
            onLockNow={lockNow} onExportPDF={doPDF} onExportCSV={doCSV} onWipe={wipe}
          />
        </View>
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {TABS.map((t) =>
          t.key === 'add' ? (
            <TouchableOpacity key="add" style={styles.addWrap} activeOpacity={0.85} onPress={openAdd}>
              <View style={styles.addBtn}><Text style={styles.addIcon}>+</Text></View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <Text style={[styles.tabIcon, tab !== t.key && { opacity: 0.45 }]}>{t.icon}</Text>
              <Text style={[styles.tabLabel, tab === t.key && { color: C.text }]}>{t.label}</Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <Toast toast={toast} bottom={Math.max(insets.bottom, 8) + 84} />

      <SessionForm
        visible={form.visible} initial={form.item} settings={settings} unlocked={unlocked} recentProducts={recentProducts}
        onClose={() => setForm((f) => ({ ...f, visible: false }))} onSubmit={submitSession}
      />
      <SessionDetail
        item={detail} unlocked={unlocked} onClose={() => setDetail(null)} onEdit={editFromDetail}
        onDelete={confirmDelete} onUnlock={() => { setDetail(null); setTimeout(requestUnlock, 250); }}
      />
      <PinModal visible={pin.visible} mode={pin.mode} onClose={() => setPinState((p) => ({ ...p, visible: false }))} onSuccess={onPinSuccess} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  brand: { color: C.blue, fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  title: { color: C.text, fontSize: 22, fontWeight: '900' },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  pillOpen: { borderColor: C.green },
  pillText: { color: C.blue, fontSize: 13, fontWeight: '800' },
  tabBar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  tabIcon: { fontSize: 20 },
  tabLabel: { color: C.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  addWrap: { flex: 1, alignItems: 'center' },
  addBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: -26, elevation: 8, shadowColor: C.blue, shadowOpacity: 0.4, shadowRadius: 10, borderWidth: 4, borderColor: C.bg },
  addIcon: { color: C.white, fontSize: 30, fontWeight: '300', marginTop: -2 },
});
