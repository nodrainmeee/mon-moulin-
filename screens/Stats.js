import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';
import { Card, Segmented, Chip, Progress, LockedCard, EmptyState, SectionTitle } from '../components/ui';
import {
  PERIODS, periodRange, inRange, groupByProduct, summarize, parseDate, dayKey, fmtDayLong, fmt, fmtPct, colorForName,
} from '../utils';

const SORTS = [
  { key: 'benefice', label: 'Bénéfice', get: (p) => p.benefice },
  { key: 'ca', label: 'Chiffre d\'affaires', get: (p) => p.ca },
  { key: 'marge', label: 'Marge', get: (p) => (p.marge === null ? 0 : p.marge) },
  { key: 'kwh', label: 'Énergie', get: (p) => p.kwh },
];

export default function Stats({ sessions, period, setPeriod, unlocked, onUnlock, onAdd }) {
  const [sort, setSort] = useState('benefice');
  const [open, setOpen] = useState(null);

  const data = useMemo(() => {
    const range = periodRange(period);
    const list = range ? inRange(sessions, range.start, range.end) : sessions;
    const produits = groupByProduct(list);

    const days = new Map();
    for (const it of list) {
      const d = parseDate(it.date_session);
      if (!d) continue;
      const k = dayKey(d);
      const cur = days.get(k) || { date: d, total: 0 };
      cur.total += it.benefice_net || 0;
      days.set(k, cur);
    }
    const bestDay = Array.from(days.values()).sort((a, b) => b.total - a.total)[0] || null;

    return { list, produits, sum: summarize(list), bestDay, losses: list.filter((i) => i.benefice_net < 0).length };
  }, [sessions, period]);

  if (!unlocked) {
    return (
      <ScrollView contentContainerStyle={s.content}>
        <LockedCard title="Analyses confidentielles" text="Les performances par produit sont protégées par votre code." onUnlock={onUnlock} />
      </ScrollView>
    );
  }
  if (sessions.length === 0) {
    return <EmptyState icon="📈" title="Pas encore d'analyses" text="Ajoutez quelques opérations pour comparer vos produits." action="Ajouter une opération" onAction={onAdd} />;
  }

  const { produits, sum, bestDay, losses } = data;
  const sorter = SORTS.find((x) => x.key === sort);
  const ranked = [...produits].sort((a, b) => sorter.get(b) - sorter.get(a));
  const maxVal = Math.max(1, ...ranked.map((p) => Math.abs(sorter.get(p))));

  const best = [...produits].sort((a, b) => b.benefice - a.benefice)[0];
  const hungry = [...produits].filter((p) => p.kwhPerK !== null).sort((a, b) => b.kwhPerK - a.kwhPerK)[0];

  const show = (p) =>
    sort === 'marge' ? (p.marge === null ? '—' : fmtPct(p.marge)) : sort === 'kwh' ? `${fmt(p.kwh)} kWh` : `${fmt(sorter.get(p))} F`;

  return (
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      {produits.length === 0 ? (
        <EmptyState icon="🗓️" title="Aucune opération sur cette période" text="Choisissez une période plus large." />
      ) : (
        <>
          <SectionTitle>Ce qu'il faut retenir</SectionTitle>
          {best ? (
            <Insight icon="🏆" title={`${best.name} est votre produit le plus rentable`} text={`${fmt(best.benefice)} FCFA de bénéfice sur ${best.count} opération(s).`} />
          ) : null}
          {hungry && produits.length > 1 ? (
            <Insight icon="⚡" title={`${hungry.name} est le plus gourmand en électricité`} text={`${fmt(Math.round(hungry.kwhPerK * 10) / 10)} kWh consommés pour 1 000 FCFA encaissés.`} />
          ) : null}
          {bestDay ? <Insight icon="📅" title={`Meilleure journée : ${fmtDayLong(bestDay.date)}`} text={`${fmt(bestDay.total)} FCFA de bénéfice.`} /> : null}
          {losses > 0 ? (
            <Insight icon="⚠️" warn title={`${losses} opération(s) à perte`} text="L'électricité a coûté plus cher que l'encaissement. Vérifiez vos prix ou le tarif." />
          ) : (
            <Insight icon="✅" title="Aucune opération à perte" text={`Marge globale : ${sum.marge === null ? '—' : fmtPct(sum.marge)}.`} />
          )}

          <SectionTitle>Classement des produits</SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {SORTS.map((x) => (
              <Chip key={x.key} label={x.label} active={sort === x.key} onPress={() => setSort(x.key)} />
            ))}
          </ScrollView>

          {ranked.map((p, i) => {
            const isOpen = open === p.key;
            const val = sorter.get(p);
            return (
              <Card key={p.key} onPress={() => setOpen(isOpen ? null : p.key)} style={{ padding: 14, marginBottom: 10 }}>
                <View style={s.rowBetween}>
                  <Text style={s.name} numberOfLines={1}>{i + 1}. {p.name}</Text>
                  <Text style={[s.value, { color: val < 0 ? C.red : C.text }]}>{show(p)}</Text>
                </View>
                <Progress ratio={Math.abs(val) / maxVal} color={val < 0 ? C.red : colorForName(p.name)} />
                {isOpen ? (
                  <View style={s.details}>
                    <Detail label="Opérations" value={String(p.count)} />
                    <Detail label="Chiffre d'affaires" value={`${fmt(p.ca)} FCFA`} />
                    <Detail label="Coût énergie" value={`${fmt(p.cout)} FCFA`} />
                    <Detail label="Bénéfice" value={`${fmt(p.benefice)} FCFA`} color={p.benefice < 0 ? C.red : C.green} />
                    <Detail label="Marge" value={p.marge === null ? '—' : fmtPct(p.marge)} />
                    <Detail label="Bénéfice moyen / opération" value={`${fmt(p.benefice / p.count)} FCFA`} />
                    <Detail label="Énergie" value={`${fmt(p.kwh)} kWh`} />
                  </View>
                ) : (
                  <Text style={s.tapHint}>Touchez pour le détail ▾</Text>
                )}
              </Card>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const Insight = ({ icon, title, text, warn }) => (
  <View style={[s.insight, warn && { borderColor: C.orange }]}>
    <Text style={s.insightIcon}>{icon}</Text>
    <View style={{ flex: 1 }}>
      <Text style={s.insightTitle}>{title}</Text>
      <Text style={s.insightText}>{text}</Text>
    </View>
  </View>
);

const Detail = ({ label, value, color }) => (
  <View style={s.detailRow}>
    <Text style={s.detailLabel}>{label}</Text>
    <Text style={[s.detailValue, color && { color }]}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  name: { color: C.text, fontSize: 16, fontWeight: '800', flexShrink: 1, paddingRight: 8 },
  value: { fontSize: 15, fontWeight: '800' },
  tapHint: { color: C.muted, fontSize: 12, marginTop: 8 },
  details: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { color: C.muted, fontSize: 13 },
  detailValue: { color: C.text, fontSize: 13, fontWeight: '700' },
  insight: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10, alignItems: 'center' },
  insightIcon: { fontSize: 26, marginRight: 12 },
  insightTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  insightText: { color: C.muted, fontSize: 13, marginTop: 3 },
});
