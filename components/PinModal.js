import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Modal, Alert, StyleSheet } from 'react-native';
import { C } from '../theme';
import { Btn } from './ui';
import { setPin, verifyPin, isPinFormatValid, isPinWeak } from '../security';

// mode 'verify' : saisir son code | mode 'create' : créer / changer son code (saisie + confirmation)
export default function PinModal({ visible, mode, onClose, onSuccess }) {
  const [step, setStep] = useState('enter');
  const [first, setFirst] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('enter');
      setFirst('');
      setInput('');
      setBusy(false);
    }
  }, [visible, mode]);

  const title = mode === 'verify' ? 'Code de sécurité' : step === 'enter' ? 'Créer votre code' : 'Confirmer le code';
  const sub =
    mode === 'verify'
      ? 'Saisissez votre code pour voir les chiffres.'
      : step === 'enter'
      ? 'Choisissez un code de 4 à 6 chiffres.'
      : 'Saisissez à nouveau le même code.';

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'verify') {
        const r = await verifyPin(input);
        setInput('');
        if (r.ok) onSuccess('verify');
        else if (r.locked) Alert.alert('Trop de tentatives', `Accès bloqué. Réessayez dans ${r.seconds} seconde(s).`);
        else Alert.alert('Accès refusé', `Code incorrect. ${r.remaining} essai(s) restant(s).`);
        return;
      }
      if (!isPinFormatValid(input)) {
        Alert.alert('Code invalide', 'Le code doit contenir 4 à 6 chiffres.');
        return;
      }
      if (step === 'enter') {
        if (isPinWeak(input)) {
          Alert.alert('Code trop faible', 'Évitez 1234, 0000, 1111... Choisissez un code moins prévisible.');
          return;
        }
        setFirst(input);
        setInput('');
        setStep('confirm');
        return;
      }
      if (input !== first) {
        Alert.alert('Codes différents', 'Les deux codes ne correspondent pas. Recommencez.');
        setStep('enter');
        setFirst('');
        setInput('');
        return;
      }
      await setPin(input);
      onSuccess('create');
    } catch (e) {
      Alert.alert('Erreur', 'Opération de sécurité impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.sub}>{sub}</Text>
          <TextInput
            style={s.input}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={input}
            onChangeText={(t) => setInput(t.replace(/\D/g, ''))}
            onSubmitEditing={submit}
            autoFocus
            autoCorrect={false}
            autoComplete="off"
            importantForAutofill="no"
            placeholder="••••"
            placeholderTextColor={C.muted}
          />
          <View style={{ flexDirection: 'row' }}>
            <Btn title="Retour" kind="ghost" onPress={onClose} style={{ flex: 1, marginRight: 10 }} />
            <Btn
              title={mode === 'verify' ? 'Déverrouiller' : step === 'enter' ? 'Suivant' : 'Valider'}
              onPress={submit}
              disabled={busy}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'center', padding: 24 },
  box: { backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border },
  title: { color: C.text, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  sub: { color: C.muted, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 15, fontSize: 26, letterSpacing: 10, textAlign: 'center', color: C.text, marginBottom: 20 },
});
