import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import { useQueryClient } from '@tanstack/react-query';

import api, { getImageUrl } from '@api';
import { useProfileActivity } from '@hooks/useApi';

const KINDS = [
  { key: 'likes', label: 'Me gusta', icon: 'heart-outline', hiddenText: 'sus me gusta' },
  { key: 'comments', label: 'Comentarios', icon: 'chatbubble-outline', hiddenText: 'sus comentarios' },
  { key: 'verifications', label: 'Verificaciones', icon: 'shield-checkmark-outline', hiddenText: 'sus verificaciones' },
];

const EMPTY = {
  likes: ['Aún no le das me gusta a nada.', 'Aún no le da me gusta a nada.'],
  comments: ['Aún no has comentado.', 'Aún no ha comentado.'],
  verifications: ['Sin verificaciones todavía.', 'Sin verificaciones todavía.'],
};

const userName = (user) => user?.username || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Usuario';

/**
 * Actividad del perfil ("Ver actividad" en el menú de 3 puntos): me gusta, comentarios y
 * verificaciones. En su propio perfil, el dueño decide con un interruptor por tipo qué ven
 * los demás; en otro perfil solo se ve lo que su dueño muestra.
 */
const ProfileActivity = ({ userId, username, isCurrentUser, navigation, onOpenProfile }) => {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState('likes');
  const { data, isLoading, isError, refetch } = useProfileActivity(userId, kind);
  const [saving, setSaving] = useState(null);
  // Lo que ven los demás (el dueño lo recibe con cada pestaña).
  const [visibility, setVisibility] = useState(null);
  // Primero lo que acabas de cambiar; si no, lo que dijo el servidor.
  const shownVisibility = visibility || data?.visibility;

  if (!userId) return null;

  const togglePublic = async (kindKey, value) => {
    if (saving) return;
    setSaving(kindKey);
    setVisibility({ ...(shownVisibility || {}), [kindKey]: value });
    try {
      const response = await api.patch(`users/${userId}/activity/`, { kind: kindKey, public: value });
      setVisibility(response.data.visibility || null);
      queryClient.setQueryData(['profileActivity', userId, kindKey], response.data);
      queryClient.invalidateQueries({ queryKey: ['profileActivity', userId] });
    } catch {
      setVisibility(null);
      Alert.alert('Error', 'No se pudo cambiar la privacidad.');
    } finally {
      setSaving(null);
    }
  };
  const activeKind = KINDS.find((entry) => entry.key === kind);

  const openTask = (taskId) => navigation?.push?.('TaskDetail', { taskId });
  const openForumPost = (postId) => navigation?.getParent?.()?.navigate('Forum', {
    screen: 'PostDetail', params: { postId },
  });

  const renderUser = (item) => (
    <TouchableOpacity
      key={item.id}
      style={styles.row}
      onPress={() => onOpenProfile?.(item.user)}
      accessibilityRole="button"
      accessibilityLabel={`Abrir perfil de ${userName(item.user)}`}
    >
      <Image source={{ uri: getImageUrl(item.user?.user_image) }} style={styles.avatar} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{userName(item.user)}</Text>
        <Text style={styles.rowMeta}>{moment(item.created_at).locale('es').fromNow()}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderItems = () => {
    if (kind === 'verifications') {
      const { given = [], received = [] } = data?.items || {};
      if (!given.length && !received.length) {
        return <Text style={styles.emptyText}>{EMPTY.verifications[isCurrentUser ? 0 : 1]}</Text>;
      }
      return (
        <>
          {received.length ? <Text style={styles.subTitle}>Lo verificó</Text> : null}
          {received.map(renderUser)}
          {given.length ? <Text style={styles.subTitle}>Verificó a</Text> : null}
          {given.map(renderUser)}
        </>
      );
    }
    const items = Array.isArray(data?.items) ? data.items : [];
    if (!items.length) return <Text style={styles.emptyText}>{EMPTY[kind][isCurrentUser ? 0 : 1]}</Text>;
    return items.map((item) => {
      const isForum = item.kind === 'forum';
      const title = isForum ? item.forum_post?.title || 'una conversación del foro' : item.task?.title || 'una publicación';
      return (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={() => (isForum ? openForumPost(item.forum_post?.id) : openTask(item.task?.id))}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${title}`}
        >
          <Ionicons
            name={kind === 'likes' ? 'heart' : isForum ? 'newspaper-outline' : 'chatbubble-ellipses-outline'}
            size={18}
            color={kind === 'likes' ? '#ff6b6b' : '#4dabf7'}
            style={styles.rowIcon}
          />
          <View style={styles.rowBody}>
            {kind === 'comments' && item.text ? (
              <Text style={styles.rowComment} numberOfLines={2}>“{item.text}”</Text>
            ) : null}
            <Text style={styles.rowTitle} numberOfLines={1}>
              {kind === 'comments' ? `en ${isForum ? 'el foro: ' : ''}${title}` : title}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {item.task?.user?.username ? `de @${item.task.user.username} · ` : ''}
              {moment(item.created_at).locale('es').fromNow()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Actividad</Text>
      <View style={styles.tabs}>
        {KINDS.map((entry) => (
          <TouchableOpacity
            key={entry.key}
            style={[styles.tab, kind === entry.key && styles.tabActive]}
            onPress={() => setKind(entry.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === entry.key }}
          >
            <Ionicons name={entry.icon} size={14} color={kind === entry.key ? '#1864ab' : '#666'} />
            <Text style={[styles.tabText, kind === entry.key && styles.tabTextActive]}>{entry.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isCurrentUser && shownVisibility ? (
        <View style={styles.privacyBox}>
          <Text style={styles.privacyTitle}>Qué ven los demás en tu perfil</Text>
          {KINDS.map((entry) => {
            const isPublic = Boolean(shownVisibility[entry.key]);
            return (
              <View key={entry.key} style={styles.privacyRow}>
                <Ionicons name={entry.icon} size={16} color="#495057" style={styles.privacyIcon} />
                <Text style={styles.privacyText}>
                  {entry.label}: {isPublic ? 'todos lo ven' : 'solo tú'}
                </Text>
                <Switch
                  value={isPublic}
                  onValueChange={(value) => togglePublic(entry.key, value)}
                  disabled={Boolean(saving)}
                  trackColor={{ true: '#a5d8ff', false: '#dee2e6' }}
                  thumbColor={isPublic ? '#4dabf7' : '#adb5bd'}
                  accessibilityLabel={`Mostrar ${entry.label.toLowerCase()} en mi perfil`}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#4dabf7" />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.errorText}>No se pudo cargar. Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : data?.hidden ? (
        <Text style={styles.hiddenText}>
          {username ? `@${username}` : 'Esta persona'} no muestra {activeKind?.hiddenText || 'esta actividad'} en su perfil.
          {' '}Cada quien decide qué mostrar desde su propio perfil.
        </Text>
      ) : (
        <>
          {data?.count > 0 ? (
            <Text style={styles.countText}>{data.count} en total{data.count > 30 ? ' · se muestran las 30 más recientes' : ''}</Text>
          ) : null}
          {renderItems()}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f1f3f5' },
  tabActive: { backgroundColor: '#d0ebff' },
  tabText: { color: '#666', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#1864ab' },
  privacyBox: { backgroundColor: '#f8f9fa', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  privacyTitle: { color: '#343a40', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  privacyIcon: { width: 22 },
  privacyText: { color: '#555', fontSize: 13, flex: 1, marginRight: 12 },
  loader: { marginVertical: 12 },
  errorText: { color: '#d9480f', fontSize: 12 },
  hiddenText: { color: '#868e96', fontSize: 13, paddingVertical: 8 },
  countText: { color: '#868e96', fontSize: 12, marginBottom: 4 },
  subTitle: { color: '#495057', fontSize: 13, fontWeight: '800', marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowIcon: { width: 26 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eee', marginRight: 10 },
  rowBody: { flex: 1 },
  rowTitle: { color: '#333', fontWeight: '700', fontSize: 14 },
  rowComment: { color: '#555', fontSize: 13, fontStyle: 'italic', marginBottom: 2 },
  rowMeta: { color: '#999', fontSize: 11, marginTop: 2 },
  emptyText: { color: '#999', fontSize: 13, paddingVertical: 8 },
});

export default ProfileActivity;
