import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import api, { getImageUrl } from '@api';
import TouchableUsername from '@components/TouchableUsername';

const getName = (user) => (
  user?.username
  || [user?.first_name, user?.last_name].filter(Boolean).join(' ')
  || 'Perfil'
);

/**
 * Lista de personas relacionadas con un usuario.
 * Params: userId, userName (opcional) y mode:
 *   'followers'   -> quién lo sigue
 *   'following'   -> a quién sigue
 *   'favoritedBy' -> quién lo tiene en favoritos (solo quienes lo hacen público)
 */
const MODES = {
  followers: { title: 'Seguidores', path: 'followers', empty: 'Todavía no tiene seguidores.' },
  following: { title: 'Siguiendo', path: 'following', empty: 'Todavía no sigue a nadie.' },
  favoritedBy: { title: 'Lo tienen en favoritos', path: 'favorited-by', empty: 'Nadie visible lo tiene en favoritos.' },
};

const FollowListScreen = ({ navigation, route }) => {
  const userId = route?.params?.userId;
  const mode = MODES[route?.params?.mode] ? route.params.mode : 'followers';
  const { title, path, empty: emptyText } = MODES[mode];
  const ownerName = route?.params?.userName;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['followList', userId, mode],
    queryFn: async () => (await api.get(`users/${userId}/${path}/`)).data,
    enabled: !!userId,
    refetchOnMount: 'always',
  });

  const users = data?.users ?? [];
  // `count` es el total real; `visible_count` (solo favoritedBy) los que se pueden listar.
  const total = data?.visible_count ?? data?.count ?? users.length;
  const hiddenCount = data?.visible_count != null ? Math.max(0, (data.count ?? 0) - data.visible_count) : 0;
  const refreshing = isFetching && !isLoading;

  const openProfile = useCallback((user) => {
    navigation.navigate('UserProfile', {
      userId: user.id,
      userName: getName(user),
      userAvatar: getImageUrl(user.user_image),
    });
  }, [navigation]);

  const renderItem = ({ item }) => {
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(' ');
    return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.avatarWrap} onPress={() => openProfile(item)} activeOpacity={0.8}>
        {item.user_image ? (
          <Image source={{ uri: getImageUrl(item.user_image) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Ionicons name="person" size={22} color="#adb5bd" />
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.cardText}>
        <TouchableUsername
          username={getName(item)}
          userId={item.id}
          userImage={getImageUrl(item.user_image)}
          navigation={navigation}
          textStyle={styles.cardTitle}
        />
        {fullName && fullName !== getName(item) ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>{fullName}</Text>
        ) : null}
      </View>
    </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{title}</Text>
          {ownerName ? <Text style={styles.headerSubtitle} numberOfLines={1}>{ownerName}</Text> : null}
        </View>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={styles.loader} />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.empty}>No se pudo cargar la lista. Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
          ListHeaderComponent={users.length > 0 || hiddenCount > 0 ? (
            <Text style={styles.count}>
              {users.length > 0 ? `${total} ${total === 1 ? 'persona' : 'personas'}` : ''}
              {hiddenCount > 0 ? `${users.length > 0 ? ' · ' : ''}${hiddenCount} ${hiddenCount === 1 ? 'oculta' : 'ocultas'} por privacidad` : ''}
            </Text>
          ) : null}
          ListEmptyComponent={(
            <Text style={styles.empty}>{emptyText}</Text>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: Platform.OS === 'android' ? 34 : 50,
    backgroundColor: '#fff',
  },
  backButton: { width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#212529', fontSize: 18, fontWeight: '700' },
  headerSubtitle: { color: '#868e96', fontSize: 12, marginTop: 2 },
  list: { padding: 12, gap: 10 },
  count: { color: '#868e96', fontSize: 12, marginBottom: 6 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, gap: 12 },
  avatarWrap: {},
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e9ecef' },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1 },
  cardTitle: { color: '#212529', fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: '#868e96', fontSize: 12, marginTop: 3 },
  loader: { marginTop: 40 },
  empty: { textAlign: 'center', color: '#868e96', marginTop: 40 },
});

export default FollowListScreen;
