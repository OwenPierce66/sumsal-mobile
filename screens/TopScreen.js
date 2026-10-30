import React, { useCallback, useState } from 'react';
import {
  Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { getImageUrl } from '@api';
import { useMe } from '@hooks/useApi';
import ProfileTopFive from '@components/ProfileTopFive';
import TopicTopSections from '@components/TopicTopSections';
import ViewAsBanner from '@components/ViewAsBanner';
import { useViewAs } from '@hooks/useViewAs';

const PERIODS = [
  { value: 'top_day', label: '24 h' },
  { value: 'top_week', label: 'Semana' },
  { value: 'top_month', label: 'Mes' },
];

/**
 * Pestaña Top (segunda del menú inferior): tu top 5 (perfiles, tareas y por categoría)
 * y lo más votado de cada tipo de aportación en el periodo elegido.
 */
const TopScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const [period, setPeriod] = useState('top_month');
  // Ver como otra persona: su top 5 (si lo muestra) y lo más votado de quienes sigue.
  const viewAs = useViewAs();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['favoritesTop'] }),
      queryClient.invalidateQueries({ queryKey: ['tasks', 'list'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const openProfile = (person) => {
    if (!person?.id) return;
    navigation.push('UserProfile', {
      userId: person.id,
      userName: person.username,
      userAvatar: getImageUrl(person.user_image),
    });
  };

  // "Ver todo" de un tipo: el feed de Aportaciones con ese tipo y el mismo periodo.
  const openTopic = (pch) => navigation.getParent()?.navigate('Tasks', {
    screen: 'TasksList', params: { topicPch: pch, topicSortBy: period },
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.title}>Top</Text>
      <ViewAsBanner what="el top" style={styles.viewAsBanner} />

      <TouchableOpacity
        style={styles.explore}
        onPress={() => navigation.navigate('CategoryExplorer')}
        accessibilityLabel="Explorar categorías"
      >
        <Ionicons name="grid-outline" size={22} color="#1864ab" />
        <View style={styles.exploreText}>
          <Text style={styles.exploreTitle}>Explorar categorías</Text>
          <Text style={styles.exploreSubtitle}>Cada tema con su imagen, de qué trata y lo más destacado</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#1864ab" />
      </TouchableOpacity>

      {viewAs ? (
        <View style={styles.block}>
          <ProfileTopFive userId={viewAs.id} isCurrentUser={false} navigation={navigation} onOpenProfile={openProfile} />
        </View>
      ) : me?.id ? (
        <View style={styles.block}>
          <ProfileTopFive userId={me.id} isCurrentUser navigation={navigation} onOpenProfile={openProfile} />
        </View>
      ) : null}

      <View style={styles.periodRow}>
        <Text style={styles.sectionTitle}>Lo más votado</Text>
        <View style={styles.periods}>
          {PERIODS.map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[styles.period, period === item.value && styles.periodActive]}
              onPress={() => setPeriod(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: period === item.value }}
            >
              <Text style={[styles.periodText, period === item.value && styles.periodTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TopicTopSections navigation={navigation} onSelectTopic={openTopic} sortBy={period} asUser={viewAs?.id} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  content: { paddingTop: Platform.OS === 'android' ? 34 : 16, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: '#333', marginHorizontal: 16, marginBottom: 8 },
  block: { marginHorizontal: 12 },
  viewAsBanner: { marginHorizontal: 12, marginBottom: 12, borderRadius: 12 },
  explore: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 12, padding: 12, borderRadius: 14, backgroundColor: '#e7f5ff' },
  exploreText: { flex: 1 },
  exploreTitle: { fontSize: 15, fontWeight: '800', color: '#1864ab' },
  exploreSubtitle: { fontSize: 12, color: '#1971c2', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#333' },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginHorizontal: 16, marginTop: 12 },
  periods: { flexDirection: 'row', gap: 6 },
  period: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#e7f5ff' },
  periodActive: { backgroundColor: '#4dabf7' },
  periodText: { color: '#1864ab', fontWeight: '700', fontSize: 12 },
  periodTextActive: { color: '#fff' },
});

export default TopScreen;
