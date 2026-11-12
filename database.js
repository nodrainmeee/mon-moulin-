import * as SQLite from 'expo-sqlite';

export const TARIF_KWH = 200; // FCFA par kWh (une seule source de vérité)
export const MAX_VALEUR = 1e9;

const db = SQLite.openDatabase('moulin.db');

// Exécute UNE requête et renvoie une Promise (résolue ou rejetée proprement).
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
            return true; // annule la transaction
          }
        );
      },
      (error) => reject(error)
    );
  });

// La table est créée UNE seule fois, et toutes les fonctions attendent cette création.
// (Avant : initDB() n'était pas attendu -> "no such table" possible au 1er lancement.)
let ready = null;
export const initDB = () => {
  if (!ready) {
    ready = run(
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient TEXT,
        prix_facture REAL,
        kwh_consomme REAL,
        cout_energie REAL,
        benefice_net REAL,
        date_session DATETIME DEFAULT CURRENT_TIMESTAMP
      );`
    ).catch((e) => {
      ready = null; // permet de réessayer
      throw e;
    });
  }
  return ready;
};

const round2 = (n) => Math.round(n * 100) / 100;

const assertMontant = (n, nom) => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > MAX_VALEUR) {
    throw new Error(`Valeur invalide : ${nom}`);
  }
};

export const addSession = async (ingredient, prixFacture, kwh) => {
  assertMontant(prixFacture, 'montant');
  assertMontant(kwh, 'kWh');
  await initDB();

  const nom = String(ingredient || 'Standard').trim().slice(0, 60) || 'Standard';
  const coutEnergie = round2(kwh * TARIF_KWH);
  const benefice = round2(prixFacture - coutEnergie);

  // Requête paramétrée (?) : aucune injection SQL possible.
  return run(
    `INSERT INTO sessions (ingredient, prix_facture, kwh_consomme, cout_energie, benefice_net) VALUES (?, ?, ?, ?, ?)`,
    [nom, prixFacture, kwh, coutEnergie, benefice]
  );
};

export const getSessions = async () => {
  await initDB();
  const result = await run(`SELECT * FROM sessions ORDER BY date_session DESC, id DESC`);
  return result.rows._array;
};
