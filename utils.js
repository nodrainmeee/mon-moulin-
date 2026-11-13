// ---------- Texte / nombres ----------
export const escapeHtml = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// "1 234,5" / "1234.5" -> 1234.5 ; vide ou invalide -> NaN
export const toNumber = (s) => {
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export const fmt = (n) => {
  const v = Math.round((Number(n) || 0) * 100) / 100;
  const [entier, dec] = String(Math.abs(v)).split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  return (v < 0 ? '-' : '') + groupe + (dec ? ',' + dec : '');
};

export const fmtPct = (n) => fmt(Math.round(n * 10) / 10) + ' %';

// ---------- Dates (français, sans Intl pour rester compatible Hermes) ----------
const pad = (n) => String(n).padStart(2, '0');
export const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// SQLite renvoie "YYYY-MM-DD HH:MM:SS" en UTC
export const parseDate = (s) => {
  if (!s) return null;
  const str = String(s);
  const d = new Date(str.includes('T') ? str : str.replace(' ', 'T') + 'Z');
  return isNaN(d.getTime()) ? null : d;
};
export const fmtDate = (s) => {
  const d = s instanceof Date ? s : parseDate(s);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—';
};
export const fmtTime = (s) => {
  const d = s instanceof Date ? s : parseDate(s);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
};
export const fmtDateTime = (s) => `${fmtDate(s)} ${fmtTime(s)}`.trim();

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export const fmtDayLong = (d) => `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
export const fmtDayLabel = (d, now = new Date()) => {
  const k = dayKey(d);
  if (k === dayKey(now)) return "Aujourd'hui";
  if (k === dayKey(addDays(now, -1))) return 'Hier';
  return fmtDayLong(d) + (d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '');
};

// ---------- Périodes ----------
export const PERIODS = [
  { key: 'today', label: "Aujourd'hui", long: "aujourd'hui" },
  { key: '7d', label: '7 jours', long: '7 derniers jours' },
  { key: '30d', label: '30 jours', long: '30 derniers jours' },
  { key: 'all', label: 'Tout', long: 'depuis le début' },
];
export const periodLabel = (key) => (PERIODS.find((p) => p.key === key) || PERIODS[3]).long;

export const periodRange = (key, now = new Date()) => {
  const days = key === 'today' ? 1 : key === '7d' ? 7 : key === '30d' ? 30 : null;
  if (!days) return null;
  const sod = startOfDay(now);
  const start = addDays(sod, -(days - 1));
  return {
    start: start.getTime(),
    end: addDays(sod, 1).getTime(),
    prevStart: addDays(start, -days).getTime(),
    prevEnd: start.getTime(),
    days,
  };
};

const timeOf = (s) => {
  const d = parseDate(s.date_session);
  return d ? d.getTime() : null;
};
export const inRange = (list, a, b) =>
  list.filter((s) => {
    const t = timeOf(s);
    return t !== null && t >= a && t < b;
  });

// ---------- Agrégations ----------
export const summarize = (list) => {
  const r = { ca: 0, kwh: 0, cout: 0, benefice: 0 };
  for (const s of list) {
    r.ca += s.prix_facture || 0;
    r.kwh += s.kwh_consomme || 0;
    r.cout += s.cout_energie || 0;
    r.benefice += s.benefice_net || 0;
  }
  r.count = list.length;
  r.marge = r.ca > 0 ? (r.benefice / r.ca) * 100 : null;
  return r;
};

export const pctChange = (cur, prev) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);

export const dailySeries = (list, days, now = new Date()) => {
  const map = new Map();
  for (const s of list) {
    const d = parseDate(s.date_session);
    if (!d) continue;
    const k = dayKey(d);
    map.set(k, (map.get(k) || 0) + (s.benefice_net || 0));
  }
  const sod = startOfDay(now);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(sod, -i);
    const k = dayKey(d);
    const label = days <= 7 ? JOURS[d.getDay()].replace('.', '') : i % 5 === 0 ? String(d.getDate()) : '';
    out.push({ key: k, label, title: fmtDayLong(d), value: map.get(k) || 0 });
  }
  return out;
};

export const monthlySeries = (list, months, now = new Date()) => {
  const map = new Map();
  for (const s of list) {
    const d = parseDate(s.date_session);
    if (!d) continue;
    const k = monthKey(d);
    map.set(k, (map.get(k) || 0) + (s.benefice_net || 0));
  }
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKey(d);
    out.push({ key: k, label: MOIS[d.getMonth()].replace('.', ''), title: `${MOIS[d.getMonth()]} ${d.getFullYear()}`, value: map.get(k) || 0 });
  }
  return out;
};

export const monthProfit = (list, now = new Date()) => {
  const k = monthKey(now);
  let total = 0;
  for (const s of list) {
    const d = parseDate(s.date_session);
    if (d && monthKey(d) === k) total += s.benefice_net || 0;
  }
  return total;
};

// ---------- Produits ----------
export const normName = (n) => String(n || 'Standard').trim().toLowerCase();
const cap = (n) => {
  const t = String(n || 'Standard').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const groupByProduct = (list) => {
  const map = new Map();
  for (const s of list) {
    const k = normName(s.ingredient);
    let p = map.get(k);
    if (!p) {
      p = { key: k, name: cap(s.ingredient), count: 0, ca: 0, kwh: 0, cout: 0, benefice: 0 };
      map.set(k, p);
    }
    p.count += 1;
    p.ca += s.prix_facture || 0;
    p.kwh += s.kwh_consomme || 0;
    p.cout += s.cout_energie || 0;
    p.benefice += s.benefice_net || 0;
  }
  return Array.from(map.values()).map((p) => ({
    ...p,
    marge: p.ca > 0 ? (p.benefice / p.ca) * 100 : null,
    kwhPerK: p.ca > 0 ? (p.kwh / p.ca) * 1000 : null,
  }));
};

export const colorForName = (name) => {
  const palette = ['#1D9BF0', '#00BA7C', '#FFAD1F', '#F91880', '#7856FF', '#FF7A00', '#00B8D9'];
  let h = 0;
  const str = String(name);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};
export const initial = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase();
