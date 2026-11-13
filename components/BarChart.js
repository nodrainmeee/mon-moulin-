import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { C } from '../theme';

// Graphique en barres (positives en bleu, négatives en rouge), animé, barres cliquables.
export default function BarChart({ data, height = 150, selected, onSelect }) {
  const progress = useRef(new Animated.Value(0)).current;
  const signature = data.map((d) => d.value).join('|');

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 600, useNativeDriver: false }).start();
  }, [signature, progress]);

  const maxPos = Math.max(0, ...data.map((d) => d.value));
  const maxNeg = Math.max(0, ...data.map((d) => -d.value));
  const range = maxPos + maxNeg;
  const upH = range === 0 ? height : (height * maxPos) / range;
  const downH = height - upH;
  const unit = range === 0 ? 0 : height / range;

  return (
    <View>
      <View style={{ height, position: 'relative' }}>
        <View pointerEvents="none" style={[s.baseline, { top: upH }]} />
        <View style={s.row}>
          {data.map((d) => {
            const h = d.value === 0 ? 2 : Math.max(3, Math.abs(d.value) * unit);
            const isSel = selected === d.key;
            const dim = selected && !isSel ? 0.4 : 1;
            const anim = progress.interpolate({ inputRange: [0, 1], outputRange: [0, h] });
            const positive = d.value >= 0;
            return (
              <TouchableOpacity key={d.key} activeOpacity={0.7} style={s.col} onPress={() => onSelect && onSelect(isSel ? null : d.key)}>
                <View style={{ height: upH, justifyContent: 'flex-end', alignItems: 'center', alignSelf: 'stretch' }}>
                  {positive ? <Animated.View style={[s.bar, { height: anim, backgroundColor: d.value === 0 ? C.border : C.blue, opacity: dim }]} /> : null}
                </View>
                <View style={{ height: downH, justifyContent: 'flex-start', alignItems: 'center', alignSelf: 'stretch' }}>
                  {!positive ? <Animated.View style={[s.barNeg, { height: anim, backgroundColor: C.red, opacity: dim }]} /> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={s.labels}>
        {data.map((d) => (
          <View key={d.key} style={s.labelCell}>
            <Text style={[s.label, selected === d.key && { color: C.text }]} numberOfLines={1}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  col: { flex: 1, paddingHorizontal: 1.5 },
  bar: { width: '100%', maxWidth: 34, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  barNeg: { width: '100%', maxWidth: 34, borderBottomLeftRadius: 5, borderBottomRightRadius: 5 },
  baseline: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: C.border },
  labels: { flexDirection: 'row', marginTop: 6 },
  labelCell: { flex: 1, alignItems: 'center' },
  label: { width: 36, textAlign: 'center', color: C.muted, fontSize: 11 },
});
