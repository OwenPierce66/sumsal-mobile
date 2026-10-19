import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import api from '@api';
import { AuthContext } from '@app';

const TABS = [
  { id: 'users', label: 'Usuarios', icon: 'people-outline' },
  { id: 'tasks', label: 'Contenido', icon: 'newspaper-outline' },
  { id: 'reports', label: 'Denuncias', icon: 'flag-outline' },
];

const AdminScreen = ({ navigation }) => {
  const { user } = useContext(AuthContext);
  const isSuperAdmin = Boolean(user?.is_superuser);
  const [tab, setTab] = useState('reports');
  const [reportStatus, setReportStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const requestId = useRef(0);

  const endpointForTab = useCallback(() => {
    if (tab === 'users') return 'admin/users/';
    if (tab === 'tasks') return 'admin/tasks/';
    return 'admin/reports/';
  }, [tab]);

  const loadPage = useCallback(async (page = 1, append = false) => {
    const currentRequest = ++requestId.current;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError('');
    }
    try {
      const params = { page, page_size: 20 };
      if (search.trim()) params.search = search.trim();
      if (tab === 'reports') params.status = reportStatus;
      const response = await api.get(endpointForTab(), { params });
      if (currentRequest !== requestId.current) return;
      const results = response.data?.results || [];
      setItems(previous => append ? [...previous, ...results] : results);
      setNextPage(response.data?.next ? page + 1 : null);
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      const message = requestError.response?.data?.detail || 'No se pudo cargar esta sección.';
      setError(message);
      if (!append) setItems([]);
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [endpointForTab, reportStatus, search, tab]);

  useEffect(() => {
    const timer = setTimeout(() => loadPage(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadPage]);

  const refresh = () => loadPage();

  const confirmAction = (title, message, onConfirm, destructive = false) => {
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
  };

  const updateAccount = async (target, payload) => {
    setActionId(target.id);
    try {
      const endpoint = payload.is_active !== undefined
        ? `admin/users/${target.id}/active/`
        : `admin/users/${target.id}/role/`;
      await api.post(endpoint, payload);
      await loadPage();
    } catch (requestError) {
      Alert.alert('No se pudo actualizar', requestError.response?.data?.detail || 'Inténtalo de nuevo.');
    } finally {
      setActionId(null);
    }
  };

  const deleteTask = task => {
    confirmAction(
      'Eliminar publicación',
      `Se eliminará permanentemente “${task.title || 'esta publicación'}” y su contenido asociado.`,
      async () => {
        setActionId(task.id);
        try {
          await api.delete(`tasks/${task.id}/`);
          await loadPage();
        } catch (requestError) {
          Alert.alert('No se pudo eliminar', requestError.response?.data?.detail || 'Inténtalo de nuevo.');
        } finally {
          setActionId(null);
        }
      },
      true
    );
  };

  const updateReport = async (report, status) => {
    setActionId(report.id);
    try {
      await api.patch(`admin/reports/${report.id}/`, { status });
      await loadPage();
    } catch (requestError) {
      Alert.alert('No se pudo actualizar la denuncia', requestError.response?.data?.detail || 'Inténtalo de nuevo.');
    } finally {
      setActionId(null);
    }
  };

  const editReportedTask = async report => {
    if (report.target_type !== 'task') return;
    setActionId(report.id);
    try {
      const response = await api.get(`tasks/${report.target_id}/`);
      navigation.navigate('CreateTask', { task: response.data });
    } catch (requestError) {
      Alert.alert('No se pudo abrir la publicación', requestError.response?.data?.detail || 'Inténtalo de nuevo.');
    } finally {
      setActionId(null);
    }
  };

  const moderateReportedContent = report => {
    confirmAction(
      'Eliminar contenido reportado',
      'El contenido se eliminará permanentemente y la denuncia quedará resuelta.',
      async () => {
        setActionId(report.id);
        try {
          await api.delete(`admin/reports/${report.id}/content/`);
          await loadPage();
        } catch (requestError) {
          Alert.alert('No se pudo eliminar', requestError.response?.data?.detail || 'Inténtalo de nuevo.');
        } finally {
          setActionId(null);
        }
      },
      true
    );
  };

  const suspendReportedUser = report => {
    confirmAction(
      'Suspender cuenta reportada',
      'La cuenta quedará desactivada, pero sus datos se conservarán.',
      async () => {
        setActionId(report.id);
        try {
          await api.post(`admin/reports/${report.id}/suspend-user/`);
          await loadPage();
        } catch (requestError) {
          Alert.alert('No se pudo suspender', requestError.response?.data?.detail || 'Inténtalo de nuevo.');
        } finally {
          setActionId(null);
        }
      },
      true
    );
  };

  const renderUser = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.iconBadge}><Ionicons name="person-outline" size={20} color="#4dabf7" /></View>
        <View style={styles.flex}>
          <Text style={styles.itemTitle}>{item.username || item.email}</Text>
          <Text style={styles.itemSecondary}>{item.email}</Text>
          <Text style={styles.itemSecondary}>{item.is_superuser ? 'Superadministrador' : item.is_staff ? 'Staff' : 'Usuario'} · {item.is_active ? 'Activo' : 'Suspendido'}</Text>
        </View>
      </View>
      {isSuperAdmin && !item.is_superuser ? (
        <View style={styles.actions}>
          <ActionButton
            label={item.is_active ? 'Suspender' : 'Reactivar'}
            icon={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
            disabled={actionId === item.id}
            onPress={() => confirmAction(
              item.is_active ? 'Suspender cuenta' : 'Reactivar cuenta',
              item.is_active
                ? `La cuenta de ${item.username || item.email} quedará desactivada; sus datos se conservarán.`
                : `¿Reactivar la cuenta de ${item.username || item.email}?`,
              () => updateAccount(item, { is_active: !item.is_active }),
              item.is_active
            )}
            destructive={item.is_active}
          />
          <ActionButton
            label={item.is_staff ? 'Quitar staff' : 'Hacer staff'}
            icon="shield-outline"
            disabled={actionId === item.id}
            onPress={() => confirmAction(
              item.is_staff ? 'Quitar rol staff' : 'Asignar rol staff',
              `${item.is_staff ? 'Se retirarán' : 'Se otorgarán'} permisos de moderación.`,
              () => updateAccount(item, { is_staff: !item.is_staff })
            )}
          />
        </View>
      ) : null}
    </View>
  );

  const renderTask = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.itemTitle}>{item.title || 'Sin título'}</Text>
      <Text style={styles.itemSecondary}>
        {item.user?.username || item.username || 'Usuario'} · {item.pch || 'Publicación'}
      </Text>
      {item.description ? <Text style={styles.preview} numberOfLines={3}>{item.description}</Text> : null}
      <View style={styles.actions}>
        <ActionButton
          label="Editar"
          icon="create-outline"
          disabled={actionId === item.id}
          onPress={() => navigation.navigate('CreateTask', { task: item })}
        />
        <ActionButton
          label="Eliminar"
          icon="trash-outline"
          destructive
          disabled={actionId === item.id}
          onPress={() => deleteTask(item)}
        />
      </View>
    </View>
  );

  const renderReport = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.iconBadge}><Ionicons name="flag-outline" size={20} color="#e67700" /></View>
        <View style={styles.flex}>
          <Text style={styles.itemTitle}>{item.target_type.replace('_', ' ')} · {item.target_summary?.preview || 'Contenido no disponible'}</Text>
          <Text style={styles.itemSecondary}>Reportó {item.reporter?.username || item.reporter?.email || 'Usuario'} · {item.status}</Text>
        </View>
      </View>
      <Text style={styles.preview}>{item.reason}</Text>
      <View style={styles.actions}>
        {item.target_type === 'task' ? (
          <ActionButton
            label="Revisar publicación"
            icon="open-outline"
            disabled={actionId === item.id}
            onPress={() => editReportedTask(item)}
          />
        ) : null}
        {item.target_type === 'user' && isSuperAdmin ? (
          <ActionButton
            label="Suspender cuenta"
            icon="person-remove-outline"
            destructive
            disabled={actionId === item.id}
            onPress={() => suspendReportedUser(item)}
          />
        ) : null}
        {item.target_type !== 'user' ? (
          <ActionButton
            label="Eliminar contenido"
            icon="trash-outline"
            destructive
            disabled={actionId === item.id}
            onPress={() => moderateReportedContent(item)}
          />
        ) : null}
        <ActionButton
          label="Descartar"
          icon="close-circle-outline"
          disabled={actionId === item.id}
          onPress={() => updateReport(item, 'dismissed')}
        />
        <ActionButton
          label="Resolver"
          icon="checkmark-circle-outline"
          disabled={actionId === item.id}
          onPress={() => updateReport(item, 'resolved')}
        />
      </View>
    </View>
  );

  const renderItem = tab === 'users' ? renderUser : tab === 'tasks' ? renderTask : renderReport;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Regresar">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Administración</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map(option => (
          <TouchableOpacity
            key={option.id}
            style={[styles.tab, tab === option.id && styles.tabActive]}
            onPress={() => setTab(option.id)}
          >
            <Ionicons name={option.icon} size={17} color={tab === option.id ? '#fff' : '#4dabf7'} />
            <Text style={[styles.tabLabel, tab === option.id && styles.tabLabelActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab !== 'reports' ? (
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={tab === 'users' ? 'Buscar personas' : 'Buscar publicaciones'}
          style={styles.search}
          returnKeyType="search"
          accessibilityLabel="Buscar en administración"
        />
      ) : (
        <View style={styles.reportFilters}>
          {[
            ['pending', 'Pendientes'],
            ['resolved', 'Resueltas'],
            ['dismissed', 'Descartadas'],
          ].map(([value, label]) => (
            <TouchableOpacity
              key={value}
              onPress={() => setReportStatus(value)}
              style={[styles.filterChip, reportStatus === value && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, reportStatus === value && styles.filterLabelActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error ? (
        <TouchableOpacity onPress={refresh} style={styles.errorBox}>
          <Text style={styles.errorText}>{error} Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : loading ? (
        <ActivityIndicator size="large" color="#4dabf7" style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onRefresh={refresh}
          refreshing={loading}
          onEndReached={() => {
            if (nextPage && !loadingMore) loadPage(nextPage, true);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Text style={styles.empty}>No hay elementos en esta sección.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#4dabf7" /> : null}
        />
      )}
    </View>
  );
};

const ActionButton = ({ label, icon, onPress, destructive, disabled }) => (
  <TouchableOpacity
    style={[styles.actionButton, destructive && styles.destructiveButton, disabled && styles.disabled]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
  >
    {disabled ? <ActivityIndicator size="small" color="#777" /> : <Ionicons name={icon} size={17} color={destructive ? '#c92a2a' : '#1971c2'} />}
    <Text style={[styles.actionLabel, destructive && styles.destructiveLabel]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: Platform.OS === 'ios' ? 54 : 16, paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef' },
  backButton: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 52 : 14, padding: 4 },
  headerTitle: { color: '#212529', fontSize: 20, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#fff' },
  tab: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 20, backgroundColor: '#e7f5ff' },
  tabActive: { backgroundColor: '#4dabf7' },
  tabLabel: { color: '#1971c2', fontSize: 12, fontWeight: '700' },
  tabLabelActive: { color: '#fff' },
  search: { marginHorizontal: 12, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dee2e6', color: '#212529' },
  reportFilters: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  filterChip: { borderRadius: 14, backgroundColor: '#e9ecef', paddingHorizontal: 12, paddingVertical: 7 },
  filterChipActive: { backgroundColor: '#4dabf7' },
  filterLabel: { color: '#495057', fontSize: 12, fontWeight: '700' },
  filterLabelActive: { color: '#fff' },
  list: { padding: 12, paddingBottom: 28 },
  card: { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, padding: 14, elevation: 1 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e7f5ff', alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  itemTitle: { color: '#212529', fontSize: 15, fontWeight: '800' },
  itemSecondary: { color: '#868e96', fontSize: 12, marginTop: 3 },
  preview: { color: '#495057', fontSize: 13, lineHeight: 18, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 17, paddingHorizontal: 11, backgroundColor: '#e7f5ff' },
  destructiveButton: { backgroundColor: '#fff0f0' },
  disabled: { opacity: 0.55 },
  actionLabel: { color: '#1971c2', fontSize: 12, fontWeight: '700' },
  destructiveLabel: { color: '#c92a2a' },
  loading: { marginTop: 60 },
  errorBox: { padding: 18, margin: 12, borderRadius: 12, backgroundColor: '#fff0f0' },
  errorText: { color: '#c92a2a', textAlign: 'center' },
  empty: { padding: 28, textAlign: 'center', color: '#868e96' },
});

export default AdminScreen;
