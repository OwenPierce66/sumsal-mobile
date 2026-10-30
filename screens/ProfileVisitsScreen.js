/**
 * screens/ProfileVisitsScreen.js
 *
 * Visitas a tu perfil: cuántas tuviste (7 y 30 días) para todos; quién te visitó, con
 * suscripción en la app. Aquí también eliges visitar perfiles en modo anónimo.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import { useQueryClient } from '@tanstack/react-query';
import api, { getImageUrl } from '@api';
import { useMe, useProfileVisits } from '@hooks/useApi';

// Alert.alert no hace nada en la web: ahí se avisa con window.alert.
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

const ProfileVisitsScreen = ({ navigation }) => {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading, isError, refetch } = useProfileVisits(me?.id);
  const [saving, setSaving] = useState(false);

  const toggleAnonymous = async (value) => {
    if (!me?.id || saving) return;
    setSaving(true);
    try {
      const response = await api.patch(`users/${me.id}/visits/`, { anonymous_visits: value });
      queryClient.setQueryData(['profileVisits', me.id], response.data);
    } catch {
      notify('Error', 'No se pudo cambiar el modo anónimo.');
    } finally {
      setSaving(false);
    }
  };

  const openProfile = (person) => {
    if (!person?.id) return;
    navigation.push('UserProfile', {
      userId: person.id,
      userName: person.username,
      userAvatar: getImageUrl(person.user_image),
    });
  };

  const renderVisitors = () => {
    if (!data.can_see_visitors) {
      return (
        <View style={styles.lockedBox}>
          <Ionicons name="lock-closed" size={22} color="#1864ab" />
          <Text style={styles.lockedTitle}>¿Quién visitó tu perfil?</Text>
          <Text style={styles.lockedText}>Con suscripción en la app ves quién te visitó y cuántas veces.</Text>
          <TouchableOpacity style={styles.lockedButton} onPress={() => navigation.navigate('Subscriptions')}>
            <Text style={styles.lockedButtonText}>Ver suscripciones</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!data.visitors?.length) return <Text style={styles.empty}>Nadie ha visitado tu perfil en los últimos 30 días.</Text>;
    return data.visitors.map((visitor) => (
      <TouchableOpacity
        key={visitor.id}
        style={styles.row}
        onPress={() => openProfile(visitor.user)}
        disabled={visitor.anonymous}
        accessibilityLabel={visitor.anonymous ? 'Visitante anónimo' : `Abrir perfil de ${visitor.user?.username}`}
      >
        {visitor.anonymous ? (
          <View style={[styles.avatar, styles.anonymousAvatar]}>
            <Ionicons name="eye-off" size={16} color="#868e96" />
          </View>
        ) : (
          <Image source={{ uri: getImageUrl(visitor.user?.user_image) }} style={styles.avatar} />
        )}
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{visitor.anonymous ? 'Visitante anónimo' : `@${visitor.user?.username || 'usuario'}`}</Text>
          <Text style={styles.rowMeta}>
            {moment(visitor.last_visited_at).locale('es').fromNow()}
            {visitor.visits > 1 ? ` · ${visitor.visits} visitas` : ''}
          </Text>
        </View>
      </TouchableOpacity>
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.title}>Visitas a tu perfil</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {isLoading || !me?.id ? (
          <ActivityIndicator color="#4dabf7" style={styles.loading} />
        ) : isError || !data ? (
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.error}>No se pudieron cargar las visitas. Toca para reintentar.</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.counts}>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>{data.visits_7d}</Text>
                <Text style={styles.countLabel}>Últimos 7 días</Text>
              </View>
              <View style={styles.countBox}>
                <Text style={styles.countNumber}>{data.visits_30d}</Text>
                <Text style={styles.countLabel}>Últimos 30 días</Text>
              </View>
            </View>
            <Text style={styles.hint}>Cada persona cuenta una vez por día.</Text>

            <View style={styles.anonymousRow}>
              <Ionicons name="eye-off-outline" size={18} color="#495057" />
              <View style={styles.anonymousText}>
                <Text style={styles.anonymousTitle}>Visitar perfiles en modo anónimo</Text>
                <Text style={styles.hint}>Tus visitas cuentan, pero no apareces en la lista de quien visitas.</Text>
              </View>
              <Switch
                value={Boolean(data.anonymous_visits)}
                onValueChange={toggleAnonymous}
                disabled={saving}
                trackColor={{ true: '#a5d8ff', false: '#dee2e6' }}
                thumbColor={data.anonymous_visits ? '#4dabf7' : '#adb5bd'}
                accessibilityLabel="Visitar perfiles en modo anónimo"
              />
            </View>

            <Text style={styles.sectionTitle}>Quién te visitó</Text>
            {renderVisitors()}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 34 : 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  back: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#212529' },
  content: { padding: 16, paddingBottom: 40 },
  loading: { marginTop: 32 },
  error: { color: '#c92a2a', fontSize: 13 },
  counts: { flexDirection: 'row', gap: 12 },
  countBox: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#e7f5ff' },
  countNumber: { fontSize: 26, fontWeight: '900', color: '#1864ab' },
  countLabel: { fontSize: 12, fontWeight: '700', color: '#1971c2', marginTop: 2 },
  hint: { fontSize: 11, color: '#868e96', marginTop: 4 },
  anonymousRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: '#f8f9fa' },
  anonymousText: { flex: 1 },
  anonymousTitle: { fontSize: 14, fontWeight: '700', color: '#343a40' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#212529', marginTop: 20, marginBottom: 6 },
  lockedBox: { alignItems: 'center', gap: 6, padding: 16, borderRadius: 14, backgroundColor: '#e7f5ff' },
  lockedTitle: { fontSize: 15, fontWeight: '800', color: '#1864ab' },
  lockedText: { fontSize: 13, color: '#1971c2', textAlign: 'center' },
  lockedButton: { marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#4dabf7' },
  lockedButtonText: { color: '#fff', fontWeight: '800' },
  empty: { fontSize: 13, color: '#868e96', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eee', marginRight: 10 },
  anonymousAvatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f3f5' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  rowMeta: { fontSize: 11, color: '#999', marginTop: 2 },
});

export default ProfileVisitsScreen;
