import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import api, { getImageUrl } from '@api';
import { useFavoritesTop } from '@hooks/useApi';
import AportacionCard from './AportacionCard';

const GENERAL = '__general__';

const personName = (person) => (
  person?.username || [person?.first_name, person?.last_name].filter(Boolean).join(' ') || 'Perfil'
);

/** Público / privado de una parte del top 5 (solo la ve y la cambia el dueño). */
const VisibilityPill = ({ isPublic, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.pill, isPublic ? styles.pillPublic : styles.pillPrivate]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={isPublic ? 'Público: tocar para ocultarlo' : 'Privado: tocar para mostrarlo'}
  >
    <Ionicons name={isPublic ? 'eye-outline' : 'lock-closed'} size={12} color={isPublic ? '#1864ab' : '#868e96'} />
    <Text style={[styles.pillText, isPublic ? styles.pillTextPublic : styles.pillTextPrivate]}>
      {isPublic ? 'Público' : 'Privado'}
    </Text>
  </TouchableOpacity>
);

/**
 * Top 5 del perfil: los perfiles favoritos anclados y las tareas ancladas, en general y
 * por categoría. El dueño lo ve siempre y decide si cada parte es pública; los demás ven
 * solo lo público y nunca las guardadas "solo para mí".
 */
const ProfileTopFive = ({ userId, isCurrentUser, navigation, onOpenProfile }) => {
  const queryClient = useQueryClient();
  const { data } = useFavoritesTop(isCurrentUser ? null : userId, { enabled: isCurrentUser || Boolean(userId) });
  const [category, setCategory] = useState(GENERAL);
  const [savingVisibility, setSavingVisibility] = useState(null);

  if (!data) return null;
  const profiles = data.profiles || [];
  const generalTasks = data.tasks || [];
  const categoryTops = data.categories || [];
  const empty = !profiles.length && !generalTasks.length && !categoryTops.length;
  if (empty && !isCurrentUser) return null;

  const selected = categoryTops.find((top) => top.name === category) || null;
  const tasks = selected ? selected.tasks : generalTasks;

  const toggleVisibility = async (kind) => {
    if (savingVisibility) return;
    const field = kind === 'profiles' ? 'favorite_profiles_public' : 'favorite_tasks_public';
    const next = !data.visibility?.[kind];
    setSavingVisibility(kind);
    queryClient.setQueryData(['favoritesTop', 'me'], (prev) => (
      prev ? { ...prev, visibility: { ...prev.visibility, [kind]: next } } : prev
    ));
    try {
      await api.patch('categories/visibility/', { [field]: next });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ['favoritesTop'] });
      Alert.alert('No se pudo actualizar', 'Intenta nuevamente.');
    } finally {
      setSavingVisibility(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="pin" size={18} color="#845ef7" />
        <Text style={styles.title}>Top 5</Text>
        <TouchableOpacity
          style={styles.seeAll}
          onPress={() => navigation.navigate('Favorites', isCurrentUser ? undefined : { userId })}
          accessibilityRole="button"
          accessibilityLabel="Ver todos los favoritos"
        >
          <Text style={styles.seeAllText}>Ver todo</Text>
          <Ionicons name="chevron-forward" size={14} color="#845ef7" />
        </TouchableOpacity>
      </View>

      {empty ? (
        <Text style={styles.hint}>
          Ancla perfiles con el corazón y tareas desde el menú de 3 puntos para armar tu top 5.
        </Text>
      ) : null}

      {profiles.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Perfiles</Text>
            {isCurrentUser ? (
              <VisibilityPill
                isPublic={Boolean(data.visibility?.profiles)}
                onPress={() => toggleVisibility('profiles')}
                disabled={savingVisibility === 'profiles'}
              />
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.profilesRow}>
            {profiles.map((person, index) => (
              <TouchableOpacity
                key={person.id}
                style={styles.profileItem}
                onPress={() => onOpenProfile?.(person)}
                accessibilityRole="button"
                accessibilityLabel={`Puesto ${index + 1}: ${personName(person)}`}
              >
                <View>
                  <Image source={{ uri: getImageUrl(person.user_image) }} style={styles.avatar} />
                  <View style={styles.rank}><Text style={styles.rankText}>{index + 1}</Text></View>
                </View>
                <Text style={styles.profileName} numberOfLines={1}>{personName(person)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {generalTasks.length || categoryTops.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tareas</Text>
            {isCurrentUser ? (
              <VisibilityPill
                isPublic={Boolean(data.visibility?.tasks)}
                onPress={() => toggleVisibility('tasks')}
                disabled={savingVisibility === 'tasks'}
              />
            ) : null}
          </View>
          {categoryTops.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {[{ name: GENERAL, label: 'General' }, ...categoryTops.map((top) => ({ name: top.name, label: top.name }))]
                .map((chip) => {
                  const active = (selected ? selected.name : GENERAL) === chip.name;
                  return (
                    <TouchableOpacity
                      key={chip.name}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setCategory(chip.name)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          ) : null}
          {tasks.length ? tasks.map((info, index) => (
            <AportacionCard
              key={info.id}
              info={info}
              label={`Puesto ${index + 1}`}
              onPress={() => navigation.navigate('TaskDetail', { taskId: info.id })}
              style={styles.taskCard}
            />
          )) : (
            <Text style={styles.hint}>Todavía no hay tareas en este top 5.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5dbff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: '#333' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: '700', color: '#845ef7' },
  hint: { marginTop: 8, fontSize: 13, color: '#868e96' },
  section: { marginTop: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#5f3dc4', textTransform: 'uppercase', letterSpacing: 0.4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillPublic: { backgroundColor: '#e7f5ff' },
  pillPrivate: { backgroundColor: '#f1f3f5' },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextPublic: { color: '#1864ab' },
  pillTextPrivate: { color: '#868e96' },
  profilesRow: { gap: 14, paddingRight: 4 },
  profileItem: { width: 60, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e9ecef', borderWidth: 2, borderColor: '#845ef7' },
  rank: {
    position: 'absolute', right: -2, bottom: -2, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#845ef7', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff',
  },
  rankText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  profileName: { marginTop: 4, fontSize: 11, color: '#495057', maxWidth: 60 },
  chips: { gap: 8, paddingBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f3f0ff' },
  chipActive: { backgroundColor: '#845ef7' },
  chipText: { fontSize: 12, fontWeight: '700', color: '#5f3dc4' },
  chipTextActive: { color: '#fff' },
  taskCard: { marginBottom: 8, backgroundColor: '#faf8ff', borderColor: '#e5dbff' },
});

export default ProfileTopFive;
