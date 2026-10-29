import React, { useEffect } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import api from '@api';
import TouchableUsername from '@components/TouchableUsername';
import FollowHeart from '@components/FollowHeart';
import { formatMoney } from '../utils/subscriptions';
import CategoryFilterBar from '@components/CategoryFilterBar';
import { useProfileCategoryFilter } from '@hooks/useCategoryFilter';

/** Quién apoyó monetariamente la petición y cuánto (en MXN), igual que la lista de likes. */
const PetitionSupportersModal = ({ visible, onClose, taskId, navigation }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['petitionSupporters', String(taskId)],
    queryFn: async () => (await api.get(`tasks/${taskId}/supporters/`)).data,
    enabled: Boolean(visible && taskId),
  });
  const supporters = data?.supporters || [];
  // Filtro por categoría: las de cada perfil son las de sus tareas.
  const byCategory = useProfileCategoryFilter(supporters);
  useEffect(() => { if (!visible) byCategory.setCategory(''); }, [visible]);

  const openProfile = (userId, username, userImage) => {
    onClose?.();
    navigation?.navigate('UserProfile', { userId, userName: username || 'Usuario', userAvatar: userImage });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Apoyo recaudado</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          {data?.support_total ? (
            <Text style={styles.total}>
              {formatMoney(data.support_total.amount_mxn, 'mxn')} de {data.support_total.supporters_count}{' '}
              {data.support_total.supporters_count === 1 ? 'persona' : 'personas'}
            </Text>
          ) : null}

          {supporters.length ? (
            <CategoryFilterBar value={byCategory.category} onChange={byCategory.setCategory} style={styles.filterBar} />
          ) : null}
          {isLoading || byCategory.loading ? (
            <ActivityIndicator style={styles.state} color="#2f9e44" />
          ) : isError ? (
            <Text style={styles.empty}>No se pudo cargar la lista.</Text>
          ) : (
            <FlatList
              data={byCategory.items}
              keyExtractor={(item) => String(item.id)}
              ListEmptyComponent={(
                <Text style={styles.empty}>
                  {byCategory.active ? 'Nadie de esta lista tiene esa categoría.' : 'Todavía nadie apoya esta petición.'}
                </Text>
              )}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <Image
                    source={{ uri: item.user_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'U')}` }}
                    style={styles.avatar}
                  />
                  <View style={styles.name}>
                    <TouchableUsername
                      username={item.username || [item.first_name, item.last_name].filter(Boolean).join(' ')}
                      userId={item.id}
                      userImage={item.user_image}
                      onNavigate={openProfile}
                    />
                  </View>
                  <Text style={styles.amount}>{formatMoney(item.amount_mxn, 'mxn')}</Text>
                  <FollowHeart userId={item.id} username={item.username} size={18} style={styles.followHeart} />
                </View>
              )}
            />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '70%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '800', color: '#222' },
  total: { fontSize: 13, color: '#2f9e44', fontWeight: '700', marginTop: 4, marginBottom: 10 },
  state: { marginVertical: 24 },
  filterBar: { marginHorizontal: -12 },
  empty: { textAlign: 'center', color: '#999', marginVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  avatar: { width: 38, height: 38, borderRadius: 19, marginRight: 12, backgroundColor: '#eee' },
  name: { flex: 1 },
  amount: { fontSize: 14, fontWeight: '800', color: '#2f9e44' },
  followHeart: { marginLeft: 10 },
});

export default PetitionSupportersModal;
