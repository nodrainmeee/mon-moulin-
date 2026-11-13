import * as SQLite from 'expo-sqlite';

export const MAX_VALEUR = 1e9;
export const DEFAULT_SETTINGS = { tarif: 200, objectif: 0 }; // tarif en FCFA par kWh

const db = SQLite.openDatabase('moulin.db');

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            reject(error);
            return true;
          }
        );
      },
      (error) => reject(error)
    );
  });

// Création + migration (ajout des colonnes tarif/note si la base vient d'une ancienne version).
let ready = null;
export const initDB = () => {
  if (!ready) {
    ready = (async () => {
      await run(`CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient TEXT,
        prix_facture REAL,
        kwh_consomme REAL,
        cout_energie REAL,
        benefice_net REAL,
        date_session DATETIME DEFAULT CURRENT_TIMESTAMP
      );`);
      await run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
      const info = await run('PRAGMA table_info(sessions)');
      const cols = info.rows._array.map((c) => c.name);
      if (!cols.includes('tarif')) await run('ALTER TABLE sessions ADD COLUMN tarif REAL');
      if (!cols.includes('note')) await run('ALTER TABLE sessions ADD COLUMN note TEXT');
      await run('CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date_session)');
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
};

const round2 = (n) => Math.round(n * 100) / 100;

const check = (n, nom, min = 0, max = MAX_VALEUR) => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
    throw new Error(`Valeur invalide : ${nom}`);
  }
};

// Le coût d'énergie est figé avec le tarif de l'époque : changer le tarif ne modifie pas l'historique.
const prepare = ({ ingredient, prix, kwh, note, tarif }) => {
  check(prix, 'montant');
  check(kwh, 'kWh');
  check(tarif, 'tarif', 0, 1e6);
  const cout = round2(kwh * tarif);
  return {
    nom: String(ingredient || 'Standard').trim().slice(0, 60) || 'Standard',
    note: String(note || '').trim().slice(0, 200),
    prix,
    kwh,
    tarif,
    cout,
    benefice: round2(prix - cout),
  };
};

export const addSession = async (data) => {
  const v = prepare(data);
  await initDB();
  return run(
    `INSERT INTO sessions (ingredient, prix_facture, kwh_consomme, cout_energie, benefice_net, tarif, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [v.nom, v.prix, v.kwh, v.cout, v.benefice, v.tarif, v.note]
  );
};

export const updateSession = async (id, data) => {
  const v = prepare(data);
  await initDB();
  return run(
    `UPDATE sessions SET ingredient = ?, prix_facture = ?, kwh_consomme = ?, cout_energie = ?, benefice_net = ?, tarif = ?, note = ? WHERE id = ?`,
    [v.nom, v.prix, v.kwh, v.cout, v.benefice, v.tarif, v.note, Number(id)]
  );
};

export const deleteSession = async (id) => {
  await initDB();
  return run('DELETE FROM sessions WHERE id = ?', [Number(id)]);
};

export const deleteAllSessions = async () => {
  await initDB();
  return run('DELETE FROM sessions');
};

export const getSessions = async () => {
  await initDB();
  const r = await run('SELECT * FROM sessions ORDER BY date_session DESC, id DESC');
  return r.rows._array;
};

// ---- Réglages ----
export const getSettings = async () => {
  await initDB();
  const r = await run('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const { key, value } of r.rows._array) {
    const n = Number(value);
    if (key in DEFAULT_SETTINGS && Number.isFinite(n)) out[key] = n;
  }
  return out;
};

export const setSetting = async (key, value) => {
  if (!(key in DEFAULT_SETTINGS)) throw new Error('Réglage inconnu');
  if (key === 'tarif') check(value, 'tarif', 0.0001, 1e6);
  if (key === 'objectif') check(value, 'objectif');
  await initDB();
  return run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
};
