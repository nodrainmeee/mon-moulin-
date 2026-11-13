import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, SectionList, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { C } from '../theme';
import { Chip, Money, EmptyState } from '../components/ui';
import { parseDate, dayKey, fmtDayLabel, fmtTime, normName, groupByProduct, colorForName, initial } from '../utils';

export default function Journal({ sessions, unlocked, onOpen, onAdd, onRefresh }) {
  const [query, setQuery] = useState('');
  const [product, setProduct] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const chips = useMemo(() => groupByProduct(sessions).sort((a, b) => b.count - a.count).slice(0, 8), [sessions]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sessions.filter((it) => {
      if (product !== 'all' && normName(it.ingredient) !== product) return false;
      if (!q) return true;
      return String(it.ingredient || '').toLowerCase().includes(q) || String(it.note || '').toLowerCase().includes(q);
    });
    const map = new Map();
    for (const it of list) {
      const d = parseDate(it.date_session);
      const key = d ? dayKey(d) : 'inconnu';
      if (!map.has(key)) map.set(key, { key, title: d ? fmtDayLabel(d) : 'Date inconnue', total: 0, data: [] });
      const sec = map.get(key);
      sec.data.push(it);
      sec.total += it.benefice_net || 0;
    }
    return { list, groups: Array.from(map.values()) };
  }, [sessions, query, product]);

  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  if (sessions.length === 0) {
    return <EmptyState icon="🧾" title="Journal vide" text="Vos opérations apparaîtront ici, classées par jour." action="Ajouter une opération" onAction={onAdd} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput style={s.search} placeholder="Rechercher un produit ou une note" placeholderTextColor={C.muted} value={query} onChangeText={setQuery} autoCorrect={false} />
        {query ? <TouchableOpacity onPress={() => setQuery('')}><Text style={s.clear}>✕</Text></TouchableOpacity> : null}
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <Chip label="Tous" active={product === 'all'} onPress={() => setProduct('all')} />
          {chips.map((p) => (
            <Chip key={p.key} label={`${p.name} · ${p.count}`} active={product === p.key} onPress={() => setProduct(product === p.key ? 'all' : p.key)} />
          ))}
        </ScrollView>
      </View>

      <Text style={s.count}>{sections.list.length} opération(s)</Text>

      <SectionList
        sections={sections.groups}
        extraData={unlocked}
        keyExtractor={(it) => String(it.id)}
        stickySectionHeadersEnabled={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.blue} colors={[C.blue]} />}
        ListEmptyComponent={<EmptyState icon="🔎" title="Aucun résultat" text="Essayez un autre mot ou retirez le filtre." />}
        renderSectionHeader={({ section }) => (
          <View style={s.secHead}>
            <Text style={s.secTitle}>{section.title}</Text>
            <Money value={section.total} unlocked={unlocked} signColor style={s.secTotal} />
          </View>
        )}
        renderItem={({ item }) => {
          const d = parseDate(item.date_session);
          return (
            <TouchableOpacity activeOpacity={0.7} style={s.row} onPress={() => onOpen(item)}>
              <View style={[s.avatar, { backgroundColor: colorForName(item.ingredient) }]}>
                <Text style={s.avatarText}>{initial(item.ingredient)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{item.ingredient}</Text>
                <Text style={s.sub} numberOfLines={1}>{d ? fmtTime(d) : ''}{item.note ? ` · ${item.note}` : ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Money value={item.benefice_net} unlocked={unlocked} signColor style={s.profit} />
                <Money value={item.prix_facture} unlocked={unlocked} style={s.sub} />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, marginHorizontal: 16, marginTop: 14, marginBottom: 12, paddingHorizontal: 12 },
  searchIcon: { fontSize: 14, marginRight: 8 },
  search: { flex: 1, color: C.text, fontSize: 15, paddingVertical: 12 },
  clear: { color: C.muted, fontSize: 16, padding: 4 },
  count: { color: C.muted, fontSize: 12, marginHorizontal: 16, marginBottom: 4 },
  secHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, backgroundColor: C.bg },
  secTitle: { color: C.muted, fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  secTotal: { fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: C.white, fontWeight: '900', fontSize: 18 },
  name: { color: C.text, fontSize: 16, fontWeight: '700' },
  sub: { color: C.muted, fontSize: 13, marginTop: 2 },
  profit: { fontSize: 15, fontWeight: '800' },
});
