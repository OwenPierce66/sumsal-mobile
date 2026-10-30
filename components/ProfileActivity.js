import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import { useQueryClient } from '@tanstack/react-query';

import api, { getImageUrl } from '@api';
import { useProfileActivity } from '@hooks/useApi';

// Cada tipo de acción: su nombre, su ícono y cómo se lee cada fila.
export const ACTIVITY_KINDS = [
  { key: 'likes', label: 'Me gusta', icon: 'heart', color: '#ff6b6b' },
  { key: 'comments', label: 'Comentarios', icon: 'chatbubble-ellipses-outline', color: '#4dabf7' },
  { key: 'saves', label: 'Guardados', icon: 'bookmark', color: '#7950f2' },
  { key: 'reposts', label: 'Impulsos', icon: 'repeat', color: '#2f9e44' },
  { key: 'shares', label: 'Compartidos', icon: 'share-social', color: '#1c7ed6' },
  { key: 'follows', label: 'Seguidos', icon: 'person-add', color: '#495057' },
  { key: 'favorites', label: 'Favoritos', icon: 'star', color: '#f59f00' },
  { key: 'recommendations', label: 'Recomendaciones', icon: 'ribbon', color: '#e67700' },
  { key: 'verifications', label: 'Verificaciones', icon: 'shield-checkmark', color: '#4dabf7' },
];
const KIND_BY_KEY = Object.fromEntries(ACTIVITY_KINDS.map((entry) => [entry.key, entry]));

export const LEVELS = [
  { key: 'private', label: 'Solo yo' },
  { key: 'subscribers', label: 'Suscriptores' },
  { key: 'public', label: 'Todos' },
];

const userName = (user) => user?.username || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Usuario';

// Alert.alert no hace nada en la web: ahí se avisa con window.alert.
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

/** Qué dice cada fila: la acción y sobre qué (una publicación, una persona o el foro). */
export function describeActivity(item) {
  switch (item.kind) {
    case 'likes': return 'Me gusta';
    case 'comments': return item.where === 'forum' ? 'Respondió en el foro' : 'Comentó';
    case 'saves': return 'Guardó';
    case 'reposts': return 'Impulsó';
    case 'shares': return 'Compartió';
    case 'follows': return 'Empezó a seguir a';
    case 'favorites': return 'Agregó a favoritos';
    case 'recommendations': return 'Recomendó a';
    case 'verifications': return item.direction === 'received' ? 'Lo verificó' : 'Verificó a';
    default: return '';
  }
}

/**
 * Tu actividad (y la que cada quien muestra en su perfil): me gusta, comentarios, guardados,
 * impulsos, compartidos, seguidos, favoritos, recomendaciones y verificaciones, todo junto o
 * por tipo. El dueño decide quién ve cada tipo: solo él, sus suscriptores (modo de paga) o
 * todos; sus me gusta en modo de paga también los ve quien tiene suscripción en la app.
 */
const ProfileActivity = ({ userId, username, isCurrentUser, navigation, onOpenProfile, showTitle = true }) => {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState('all');
  const { data, isLoading, isError, refetch } = useProfileActivity(userId, kind);
  const [saving, setSaving] = useState(null);
  // Controles del dueño (lo que acaba de cambiar, o lo que dijo el servidor).
  const [settings, setSettings] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(true);
  // Los tipos que se pueden ver (y los de paga): se recuerdan para que las pestañas no salten.
  const [kindsInfo, setKindsInfo] = useState(null);

  useEffect(() => {
    if (data?.kinds) setKindsInfo({ kinds: data.kinds, paid: data.paid_kinds || [] });
  }, [data?.kinds, data?.paid_kinds]);

  if (!userId) return null;

  const shownSettings = settings || (data?.levels ? { levels: data.levels, feed_public: data.feed_public } : null);
  const tabs = isCurrentUser
    ? ACTIVITY_KINDS
    : ACTIVITY_KINDS.filter((entry) => (
      kindsInfo?.kinds?.includes(entry.key) || kindsInfo?.paid?.includes(entry.key)
    ));

  const saveSetting = async (key, body) => {
    if (saving) return;
    setSaving(key);
    try {
      const response = await api.patch(`users/${userId}/activity/`, body);
      setSettings({ levels: response.data.levels, feed_public: response.data.feed_public });
      queryClient.invalidateQueries({ queryKey: ['profileActivity', userId] });
    } catch {
      notify('Error', 'No se pudo cambiar quién ve tu actividad.');
    } finally {
      setSaving(null);
    }
  };

  const openTask = (taskId) => navigation?.push?.('TaskDetail', { taskId });
  const openForumPost = (postId) => navigation?.getParent?.()?.navigate('Forum', {
    screen: 'PostDetail', params: { postId },
  });

  const renderItem = (item) => {
    const entry = KIND_BY_KEY[item.kind] || {};
    const isForum = item.where === 'forum';
    const target = item.user
      ? `@${userName(item.user)}`
      : isForum ? item.forum_post?.title || 'una conversación' : item.task?.title || 'una publicación';
    const onPress = item.user
      ? () => onOpenProfile?.(item.user)
      : isForum ? () => openForumPost(item.forum_post?.id) : () => openTask(item.task?.id);
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.row}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${describeActivity(item)} ${target}`}
      >
        {item.user ? (
          <Image source={{ uri: getImageUrl(item.user?.user_image) }} style={styles.avatar} />
        ) : (
          <View style={[styles.iconBubble, { backgroundColor: `${entry.color || '#4dabf7'}1a` }]}>
            <Ionicons name={entry.icon || 'ellipse'} size={16} color={entry.color || '#4dabf7'} />
          </View>
        )}
        <View style={styles.rowBody}>
          <Text style={styles.rowAction} numberOfLines={1}>
            {describeActivity(item)} · {moment(item.created_at).locale('es').fromNow()}
          </Text>
          <Text style={styles.rowTitle} numberOfLines={1}>{target}</Text>
          {item.text ? <Text style={styles.rowComment} numberOfLines={2}>“{item.text}”</Text> : null}
          {item.task?.user?.username ? <Text style={styles.rowMeta}>de @{item.task.user.username}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderSettings = () => (
    <View style={styles.privacyBox}>
      <TouchableOpacity style={styles.privacyHeader} onPress={() => setSettingsOpen((open) => !open)} accessibilityRole="button">
        <Text style={styles.privacyTitle}>Quién ve tu actividad en tu perfil</Text>
        <Ionicons name={settingsOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#495057" />
      </TouchableOpacity>
      {settingsOpen ? (
        <>
          {ACTIVITY_KINDS.map((entry) => {
            const level = shownSettings.levels?.[entry.key] || 'private';
            return (
              <View key={entry.key} style={styles.levelRow}>
                <Ionicons name={entry.icon} size={15} color={entry.color} style={styles.privacyIcon} />
                <Text style={styles.levelLabel} numberOfLines={1}>{entry.label}</Text>
                <View style={styles.segment}>
                  {LEVELS.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.segmentOption, level === option.key && styles.segmentActive]}
                      onPress={() => level !== option.key && saveSetting(entry.key, { kind: entry.key, level: option.key })}
                      disabled={Boolean(saving)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: level === option.key }}
                      accessibilityLabel={`${entry.label}: ${option.label}`}
                    >
                      <Text style={[styles.segmentText, level === option.key && styles.segmentTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
          <Text style={styles.privacyHint}>
            Suscriptores (modo de paga): quienes pagan tu suscripción. Tus me gusta en este modo también los ven quienes tienen suscripción en la app.
          </Text>
          <View style={styles.privacyRow}>
            <Ionicons name="eye-outline" size={16} color="#495057" style={styles.privacyIcon} />
            <Text style={styles.privacyText}>
              Ver como yo: {shownSettings.feed_public ? 'otros pueden ver tu feed' : 'nadie'}
            </Text>
            <Switch
              value={Boolean(shownSettings.feed_public)}
              onValueChange={(value) => saveSetting('feed', { kind: 'feed', public: value })}
              disabled={Boolean(saving)}
              trackColor={{ true: '#a5d8ff', false: '#dee2e6' }}
              thumbColor={shownSettings.feed_public ? '#4dabf7' : '#adb5bd'}
              accessibilityLabel="Permitir que otros vean mi feed"
            />
          </View>
          <Text style={styles.privacyHint}>
            Ver como yo: otros ven lo que publican las personas que sigues, como si fueran tú (solo lo que a ellos se les permite ver).
          </Text>
        </>
      ) : null}
    </View>
  );

  const hiddenMessage = () => {
    const who = username ? `@${username}` : 'Esta persona';
    if (data?.level === 'subscribers') {
      return `${who} muestra esta actividad solo a sus suscriptores.${kind === 'likes' ? ' Sus me gusta también los ves si tienes suscripción en la app.' : ''}`;
    }
    if (kind === 'all') return `${who} no muestra su actividad en su perfil.`;
    return `${who} no muestra sus ${(KIND_BY_KEY[kind]?.label || 'actividad').toLowerCase()} en su perfil.`;
  };

  const items = Array.isArray(data?.items) ? data.items : [];

  return (
    <View style={styles.container}>
      {showTitle ? <Text style={styles.title}>{isCurrentUser ? 'Tu actividad' : 'Actividad'}</Text> : null}

      {isCurrentUser && shownSettings ? renderSettings() : null}

      <View style={styles.tabs}>
        {[{ key: 'all', label: 'Todo', icon: 'list' }, ...tabs].map((entry) => {
          const locked = !isCurrentUser && kindsInfo?.paid?.includes(entry.key);
          return (
            <TouchableOpacity
              key={entry.key}
              style={[styles.tab, kind === entry.key && styles.tabActive]}
              onPress={() => setKind(entry.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: kind === entry.key }}
            >
              <Ionicons name={locked ? 'lock-closed' : entry.icon} size={13} color={kind === entry.key ? '#1864ab' : '#666'} />
              <Text style={[styles.tabText, kind === entry.key && styles.tabTextActive]}>{entry.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loader} color="#4dabf7" />
      ) : isError ? (
        <TouchableOpacity onPress={() => refetch()} accessibilityRole="button">
          <Text style={styles.errorText}>No se pudo cargar. Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : data?.hidden ? (
        <Text style={styles.hiddenText}>{hiddenMessage()}</Text>
      ) : (
        <>
          {data?.count > 0 ? (
            <Text style={styles.countText}>{data.count} en total{data.count > items.length ? ` · se muestran las ${items.length} más recientes` : ''}</Text>
          ) : null}
          {items.length ? items.map(renderItem) : (
            <Text style={styles.emptyText}>{isCurrentUser ? 'Aún no hay actividad aquí.' : 'Sin actividad todavía.'}</Text>
          )}
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
  privacyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  privacyTitle: { color: '#343a40', fontSize: 13, fontWeight: '800' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, marginTop: 6 },
  privacyIcon: { width: 22 },
  privacyText: { color: '#555', fontSize: 13, flex: 1, marginRight: 12 },
  privacyHint: { color: '#868e96', fontSize: 11, lineHeight: 15, marginTop: 4 },
  levelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  levelLabel: { flex: 1, color: '#495057', fontSize: 13, marginRight: 8 },
  segment: { flexDirection: 'row', borderRadius: 10, backgroundColor: '#e9ecef', padding: 2 },
  segmentOption: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  segmentActive: { backgroundColor: '#4dabf7' },
  segmentText: { fontSize: 11, fontWeight: '700', color: '#495057' },
  segmentTextActive: { color: '#fff' },
  loader: { marginVertical: 12 },
  errorText: { color: '#d9480f', fontSize: 12 },
  hiddenText: { color: '#868e96', fontSize: 13, paddingVertical: 8 },
  countText: { color: '#868e96', fontSize: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  iconBubble: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#eee', marginRight: 10 },
  rowBody: { flex: 1 },
  rowAction: { color: '#868e96', fontSize: 11, fontWeight: '700' },
  rowTitle: { color: '#333', fontWeight: '700', fontSize: 14, marginTop: 1 },
  rowComment: { color: '#555', fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  rowMeta: { color: '#999', fontSize: 11, marginTop: 2 },
  emptyText: { color: '#999', fontSize: 13, paddingVertical: 8 },
});

export default ProfileActivity;
