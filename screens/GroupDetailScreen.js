import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Alert, Modal,
  Platform, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import api from '@api';
import TaskPostCard from '@components/TaskPostCard';
import TaskActionsModal from '@components/TaskActionsModal';
import TouchableUsername from '@components/TouchableUsername';
import FollowHeart from '@components/FollowHeart';
import LinkifiedText from '@components/LinkifiedText';
import useTaskActions from '@hooks/useTaskActions';
import { useGroup, useGroupMembers, useGroupTasks, useIsAdmin, useMe } from '@hooks/useApi';
import { groupErrorMessage } from './GroupFormScreen';
import { groupRoleLabel } from './GroupsScreen';
import CategoryFilterBar from '@components/CategoryFilterBar';
import { useUsersInCategory } from '@hooks/useCategoryFilter';
import { filterByCategoryPath } from '../utils/categoryFilter';

const flattenPages = (data) => (data?.pages ?? []).flatMap((page) => (Array.isArray(page) ? page : page?.results ?? []));
const memberName = (user) => user?.username || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'usuario';

/**
 * Un grupo: portada, descripción, reglas y admins; unirse o salir; y tres pestañas:
 * - Publicaciones: lo aprobado.
 * - Pendientes: los admins aprueban o rechazan; cada integrante ve lo suyo en revisión.
 * - Integrantes: los admins aceptan solicitudes, nombran o quitan admins y expulsan.
 */
const GroupDetailScreen = ({ navigation, route }) => {
  const groupId = route?.params?.groupId;
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const { data: me } = useMe();
  const { data: adminData } = useIsAdmin();
  const { data: group, isLoading, isError, refetch } = useGroup(groupId);

  const [tab, setTab] = useState('posts');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [actionTask, setActionTask] = useState(null);
  // Un solo filtro por categoría para publicaciones, pendientes e integrantes.
  const [category, setCategory] = useState('');

  const isMember = group?.my_status === 'active';
  const isPending = group?.my_status === 'pending';
  const isAdmin = Boolean(group?.is_admin);
  const canSeeContent = Boolean(group) && (!group.is_private || isMember);

  const postsQuery = useGroupTasks(groupId, { enabled: canSeeContent && tab === 'posts', category });
  const pendingQuery = useGroupTasks(groupId, { pending: true, enabled: isMember && tab === 'pending' });
  const membersQuery = useGroupMembers(groupId, { enabled: canSeeContent && tab === 'members' });
  const requestsQuery = useGroupMembers(groupId, { status: 'pending', enabled: isAdmin && tab === 'members' });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['group', String(groupId)] });
    queryClient.invalidateQueries({ queryKey: ['groupTasks', String(groupId)] });
    queryClient.invalidateQueries({ queryKey: ['groupMembers', String(groupId)] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  const run = async (key, request, { errorTitle = 'No se pudo completar', after } = {}) => {
    setBusy(key);
    try {
      const result = await request();
      after?.(result);
      refreshAll();
    } catch (error) {
      Alert.alert(errorTitle, groupErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  // Al volver de publicar (o de editar el grupo) se recarga lo que pudo cambiar.
  useEffect(() => navigation.addListener?.('focus', refreshAll), [navigation, groupId]);

  const join = () => run('join', () => api.post(`groups/${groupId}/join/`), {
    after: ({ data }) => {
      if (data?.my_status === 'pending') {
        Alert.alert('Solicitud enviada', 'Un admin del grupo revisará tu solicitud para entrar.');
      }
    },
  });
  const leave = () => {
    setMenuOpen(false);
    run('leave', () => api.post(`groups/${groupId}/leave/`), { errorTitle: 'No puedes salir' });
  };
  const deleteGroup = () => {
    setMenuOpen(false);
    run('delete', () => api.delete(`groups/${groupId}/`), {
      after: () => {
        queryClient.removeQueries({ queryKey: ['group', String(groupId)] });
        navigation.goBack();
      },
    });
  };
  const review = (task, approve) => run(`review-${task.id}`, () => api.post(
    `groups/${groupId}/tasks/${task.id}/review/`, { approve },
  ));
  const updateMember = (member, body) => run(`member-${member.user.id}`, () => api.patch(
    `groups/${groupId}/members/${member.user.id}/`, body,
  ));
  const removeMember = (member) => {
    setConfirmRemoveId(null);
    run(`member-${member.user.id}`, () => api.delete(`groups/${groupId}/members/${member.user.id}/`));
  };

  const publish = () => navigation.navigate('CreateTask', {
    groupId,
    groupName: group?.name,
    groupIsAdmin: isAdmin,
    initialPch: 'consejos',
  });

  const likeTask = async (task) => {
    try {
      await api.post(`tasks/${task.id}/like/`);
    } finally {
      queryClient.invalidateQueries({ queryKey: ['groupTasks', String(groupId)] });
    }
  };

  const taskActions = useTaskActions({
    navigation,
    actionTask,
    currentUserId: me?.id,
    close: () => setActionTask(null),
    refresh: () => queryClient.invalidateQueries({ queryKey: ['groupTasks', String(groupId)] }),
    onDeleted: () => queryClient.invalidateQueries({ queryKey: ['groupTasks', String(groupId)] }),
  });

  const renderTask = (task, { pending = false } = {}) => (
    <View key={task.id}>
      {pending ? (
        <View style={styles.reviewBar}>
          <Text style={[styles.reviewStatus, task.group_status === 'rejected' && styles.reviewRejected]}>
            {task.group_status === 'rejected' ? 'Rechazada por un admin' : 'Esperando aprobación'}
          </Text>
          {isAdmin && task.group_status === 'pending' ? (
            <View style={styles.reviewButtons}>
              <TouchableOpacity
                style={[styles.reviewButton, styles.rejectButton]}
                onPress={() => review(task, false)}
                disabled={Boolean(busy)}
                accessibilityLabel={`Rechazar ${task.title}`}
              >
                <Text style={styles.rejectText}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reviewButton, styles.approveButton]}
                onPress={() => review(task, true)}
                disabled={Boolean(busy)}
                accessibilityLabel={`Aprobar ${task.title}`}
              >
                <Text style={styles.approveText}>Aprobar</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}
      <TaskPostCard
        task={task}
        navigation={navigation}
        carouselWidth={Math.min(width, 900) - 56}
        onOpenDetail={(t) => navigation.push('TaskDetail', { taskId: t.id })}
        onPressComments={(t) => navigation.push('TaskDetail', { taskId: t.id })}
        showTopComment
        onLike={pending ? undefined : likeTask}
        onOpenActions={pending ? undefined : setActionTask}
      />
    </View>
  );

  const renderMember = (member, { request = false } = {}) => {
    const role = groupRoleLabel(member.role);
    const isSelf = String(member.user.id) === String(me?.id);
    const canManage = isAdmin && !isSelf && member.role !== 'owner';
    const working = busy === `member-${member.user.id}`;
    return (
      <View key={member.id} style={styles.memberRow}>
        <Image
          source={{ uri: member.user.user_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(memberName(member.user))}` }}
          style={styles.memberAvatar}
        />
        <View style={styles.memberText}>
          <TouchableUsername username={memberName(member.user)} userId={member.user.id} navigation={navigation} />
          {role ? <Text style={styles.roleBadge}>{role}</Text> : null}
        </View>
        <FollowHeart userId={member.user.id} username={memberName(member.user)} size={18} />
        {working ? <ActivityIndicator size="small" color="#4dabf7" /> : null}
        {!working && request ? (
          <View style={styles.memberActions}>
            <TouchableOpacity style={[styles.smallButton, styles.approveButton]} onPress={() => updateMember(member, { status: 'active' })}>
              <Text style={styles.approveText}>Aceptar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.smallButton, styles.rejectButton]} onPress={() => removeMember(member)}>
              <Text style={styles.rejectText}>Rechazar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!working && !request && canManage ? (
          <View style={styles.memberActions}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => updateMember(member, { role: member.role === 'admin' ? 'member' : 'admin' })}
            >
              <Text style={styles.smallButtonText}>{member.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}</Text>
            </TouchableOpacity>
            {member.role !== 'admin' ? (
              confirmRemoveId === member.id ? (
                <TouchableOpacity style={[styles.smallButton, styles.rejectButton]} onPress={() => removeMember(member)}>
                  <Text style={styles.rejectText}>¿Expulsar?</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.smallButton} onPress={() => setConfirmRemoveId(member.id)} accessibilityLabel={`Expulsar a ${memberName(member.user)}`}>
                  <Ionicons name="person-remove-outline" size={16} color="#e03131" />
                </TouchableOpacity>
              )
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const activeQuery = tab === 'posts' ? postsQuery : tab === 'pending' ? pendingQuery : null;
  const tasks = useMemo(() => {
    const list = flattenPages(activeQuery?.data);
    // Las publicaciones ya llegan filtradas del servidor; las pendientes (pocas) se filtran aquí.
    return tab === 'pending' ? filterByCategoryPath(list, category) : list;
  }, [activeQuery?.data, tab, category]);
  // Las categorías de cada integrante son las de sus tareas.
  const membersByCategory = useUsersInCategory(membersQuery.data, category, (member) => member.user?.id);

  if (isLoading) {
    return <View style={styles.container}><ActivityIndicator style={styles.loader} color="#4dabf7" /></View>;
  }
  if (isError || !group) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => refetch()} style={styles.errorBox}>
          <Text style={styles.empty}>No se pudo cargar el grupo. Toca para reintentar.</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pendingCount = isAdmin ? group.pending_posts_count : group.my_pending_posts_count;
  const header = (
    <View>
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          {group.image_url ? (
            <Image source={{ uri: group.image_url }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}><Ionicons name="people" size={30} color="#4dabf7" /></View>
          )}
          <View style={styles.headerText}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.meta}>
              <Ionicons name={group.is_private ? 'lock-closed' : 'globe-outline'} size={12} color="#868e96" />
              {' '}{group.is_private ? 'Grupo privado' : 'Grupo público'} · {group.members_count === 1 ? '1 integrante' : `${group.members_count} integrantes`}
            </Text>
            {groupRoleLabel(group.my_role) && isMember ? <Text style={styles.myRole}>Eres {groupRoleLabel(group.my_role).toLowerCase()}</Text> : null}
          </View>
        </View>

        {group.description ? <LinkifiedText style={styles.description} text={group.description} /> : null}

        {group.rules ? (
          <TouchableOpacity onPress={() => setRulesOpen((open) => !open)} style={styles.rulesToggle} accessibilityRole="button">
            <Ionicons name="document-text-outline" size={16} color="#845ef7" />
            <Text style={styles.rulesTitle}>Reglas del grupo</Text>
            <Ionicons name={rulesOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#845ef7" />
          </TouchableOpacity>
        ) : null}
        {rulesOpen && group.rules ? <Text style={styles.rules}>{group.rules}</Text> : null}

        <Text style={styles.adminsLabel}>Admins</Text>
        <View style={styles.adminsRow}>
          {(group.admins || []).map((admin) => (
            <View key={admin.id} style={styles.adminChip}>
              <Ionicons name={admin.role === 'owner' ? 'star' : 'shield-checkmark'} size={12} color="#845ef7" />
              <TouchableUsername
                username={memberName(admin.user)}
                userId={admin.user.id}
                navigation={navigation}
                textStyle={styles.adminName}
              />
            </View>
          ))}
        </View>

        <View style={styles.actionsRow}>
          {isMember ? (
            <TouchableOpacity style={styles.primaryButton} onPress={publish} accessibilityRole="button">
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={styles.primaryText}>Publicar en el grupo</Text>
            </TouchableOpacity>
          ) : isPending ? (
            <TouchableOpacity style={[styles.primaryButton, styles.pendingButton]} onPress={leave} accessibilityRole="button">
              <Text style={styles.pendingText}>Solicitud enviada · Cancelar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primaryButton} onPress={join} disabled={busy === 'join'} accessibilityRole="button">
              {busy === 'join' ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={styles.primaryText}>{group.is_private ? 'Pedir unirme' : 'Unirme'}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        {isMember && !isAdmin ? (
          <Text style={styles.hint}>Lo que publiques aquí lo revisa un admin antes de que se vea.</Text>
        ) : null}
      </View>

      {canSeeContent ? (
        <>
        <View style={styles.tabs}>
          {[
            ['posts', 'Publicaciones'],
            ...(isMember ? [['pending', isAdmin ? 'Por aprobar' : 'Mis pendientes']] : []),
            ['members', 'Integrantes'],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === key }}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
              {key === 'pending' && pendingCount ? <Text style={styles.tabBadge}>{pendingCount}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
        <CategoryFilterBar value={category} onChange={setCategory} style={styles.filterBar} />
        </>
      ) : (
        <View style={styles.lockedBox}>
          <Ionicons name="lock-closed-outline" size={26} color="#868e96" />
          <Text style={styles.empty}>Este grupo es privado. Cuando un admin acepte tu solicitud verás lo que se publica.</Text>
        </View>
      )}
    </View>
  );

  const members = membersQuery.data ?? [];
  const requests = requestsQuery.data ?? [];
  const membersContent = (
    <View style={styles.membersBox}>
      {isAdmin && requests.length ? (
        <>
          <Text style={styles.sectionTitle}>Solicitudes para entrar ({requests.length})</Text>
          {requests.map((member) => renderMember(member, { request: true }))}
        </>
      ) : null}
      <Text style={styles.sectionTitle}>
        Integrantes ({membersByCategory.active ? `${membersByCategory.items.length} de ${members.length}` : members.length})
      </Text>
      {membersQuery.isLoading || membersByCategory.loading
        ? <ActivityIndicator color="#4dabf7" />
        : membersByCategory.items.map((member) => renderMember(member))}
      {membersByCategory.active && !membersByCategory.loading && !membersByCategory.items.length ? (
        <Text style={styles.empty}>Ningún integrante tiene esa categoría.</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Groups'))}
          style={styles.backBtn}
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>Grupo</Text>
        {isMember || isAdmin ? (
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.menuBtn} accessibilityLabel="Opciones del grupo">
            <Ionicons name="ellipsis-vertical" size={22} color="#333" />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={tab === 'members' || !canSeeContent ? [] : tasks}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => renderTask(item, { pending: tab === 'pending' })}
        ListHeaderComponent={header}
        ListFooterComponent={tab === 'members' && canSeeContent ? membersContent : (
          activeQuery?.isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color="#4dabf7" /> : null
        )}
        ListEmptyComponent={tab !== 'members' && canSeeContent ? (
          activeQuery?.isLoading ? <ActivityIndicator style={{ marginTop: 20 }} color="#4dabf7" /> : (
            <Text style={[styles.empty, { marginTop: 20 }]}>
              {tab === 'pending'
                ? (isAdmin ? 'No hay publicaciones esperando aprobación.' : 'No tienes publicaciones en revisión.')
                : category ? 'No hay publicaciones con esa categoría.' : 'Todavía no hay publicaciones en el grupo.'}
            </Text>
          )
        ) : null}
        onEndReached={() => activeQuery?.hasNextPage && activeQuery.fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refreshAll} />}
        contentContainerStyle={styles.listContent}
      />

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuCard}>
            {isAdmin ? (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={() => { setMenuOpen(false); navigation.navigate('GroupForm', { group }); }}
              >
                <Ionicons name="pencil-outline" size={20} color="#4dabf7" />
                <Text style={styles.menuText}>Editar grupo y reglas</Text>
              </TouchableOpacity>
            ) : null}
            {isMember && group.my_role !== 'owner' ? (
              <TouchableOpacity style={styles.menuOption} onPress={leave}>
                <Ionicons name="exit-outline" size={20} color="#e67700" />
                <Text style={styles.menuText}>Salir del grupo</Text>
              </TouchableOpacity>
            ) : null}
            {group.my_role === 'owner' ? (
              <TouchableOpacity style={[styles.menuOption, styles.menuDanger]} onPress={deleteGroup}>
                <Ionicons name="trash-outline" size={20} color="#e03131" />
                <Text style={[styles.menuText, { color: '#e03131' }]}>Eliminar grupo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <TaskActionsModal
        visible={Boolean(actionTask)}
        onClose={() => setActionTask(null)}
        actionTask={actionTask}
        currentUserId={me?.id}
        isAdmin={Boolean(adminData?.isAdmin)}
        canEdit={Boolean(actionTask) && String(actionTask?.user?.id) === String(me?.id)}
        handlers={taskActions}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  loader: { marginTop: 40 },
  topBar: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 16 },
  backBtn: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 50 : 16, zIndex: 10 },
  menuBtn: { position: 'absolute', right: 16, top: Platform.OS === 'ios' ? 50 : 16, zIndex: 10 },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#333' },
  listContent: { paddingBottom: 40 },
  errorBox: { padding: 24 },
  headerCard: { margin: 12, padding: 16, borderRadius: 20, backgroundColor: '#fff', gap: 10 },
  headerRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  cover: { width: 72, height: 72, borderRadius: 18, backgroundColor: '#e7f5ff' },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  groupName: { fontSize: 20, fontWeight: '800', color: '#222' },
  meta: { fontSize: 12, color: '#868e96', marginTop: 3 },
  myRole: { fontSize: 12, color: '#845ef7', fontWeight: '700', marginTop: 3 },
  description: { fontSize: 14, color: '#444', lineHeight: 20 },
  rulesToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rulesTitle: { fontSize: 14, fontWeight: '700', color: '#845ef7' },
  rules: { fontSize: 13, color: '#555', lineHeight: 19, backgroundColor: '#f8f0fc', borderRadius: 12, padding: 10 },
  adminsLabel: { fontSize: 12, fontWeight: '800', color: '#868e96' },
  adminsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  adminChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: '#f3f0ff' },
  adminName: { fontSize: 13, color: '#5f3dc4', fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 14, backgroundColor: '#4dabf7' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pendingButton: { backgroundColor: '#fff4e6' },
  pendingText: { color: '#e67700', fontWeight: '700' },
  hint: { fontSize: 12, color: '#868e96' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 10, flexWrap: 'wrap' },
  filterBar: { marginBottom: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: '#d0ebff', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  tabText: { color: '#4dabf7', fontWeight: '700', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  tabBadge: { minWidth: 18, textAlign: 'center', paddingHorizontal: 5, borderRadius: 9, overflow: 'hidden', backgroundColor: '#ff6b6b', color: '#fff', fontSize: 11, fontWeight: '800' },
  lockedBox: { alignItems: 'center', gap: 8, padding: 24 },
  empty: { fontSize: 14, color: '#868e96', textAlign: 'center', paddingHorizontal: 20 },
  reviewBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 12, marginBottom: 6, gap: 8 },
  reviewStatus: { fontSize: 12, fontWeight: '800', color: '#e67700' },
  reviewRejected: { color: '#e03131' },
  reviewButtons: { flexDirection: 'row', gap: 8 },
  reviewButton: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  approveButton: { backgroundColor: '#2f9e44' },
  approveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  rejectButton: { backgroundColor: '#ffe3e3' },
  rejectText: { color: '#e03131', fontWeight: '800', fontSize: 12 },
  membersBox: { marginHorizontal: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#333', marginTop: 8, marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, marginBottom: 8, borderRadius: 14, backgroundColor: '#fff' },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#eee' },
  memberText: { flex: 1, gap: 2 },
  roleBadge: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', color: '#845ef7', backgroundColor: '#f3f0ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
  memberActions: { flexDirection: 'row', gap: 6 },
  smallButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f1f3f5', alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontSize: 12, fontWeight: '700', color: '#495057' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuCard: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 20, gap: 8 },
  menuOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#f5f5f5' },
  menuDanger: { backgroundColor: '#ffe3e3' },
  menuText: { fontSize: 15, fontWeight: '600', color: '#333' },
});

export default GroupDetailScreen;
