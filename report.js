import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { escapeHtml, fmt, fmtDate, fmtTime, summarize, groupByProduct } from './utils';

const share = async (uri, mimeType, UTI, dialogTitle) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error('share-unavailable');
  await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle });
};

export const exportPDF = async ({ sessions, label }) => {
  const t = summarize(sessions);
  const produits = groupByProduct(sessions).sort((a, b) => b.benefice - a.benefice);
  const cls = (n) => (n < 0 ? 'neg' : 'pos');

  const rowsProduits = produits
    .map(
      (p) => `<tr><td class="b">${escapeHtml(p.name)}</td><td>${p.count}</td><td>${escapeHtml(fmt(p.ca))}</td>
      <td>${escapeHtml(fmt(p.cout))}</td><td class="${cls(p.benefice)}">${escapeHtml(fmt(p.benefice))}</td>
      <td>${p.marge === null ? '—' : escapeHtml(fmt(Math.round(p.marge * 10) / 10)) + ' %'}</td></tr>`
    )
    .join('');

  const rowsOps = sessions
    .map(
      (s) => `<tr><td>${escapeHtml(fmtDate(s.date_session))} ${escapeHtml(fmtTime(s.date_session))}</td>
      <td class="b">${escapeHtml(s.ingredient)}</td><td>${escapeHtml(fmt(s.prix_facture))}</td>
      <td>${escapeHtml(fmt(s.kwh_consomme))} kWh</td><td class="${cls(s.benefice_net)}">${escapeHtml(fmt(s.benefice_net))}</td></tr>`
    )
    .join('');

  const html = `<html><head><meta charset="utf-8" /><style>
    body{font-family:sans-serif;padding:36px;color:#1E293B}
    h1{text-align:center;margin-bottom:0} .sub{text-align:center;color:#64748B;margin-top:4px}
    .card{background:#F8FAFC;padding:18px;border-radius:8px;margin:18px 0}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px;text-align:left}
    th{padding:10px;background:#F1F5F9;border-bottom:2px solid #E2E8F0}
    td{padding:10px;border-bottom:1px solid #E2E8F0}
    .b{font-weight:600}.pos{color:#059669;font-weight:bold}.neg{color:#DC2626;font-weight:bold}
  </style></head><body>
    <h1>MON MOULIN — CONFIDENTIEL</h1>
    <p class="sub">Rapport ${escapeHtml(label)} · édité le ${escapeHtml(fmtDate(new Date()))}</p>
    <div class="card">
      <p><strong>Opérations :</strong> ${t.count}</p>
      <p><strong>Chiffre d'affaires :</strong> ${escapeHtml(fmt(t.ca))} FCFA</p>
      <p><strong>Énergie :</strong> ${escapeHtml(fmt(t.kwh))} kWh — ${escapeHtml(fmt(t.cout))} FCFA</p>
      <h2 class="${cls(t.benefice)}">Bénéfice net : ${escapeHtml(fmt(t.benefice))} FCFA</h2>
    </div>
    <h3>Par produit</h3>
    <table><tr><th>Produit</th><th>Op.</th><th>CA</th><th>Énergie</th><th>Bénéfice</th><th>Marge</th></tr>${rowsProduits}</table>
    <h3>Détail des opérations</h3>
    <table><tr><th>Date</th><th>Produit</th><th>CA (FCFA)</th><th>Énergie</th><th>Bénéfice (FCFA)</th></tr>${rowsOps}</table>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await share(uri, 'application/pdf', 'com.adobe.pdf', 'Rapport Mon Moulin');
};

// Évite l'injection de formules dans Excel (=, +, -, @ en début de cellule)
const csvText = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
const csvNum = (n) => String(Number(n) || 0).replace('.', ',');

export const exportCSV = async (sessions) => {
  const lines = [
    ['Date', 'Heure', 'Produit', 'Montant (FCFA)', 'Energie (kWh)', 'Tarif (FCFA/kWh)', 'Cout energie (FCFA)', 'Benefice (FCFA)', 'Note'].join(';'),
    ...sessions.map((s) =>
      [
        fmtDate(s.date_session),
        fmtTime(s.date_session),
        csvText(s.ingredient),
        csvNum(s.prix_facture),
        csvNum(s.kwh_consomme),
        csvNum(s.tarif),
        csvNum(s.cout_energie),
        csvNum(s.benefice_net),
        csvText(s.note),
      ].join(';')
    ),
  ];
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const name = `moulin_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.csv`;
  const uri = FileSystem.cacheDirectory + name;
  await FileSystem.writeAsStringAsync(uri, '\uFEFF' + lines.join('\n'), { encoding: FileSystem.EncodingType.UTF8 });
  await share(uri, 'text/csv', 'public.comma-separated-values-text', 'Export Mon Moulin (CSV)');
};
