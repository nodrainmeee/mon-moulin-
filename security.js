import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// Le code PIN n'est JAMAIS stocké en clair ni écrit dans le code source :
// on ne garde qu'un hash salé, dans le coffre sécurisé du téléphone (Android Keystore).

const K_HASH = 'moulin_pin_hash';
const K_SALT = 'moulin_pin_salt';
const K_FAILS = 'moulin_pin_fails';
const K_LOCK = 'moulin_pin_lock_until';

const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const MAX_TRIES = 5;
const BASE_LOCK_SECONDS = 30;
const MAX_LOCK_SECONDS = 15 * 60;

const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const hashPin = (pin, salt) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

const safeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

// Codes trop faciles à deviner
const FAIBLES = new Set(['1234', '4321', '0123', '12345', '123456', '654321', '012345', '1212', '2580', '1357']);

export const isPinFormatValid = (pin) => /^\d{4,6}$/.test(pin);
export const isPinWeak = (pin) => /^(\d)\1+$/.test(pin) || FAIBLES.has(pin);

export const hasPin = async () => !!(await SecureStore.getItemAsync(K_HASH, OPTIONS));

export const setPin = async (pin) => {
  if (!isPinFormatValid(pin)) throw new Error('PIN invalide');
  const salt = toHex(await Crypto.getRandomBytesAsync(16));
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(K_SALT, salt, OPTIONS);
  await SecureStore.setItemAsync(K_HASH, hash, OPTIONS);
  await SecureStore.setItemAsync(K_FAILS, '0', OPTIONS);
  await SecureStore.deleteItemAsync(K_LOCK, OPTIONS);
};

// Résultat : { ok: true } | { ok: false, locked: true, seconds } | { ok: false, remaining }
export const verifyPin = async (pin) => {
  const now = Date.now();
  const lockUntil = Number(await SecureStore.getItemAsync(K_LOCK, OPTIONS)) || 0;
  if (lockUntil > now) {
    return { ok: false, locked: true, seconds: Math.ceil((lockUntil - now) / 1000) };
  }

  const [salt, stored] = await Promise.all([
    SecureStore.getItemAsync(K_SALT, OPTIONS),
    SecureStore.getItemAsync(K_HASH, OPTIONS),
  ]);
  if (!salt || !stored) return { ok: false, remaining: 0 };

  const candidate = await hashPin(pin, salt);
  if (safeEqual(candidate, stored)) {
    await SecureStore.setItemAsync(K_FAILS, '0', OPTIONS);
    await SecureStore.deleteItemAsync(K_LOCK, OPTIONS);
    return { ok: true };
  }

  // Échec : le compteur survit au redémarrage de l'app (stocké dans le coffre).
  const fails = (Number(await SecureStore.getItemAsync(K_FAILS, OPTIONS)) || 0) + 1;
  await SecureStore.setItemAsync(K_FAILS, String(fails), OPTIONS);

  if (fails >= MAX_TRIES) {
    const seconds = Math.min(BASE_LOCK_SECONDS * 2 ** (fails - MAX_TRIES), MAX_LOCK_SECONDS);
    await SecureStore.setItemAsync(K_LOCK, String(now + seconds * 1000), OPTIONS);
    return { ok: false, locked: true, seconds };
  }
  return { ok: false, remaining: MAX_TRIES - fails };
};
