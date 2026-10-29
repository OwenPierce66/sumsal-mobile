import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '@api';
import useProfileActions from '../hooks/useProfileActions';
import { ReportContentModal } from './ReportContentButton';

const authorName = (author) => author?.username || author?.first_name || 'usuario';

/**
 * Menú de 3 puntos de un comentario o post (comentarios de tareas, foro, testimonios).
 * Lo propio: responder, editar y eliminar (si el padre los pasa). De otra persona: su perfil,
 * mensaje directo, su foro, seguir / favoritos / top 5 (el mismo estado que el corazón) y reportar.
 */
export const ContentActionsMenu = ({
  visible,
  onClose,
  author,
  currentUserId,
  navigation,
  report,
  onReply,
  onEdit,
  onDelete,
  editLabel = 'Editar',
  deleteLabel = 'Eliminar',
}) => {
  const [reportVisible, setReportVisible] = useState(false);
  const isOwn = Boolean(author?.id) && String(author.id) === String(currentUserId);
  const showProfile = Boolean(author?.id) && !isOwn;
  const profile = useProfileActions(showProfile ? author : null, { onBefore: onClose });
  const name = authorName(author);

  const then = (action) => () => {
    onClose?.();
    action?.();
  };
  const openProfile = then(() => navigation?.navigate('UserProfile', {
    userId: author.id,
    userName: name,
    userAvatar: getImageUrl(author.user_image),
  }));
  const directMessage = then(() => navigation?.navigate('ChatDetail', {
    chatId: author.id,
    type: 'direct',
    title: name,
    avatar: getImageUrl(author.user_image),
  }));
  const goToForum = then(() => navigation?.navigate('Forum', {
    screen: 'ForumMain',
    params: { userId: author.id, userName: name },
  }));
  const openReport = () => {
    onClose?.();
    setReportVisible(true);
  };

  const option = (icon, label, onPress, { color = '#555', danger = false } = {}) => (
    <TouchableOpacity
      key={label}
      style={[styles.option, danger && styles.optionDanger]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={danger ? '#ff6b6b' : color} />
      <Text style={[styles.optionText, danger && styles.optionTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {onReply ? option('arrow-undo-outline', 'Responder', then(onReply), { color: '#4dabf7' }) : null}
            {onEdit ? option('pencil-outline', editLabel, then(onEdit), { color: '#4dabf7' }) : null}
            {onDelete ? option('trash-outline', deleteLabel, then(onDelete), { danger: true }) : null}
            {showProfile ? (
              <>
                {option('person-outline', `Ver perfil de @${name}`, openProfile, { color: '#4dabf7' })}
                {option('chatbubbles-outline', 'Mensaje directo', directMessage, { color: '#4dabf7' })}
                {option('newspaper-outline', `Ir al foro de @${name}`, goToForum, { color: '#4dabf7' })}
                {option(
                  profile.isFollowing ? 'person-remove-outline' : 'person-add-outline',
                  profile.isFollowing ? 'Dejar de seguir' : 'Seguir',
                  profile.toggleFollow,
                  { color: '#4dabf7' },
                )}
                {option(
                  profile.isFavorited ? 'heart' : 'heart-outline',
                  profile.isFavorited ? 'Eliminar perfil de favoritos' : 'Agregar perfil a favoritos',
                  profile.toggleFavorite,
                  { color: profile.isFavorited ? '#ff0b5a' : '#555' },
                )}
                {option(
                  profile.isPinned ? 'pin' : 'pin-outline',
                  profile.isPinned ? 'Quitar perfil del top 5' : 'Anclar perfil en top 5',
                  profile.togglePin,
                  { color: '#845ef7' },
                )}
              </>
            ) : null}
            {report?.targetId && !isOwn ? option('flag-outline', 'Reportar', openReport, { color: '#868e96' }) : null}
            <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {report?.targetId ? (
        <ReportContentModal
          visible={reportVisible}
          onClose={() => setReportVisible(false)}
          targetType={report.targetType}
          targetId={report.targetId}
        />
      ) : null}
    </>
  );
};

/**
 * Botón ⋮ con su menú. El menú se monta al abrirse (cada comentario tiene el suyo).
 * `accessibilityLabel` permite distinguirlo (p. ej. "Más opciones del comentario").
 */
const ContentActionsButton = ({ accessibilityLabel = 'Más opciones', color = '#999', size = 18, style, ...menuProps }) => {
  const [open, setOpen] = useState(false);
  const [reportHost, setReportHost] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => { setOpen(true); setReportHost(true); }}
        style={[styles.trigger, style]}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <Ionicons name="ellipsis-vertical" size={size} color={color} />
      </TouchableOpacity>
      {/* Se queda montado después del primer uso para que la ventana de reporte pueda abrirse al cerrar el menú. */}
      {reportHost ? <ContentActionsMenu {...menuProps} visible={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
};

const styles = StyleSheet.create({
  trigger: { paddingHorizontal: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#dee2e6', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 8, backgroundColor: '#f5f5f5' },
  optionDanger: { backgroundColor: '#fff5f5' },
  optionText: { fontSize: 15, marginLeft: 14, color: '#333', fontWeight: '500' },
  optionTextDanger: { color: '#ff6b6b', fontWeight: '700' },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: '#e03131', fontWeight: '600', fontSize: 14 },
});

export default ContentActionsButton;
