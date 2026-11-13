import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';
import { Card, SectionTitle, Segmented, Money, Progress, LockedCard, EmptyState, MASK } from '../components/ui';
import BarChart from '../components/BarChart';
import {
  PERIODS, periodRange, periodLabel, inRange, summarize, pctChange, dailySeries, monthlySeries,
  monthProfit, groupByProduct, fmt, fmtPct, fmtTime, fmtDayLabel, parseDate, colorForName, initial,
} from '../utils';

export default function Dashboard({ sessions, settings, unlocked, period, setPeriod, onUnlock, onAdd, onOpen, onGoJournal, onGoSettings }) {
  const [sel, setSel] = useState(null);
  useEffect(() => setSel(null), [period]);

  const { sum, prevSum, delta, produits, chart, month } = useMemo(() => {
    const range = periodRange(period);
    const cur = range ? inRange(sessions, range.start, range.end) : sessions;
    const prev = range ? inRange(sessions, range.prevStart, range.prevEnd) : null;
    const sum = summarize(cur);
    const prevSum = prev ? summarize(prev) : null;
    const chart =
      period === 'all'
        ? { title: 'Bénéfice par mois', data: monthlySeries(sessions, 6) }
        : period === '30d'
        ? { title: 'Bénéfice par jour · 30 jours', data: dailySeries(sessions, 30) }
        : { title: 'Bénéfice par jour · 7 jours', data: dailySeries(sessions, 7) };
    return {
      sum,
      prevSum,
      delta: prevSum ? pctChange(sum.benefice, prevSum.benefice) : null,
      produits: groupByProduct(cur).sort((a, b) => b.benefice - a.benefice).slice(0, 3),
      chart,
      month: monthProfit(sessions),
    };
  }, [sessions, period]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="🌾"
        title="Bienvenue sur Mon Moulin"
        text="Enregistrez votre première opération pour voir apparaître vos statistiques, graphiques et bénéfices."
        action="Ajouter une opération"
        onAction={onAdd}
      />
    );
  }

  const selected = chart.data.find((d) => d.key === sel);
  const objectif = settings.objectif || 0;
  const ratio = objectif > 0 ? month / objectif : 0;
  const maxProd = Math.max(1, ...produits.map((p) => Math.abs(p.benefice)));

  return (
    <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Segmented options={PERIODS} value={period} onChange={setPeriod} />

      {/* Carte principale */}
      <Card style={s.hero}>
        <Text style={s.heroLabel}>Bénéfice net · {periodLabel(period)}</Text>
        <Money value={sum.benefice} unlocked={unlocked} signColor style={s.heroValue} />
        {unlocked ? (
          delta !== null ? (
            <Text style={[s.delta, { color: delta >= 0 ? C.green : C.red }]}>
              {delta >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(delta))} <Text style={s.deltaMuted}>vs période précédente</Text>
            </Text>
          ) : (
            <Text style={s.deltaMuted}>{sum.count} opération(s)</Text>
          )
        ) : (
          <TouchableOpacity onPress={onUnlock}><Text style={s.unlockLink}>🔒 Déverrouiller pour voir les chiffres</Text></TouchableOpacity>
        )}
      </Card>

      {/* Mini indicateurs */}
      <View style={s.tiles}>
        <Tile label="Chiffre d'affaires" node={<Money value={sum.ca} unlocked={unlocked} suffix="" style={s.tileValue} />} sub="FCFA" />
        <Tile label="Énergie" node={<Text style={s.tileValue}>{unlocked ? fmt(sum.kwh) : MASK}</Text>} sub={unlocked ? `kWh · ${fmt(sum.cout)} F` : 'kWh'} />
        <Tile label="Marge" node={<Text style={s.tileValue}>{unlocked ? (sum.marge === null ? '—' : fmtPct(sum.marge)) : MASK}</Text>} sub={`${sum.count} op.`} />
      </View>

      {/* Objectif mensuel */}
      {objectif > 0 && unlocked ? (
        <Card onPress={onGoSettings}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>🎯 Objectif du mois</Text>
            <Text style={[s.cardTitle, { color: ratio >= 1 ? C.green : C.blue }]}>{fmtPct(ratio * 100)}</Text>
          </View>
          <Progress ratio={ratio} color={ratio >= 1 ? C.green : C.blue} />
          <Text style={s.muted}>
            {fmt(month)} / {fmt(objectif)} FCFA · {ratio >= 1 ? 'Objectif atteint, bravo !' : `il reste ${fmt(objectif - month)} FCFA`}
          </Text>
        </Card>
      ) : null}

      {/* Graphique */}
      {unlocked ? (
        <Card>
          <Text style={s.cardTitle}>{chart.title}</Text>
          <Text style={[s.muted, { marginBottom: 12, minHeight: 18 }]}>
            {selected ? `${selected.title} : ${fmt(selected.value)} FCFA` : 'Touchez une barre pour voir le détail'}
          </Text>
          <BarChart data={chart.data} selected={sel} onSelect={setSel} />
        </Card>
      ) : (
        <LockedCard title="Graphique masqué" text="Le graphique de vos bénéfices est protégé par votre code." onUnlock={onUnlock} />
      )}

      {/* Top produits */}
      {unlocked && produits.length > 0 ? (
        <Card>
          <Text style={[s.cardTitle, { marginBottom: 12 }]}>🏆 Meilleurs produits</Text>
          {produits.map((p, i) => (
            <View key={p.key} style={{ marginBottom: i === produits.length - 1 ? 0 : 14 }}>
              <View style={s.rowBetween}>
                <Text style={s.prodName} numberOfLines={1}>{i + 1}. {p.name}</Text>
                <Text style={[s.prodValue, { color: p.benefice < 0 ? C.red : C.green }]}>{fmt(p.benefice)} F</Text>
              </View>
              <Progress ratio={Math.abs(p.benefice) / maxProd} color={p.benefice < 0 ? C.red : colorForName(p.name)} />
            </View>
          ))}
        </Card>
      ) : null}

      {/* Dernières opérations */}
      <SectionTitle right="Tout voir ›" onRight={onGoJournal}>Dernières opérations</SectionTitle>
      {sessions.slice(0, 4).map((it) => {
        const d = parseDate(it.date_session);
        return (
          <Card key={it.id} onPress={() => onOpen(it)} style={s.opRow}>
            <View style={[s.avatar, { backgroundColor: colorForName(it.ingredient) }]}>
              <Text style={s.avatarText}>{initial(it.ingredient)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.prodName} numberOfLines={1}>{it.ingredient}</Text>
              <Text style={s.muted}>{d ? `${fmtDayLabel(d)} · ${fmtTime(d)}` : '—'}</Text>
            </View>
            <Money value={it.benefice_net} unlocked={unlocked} signColor style={s.prodValue} />
          </Card>
        );
      })}
    </ScrollView>
  );
}

const Tile = ({ label, node, sub }) => (
  <View style={s.tile}>
    <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
    {node}
    <Text style={s.tileSub} numberOfLines={1}>{sub}</Text>
  </View>
);

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120 },
  hero: { paddingVertical: 22 },
  heroLabel: { color: C.muted, fontSize: 14, fontWeight: '600' },
  heroValue: { color: C.text, fontSize: 34, fontWeight: '900', marginVertical: 6 },
  delta: { fontSize: 14, fontWeight: '800' },
  deltaMuted: { color: C.muted, fontSize: 13, fontWeight: '500' },
  unlockLink: { color: C.blue, fontSize: 14, fontWeight: '700' },
  tiles: { flexDirection: 'row', marginBottom: 14 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginHorizontal: 3 },
  tileLabel: { color: C.muted, fontSize: 11, fontWeight: '600' },
  tileValue: { color: C.text, fontSize: 16, fontWeight: '900', marginTop: 6 },
  tileSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  cardTitle: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  muted: { color: C.muted, fontSize: 13, marginTop: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prodName: { color: C.text, fontSize: 15, fontWeight: '700', flexShrink: 1, marginBottom: 6 },
  prodValue: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  opRow: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: C.white, fontWeight: '900', fontSize: 17 },
});
