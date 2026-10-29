import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AportacionCard from './AportacionCard';
import FavoriteAportacionPicker from './FavoriteAportacionPicker';
import UserTagPicker from './UserTagPicker';
import TouchableUsername from './TouchableUsername';
import { CommentAttachMenu, CommentMediaChip, CommentAttachmentView } from './CommentAttachments';
import { buildMessageBody } from '../utils/commentAportacion';
import { toAportacionInfo } from '../utils/aportaciones';
import { pickPhotoOrVideo } from '../utils/mediaUpload';

/** Personas etiquetadas antes de enviar; tocar una la quita. */
export const TagChips = ({ users, onRemove }) => (users?.length ? (
  <View style={styles.tagsRow}>
    {users.map((user) => (
      <TouchableOpacity
        key={user.id}
        style={styles.tagChip}
        onPress={() => onRemove(user)}
        accessibilityLabel={`Quitar etiqueta @${user.username}`}
      >
        <Text style={styles.tagChipText}>@{user.username}</Text>
        <Ionicons name="close" size={12} color="#1971c2" />
      </TouchableOpacity>
    ))}
  </View>
) : null);

/**
 * Lo que acompaña un mensaje (post o respuesta del foro, comentario de una compartida):
 * el clip con sus tres opciones (publicación guardada, etiquetar, foto o video), la vista
 * previa de lo elegido, los selectores y el cuerpo listo para enviar.
 *
 * `allowMedia: false` (p. ej. al editar) deja fuera la foto o video.
 */
export function useMessageExtras({ excludeTaskId = null, currentUserId = null, allowMedia = true } = {}) {
  const [aportacion, setAportacion] = useState(null);
  const [tags, setTags] = useState([]);
  const [media, setMedia] = useState(null);
  const [aportacionPickerVisible, setAportacionPickerVisible] = useState(false);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);

  const reset = () => {
    setAportacion(null);
    setTags([]);
    setMedia(null);
  };

  const pickMedia = async () => {
    const asset = await pickPhotoOrVideo();
    if (asset) setMedia(asset);
  };

  const clip = (
    <CommentAttachMenu
      onPickAportacion={() => setAportacionPickerVisible(true)}
      onTag={() => setTagPickerVisible(true)}
      onPickMedia={pickMedia}
      active={Boolean(aportacion || tags.length || media)}
      mediaDisabled={!allowMedia}
    />
  );

  const preview = (aportacion || tags.length || media) ? (
    <View style={styles.preview}>
      {aportacion ? <AportacionCard info={aportacion} label="Vas a adjuntar" onRemove={() => setAportacion(null)} /> : null}
      <TagChips users={tags} onRemove={(user) => setTags((prev) => prev.filter((item) => String(item.id) !== String(user.id)))} />
      {allowMedia ? <CommentMediaChip media={media} onRemove={() => setMedia(null)} /> : null}
    </View>
  ) : null;

  const pickers = (
    <>
      <FavoriteAportacionPicker
        visible={aportacionPickerVisible}
        onClose={() => setAportacionPickerVisible(false)}
        onSelect={(picked) => {
          setAportacion(toAportacionInfo(picked));
          setAportacionPickerVisible(false);
        }}
        selectedId={aportacion?.id}
        excludeTaskId={excludeTaskId}
      />
      <UserTagPicker
        visible={tagPickerVisible}
        onClose={() => setTagPickerVisible(false)}
        selected={tags}
        onChange={setTags}
        excludeIds={currentUserId ? [currentUserId] : []}
      />
    </>
  );

  return {
    aportacion,
    tags,
    media: allowMedia ? media : null,
    hasMedia: Boolean(allowMedia && media),
    reset,
    clip,
    preview,
    pickers,
    /** `fields` del mensaje + lo adjunto: JSON, o FormData si lleva foto o video. */
    buildBody: (fields) => buildMessageBody(fields, {
      aportacion,
      tagIds: tags.map((user) => user.id),
      media: allowMedia ? media : null,
    }),
  };
}

/**
 * Lo que trae un post, respuesta o comentario: su foto o video, la publicación guardada
 * (abre la tarea) y con quién está etiquetado.
 */
export const MessageExtrasView = ({ item, navigation, compact = false }) => {
  const tagged = Array.isArray(item?.tagged_users) ? item.tagged_users : [];
  if (!item?.attachment_url && !item?.aportacion_info && !tagged.length) return null;
  return (
    <View style={styles.view}>
      <CommentAttachmentView comment={item} compact={compact} />
      {item.aportacion_info ? (
        <AportacionCard
          info={item.aportacion_info}
          label="Publicación guardada"
          onPress={() => navigation?.navigate('TaskDetail', { taskId: item.aportacion_info.id })}
          style={styles.aportacion}
        />
      ) : null}
      {tagged.length ? (
        <View style={styles.taggedRow}>
          <Ionicons name="pricetag-outline" size={13} color="#845ef7" />
          <Text style={styles.taggedLabel}>Con:</Text>
          {tagged.map((user) => (
            <TouchableUsername
              key={user.id}
              username={`@${user.username || 'usuario'}`}
              userId={user.id}
              navigation={navigation}
              textStyle={styles.taggedName}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  preview: { gap: 6, paddingHorizontal: 12, paddingTop: 6 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#e7f5ff' },
  tagChipText: { fontSize: 12, fontWeight: '700', color: '#1971c2' },
  view: { gap: 6, marginTop: 4, marginBottom: 6 },
  aportacion: { marginTop: 2 },
  taggedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  taggedLabel: { fontSize: 12, color: '#845ef7', fontWeight: '700' },
  taggedName: { fontSize: 12 },
});
