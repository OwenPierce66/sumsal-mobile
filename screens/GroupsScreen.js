import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useGroups } from '@hooks/useApi';

const TABS = [
  { key: 'mine', label: 'Mis grupos' },
  { key: 'discover', label: 'Descubrir' },
];

export const groupRoleLabel = (role) => ({ owner: 'Creador', admin: 'Admin' }[role] || null);

/** Tarjeta de un grupo: portada, nombre, privacidad, integrantes y mi rol. */
export const GroupCard = ({ group, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} accessibilityLabel={`Abrir grupo ${group.name}`}>
    {group.image_url ? (
      <Image source={{ uri: group.image_url }} style={styles.cover} contentFit="cover" />
    ) : (
      <View style={[styles.cover, styles.coverEmpty]}>
        <Ionicons name="people" size={26} color="#4dabf7" />
      </View>
    )}
    <View style={styles.cardText}>
      <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>
        {group.is_private ? 'Privado' : 'Público'} · {group.members_count === 1 ? '1 integrante' : `${group.members_count} integrantes`}
        {groupRoleLabel(group.my_role) && group.my_status === 'active' ? ` · ${groupRoleLabel(group.my_role)}` : ''}
        {group.my_status === 'pending' ? ' · Solicitud enviada' : ''}
      </Text>
      {group.description ? <Text style={styles.description} numberOfLines={2}>{group.description}</Text> : null}
    </View>
    <Ionicons name="chevron-forward" size={18} color="#adb5bd" />
  </TouchableOpacity>
);

/** Grupos: los míos y los que puedo descubrir (con búsqueda). Desde aquí se crea uno. */
const GroupsScreen = ({ navigation }) => {
  const [tab, setTab] = useState('mine');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  // Espera a que se deje de escribir para buscar.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch, isRefetching } = useGroups({ mine: tab === 'mine', q: query });
  const groups = data ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ProfileMain'))}
          style={styles.backBtn}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Grupos</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('GroupForm')}
          style={styles.createBtn}
          accessibilityLabel="Crear grupo"
        >
          <Ionicons name="add-circle" size={28} color="#4dabf7" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {TABS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.tab, tab === option.key && styles.tabActive]}
            onPress={() => setTab(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === option.key }}
          >
            <Text style={[styles.tabText, tab === option.key && styles.tabTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar grupos"
          style={styles.searchInput}
          accessibilityLabel="Buscar grupos"
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#4dabf7" />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }) => (
            <GroupCard group={item} onPress={() => navigation.push('GroupDetail', { groupId: item.id })} />
          )}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {isError
                  ? 'No se pudieron cargar los grupos. Desliza hacia abajo para reintentar.'
                  : query
                    ? 'No hay grupos con esa búsqueda.'
                    : tab === 'mine'
                      ? 'Aún no estás en ningún grupo. Descubre uno o crea el tuyo.'
                      : 'Todavía no hay grupos. ¡Crea el primero!'}
              </Text>
              {!isError ? (
                <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('GroupForm')}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.primaryText}>Crear grupo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  topBar: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 16 },
  backBtn: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 50 : 16, zIndex: 10 },
  createBtn: { position: 'absolute', right: 16, top: Platform.OS === 'ios' ? 48 : 14, zIndex: 10 },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#333' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#d0ebff', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  tabText: { color: '#4dabf7', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#fff' },
  searchInput: { flex: 1, height: 42, fontSize: 14, color: '#333' },
  loader: { marginTop: 40 },
  list: { padding: 16, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10, borderRadius: 16, backgroundColor: '#fff' },
  cover: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#e7f5ff' },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: '#222' },
  meta: { fontSize: 12, color: '#868e96', marginTop: 2 },
  description: { fontSize: 13, color: '#555', marginTop: 4 },
  empty: { alignItems: 'center', gap: 14, marginTop: 30 },
  emptyText: { fontSize: 14, color: '#868e96', textAlign: 'center' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 42, borderRadius: 14, backgroundColor: '#4dabf7' },
  primaryText: { color: '#fff', fontWeight: '800' },
});

export default GroupsScreen;
