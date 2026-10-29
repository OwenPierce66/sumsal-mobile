import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import api, { getImageUrl, UPLOAD_TIMEOUT_MS } from '@api';
import { useMe } from '@hooks/useApi';
import TouchableUsername from './TouchableUsername';
import FollowHeart from './FollowHeart';
import ContentActionsButton from './ContentActionsMenu';
import LinkifiedText from './LinkifiedText';
import AportacionCard from './AportacionCard';
import FavoriteAportacionPicker from './FavoriteAportacionPicker';
import UserTagPicker from './UserTagPicker';
import { CommentAttachMenu, CommentMediaChip, CommentAttachmentView } from './CommentAttachments';
import { pickTopComment } from '../utils/topComment';
import { buildCommentBody } from '../utils/commentAportacion';
import { toAportacionInfo } from '../utils/aportaciones';
import { pickPhotoOrVideo } from '../utils/mediaUpload';

const authorOf = (comment) => comment?.created_by || comment?.user || {};
const nameOf = (user) => user?.username || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Usuario';
const avatarOf = (user) => getImageUrl(user?.user_image) || `https://ui-avatars.com/api/?name=${encodeURIComponent(nameOf(user))}`;

const confirmDelete = (onConfirm) => {
  const message = '¿Eliminar este comentario de forma permanente?';
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Eliminar comentario', message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Eliminar', style: 'destructive', onPress: onConfirm },
  ]);
};

/**
 * Bajo una publicación del feed: el comentario con más interacción y su mejor respuesta,
 * con me gusta y responder ahí mismo, como en otras redes. El campo para escribir aparece
 * al tocar "Responder", con el clip para adjuntar una publicación guardada, etiquetar o
 * poner una foto o video. Lo que respondes aparece al instante; "Ver los N comentarios"
 * abre el detalle con todos.
 *
 * `onCountChange(delta)`: avisa a la tarjeta para que el contador de comentarios cambie.
 */
const TopCommentPreview = ({ task, navigation, onOpenComments, onCountChange }) => {
  const { data: me } = useMe();
  const inputRef = useRef(null);
  const [likes, setLikes] = useState({});
  const [addedReplies, setAddedReplies] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  // Lo que acompaña la respuesta (clip): publicación guardada, etiquetas y foto o video.
  const [aportacion, setAportacion] = useState(null);
  const [tags, setTags] = useState([]);
  const [media, setMedia] = useState(null);
  const [aportacionPickerVisible, setAportacionPickerVisible] = useState(false);
  const [tagPickerVisible, setTagPickerVisible] = useState(false);

  // Cuando la tarea llega de nuevo del servidor, lo agregado aquí ya viene incluido.
  useEffect(() => {
    setLikes({});
    setAddedReplies([]);
    setRemoved([]);
  }, [task.comments]);

  const { comment: top, reply: topReply } = useMemo(() => pickTopComment(task.comments), [task.comments]);
  const totalComments = task.comments_count || 0;
  const isGone = (comment) => removed.includes(comment.id);

  const likeState = (comment) => likes[comment.id] || { liked: Boolean(comment.user_has_liked), count: comment.likes_count || 0 };

  const toggleLike = async (comment) => {
    const current = likeState(comment);
    const optimistic = { liked: !current.liked, count: Math.max(0, current.count + (current.liked ? -1 : 1)) };
    setLikes((prev) => ({ ...prev, [comment.id]: optimistic }));
    try {
      const { data } = await api.post(`comments/${comment.id}/like/`);
      setLikes((prev) => ({ ...prev, [comment.id]: { liked: Boolean(data?.liked), count: data?.likes_count ?? optimistic.count } }));
    } catch {
      setLikes((prev) => ({ ...prev, [comment.id]: current }));
    }
  };

  const startReply = (comment) => {
    setReplyTo(comment);
    setTimeout(() => inputRef.current?.focus?.(), 0);
  };

  const closeComposer = () => {
    setReplyTo(null);
    setText('');
    setAportacion(null);
    setTags([]);
    setMedia(null);
  };

  const pickMedia = async () => {
    const asset = await pickPhotoOrVideo();
    if (asset) setMedia(asset);
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && !media) || sending || !replyTo) return;
    setSending(true);
    try {
      const payload = await buildCommentBody({
        text: body, replyingTo: replyTo, aportacion, tagIds: tags.map((user) => user.id), media,
      });
      const { data } = media
        ? await api.post(`tasks/${task.id}/comments/`, payload, { timeout: UPLOAD_TIMEOUT_MS })
        : await api.post(`tasks/${task.id}/comments/`, payload);
      const created = { ...data, created_by: data?.created_by || me, children: [], likes_count: 0, user_has_liked: false };
      setAddedReplies((prev) => [...prev, created]);
      closeComposer();
      onCountChange?.(1);
    } catch (error) {
      const data = error.response?.data;
      Alert.alert('Error', [data?.text, data?.detail].flat().find((value) => typeof value === 'string') || 'No se pudo publicar el comentario');
    } finally {
      setSending(false);
    }
  };

  const remove = (comment) => confirmDelete(async () => {
    setRemoved((prev) => [...prev, comment.id]);
    try {
      await api.delete(`comments/${comment.id}/`);
      onCountChange?.(-1);
    } catch {
      setRemoved((prev) => prev.filter((id) => id !== comment.id));
      Alert.alert('Error', 'No se pudo eliminar el comentario.');
    }
  });

  const renderComment = (comment, { isReply = false } = {}) => {
    const author = authorOf(comment);
    const like = likeState(comment);
    const mine = Boolean(me?.id) && String(author.id) === String(me.id);
    return (
      <View key={comment.id} style={[styles.row, isReply && styles.replyRow]}>
        <Image source={{ uri: avatarOf(author) }} style={isReply ? styles.avatarSmall : styles.avatar} />
        <View style={styles.body}>
          <View style={styles.bubble}>
            <View style={styles.bubbleHeader}>
              <TouchableUsername
                username={nameOf(author)}
                userId={author.id}
                userImage={getImageUrl(author.user_image)}
                navigation={navigation}
                style={styles.authorWrap}
                textStyle={styles.author}
              />
              <FollowHeart userId={author.id} username={nameOf(author)} size={15} style={styles.heart} />
              <ContentActionsButton
                accessibilityLabel="Más opciones del comentario"
                size={15}
                author={author}
                currentUserId={me?.id}
                navigation={navigation}
                report={{ targetType: 'comment', targetId: comment.id }}
                onReply={() => startReply(comment)}
                {...(mine ? { onDelete: () => remove(comment), deleteLabel: 'Eliminar comentario' } : {})}
              />
            </View>
            {comment.text ? <LinkifiedText style={styles.text} text={comment.text} collapsedLines={3} /> : null}
            <CommentAttachmentView comment={comment} compact />
            {comment.aportacion_info?.title ? (
              <Text style={styles.attached} numberOfLines={1}>
                <Ionicons name="bookmark" size={11} color="#7048e8" /> {comment.aportacion_info.title}
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Text style={styles.time}>{comment.created_at ? moment(comment.created_at).fromNow() : 'Ahora'}</Text>
            <TouchableOpacity
              style={styles.likeButton}
              onPress={() => toggleLike(comment)}
              accessibilityRole="button"
              accessibilityLabel={like.liked ? 'Quitar me gusta del comentario' : 'Me gusta el comentario'}
            >
              <Ionicons name={like.liked ? 'heart' : 'heart-outline'} size={14} color={like.liked ? '#ff6b6b' : '#868e96'} />
              {like.count ? <Text style={[styles.action, like.liked && styles.actionLiked]}>{like.count}</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => startReply(comment)} accessibilityRole="button" accessibilityLabel={`Responder a ${nameOf(author)}`}>
              <Text style={styles.action}>Responder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const shownCount = (top ? 1 : 0) + (topReply ? 1 : 0);
  // Sin comentarios no hay nada que mostrar: para comentar se abre la publicación.
  if (!top && !addedReplies.length) return null;

  return (
    <View style={styles.container}>
      {totalComments > shownCount ? (
        <TouchableOpacity onPress={onOpenComments} accessibilityRole="button">
          <Text style={styles.seeAll}>Ver los {totalComments} comentarios</Text>
        </TouchableOpacity>
      ) : null}

      {top && !isGone(top) ? renderComment(top) : null}
      {top && !isGone(top) && topReply && !isGone(topReply) ? renderComment(topReply, { isReply: true }) : null}
      {addedReplies.filter((comment) => !isGone(comment)).map((comment) => renderComment(comment, { isReply: true }))}

      {replyTo ? (
        <>
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText} numberOfLines={1}>Respondiendo a @{nameOf(authorOf(replyTo))}</Text>
            <TouchableOpacity onPress={closeComposer} accessibilityLabel="Cancelar respuesta" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={16} color="#868e96" />
            </TouchableOpacity>
          </View>
          {aportacion ? <AportacionCard info={aportacion} label="Vas a adjuntar" onRemove={() => setAportacion(null)} /> : null}
          {tags.length ? (
            <View style={styles.tagsRow}>
              {tags.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.tagChip}
                  onPress={() => setTags((prev) => prev.filter((item) => String(item.id) !== String(user.id)))}
                  accessibilityLabel={`Quitar etiqueta @${user.username}`}
                >
                  <Text style={styles.tagChipText}>@{user.username}</Text>
                  <Ionicons name="close" size={12} color="#1971c2" />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <CommentMediaChip media={media} onRemove={() => setMedia(null)} />
          <View style={styles.composer}>
            <CommentAttachMenu
              onPickAportacion={() => setAportacionPickerVisible(true)}
              onTag={() => setTagPickerVisible(true)}
              onPickMedia={pickMedia}
              active={Boolean(aportacion || tags.length || media)}
            />
            <TextInput
              ref={inputRef}
              style={styles.input}
              // En la web un campo de varias líneas arranca con 2 renglones: se deja en uno, como los íconos.
              numberOfLines={Platform.OS === 'web' ? 1 : undefined}
              value={text}
              onChangeText={setText}
              placeholder="Escribe tu respuesta…"
              placeholderTextColor="#adb5bd"
              multiline
              accessibilityLabel="Escribe tu respuesta"
            />
            <TouchableOpacity
              onPress={send}
              disabled={(!text.trim() && !media) || sending}
              accessibilityRole="button"
              accessibilityLabel="Enviar respuesta"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {sending
                ? <ActivityIndicator size="small" color="#4dabf7" />
                : <Ionicons name="send" size={18} color={text.trim() || media ? '#4dabf7' : '#ced4da'} />}
            </TouchableOpacity>
          </View>
          <FavoriteAportacionPicker
            visible={aportacionPickerVisible}
            onClose={() => setAportacionPickerVisible(false)}
            onSelect={(picked) => {
              setAportacion(toAportacionInfo(picked));
              setAportacionPickerVisible(false);
            }}
            selectedId={aportacion?.id}
            excludeTaskId={task.id}
          />
          <UserTagPicker
            visible={tagPickerVisible}
            onClose={() => setTagPickerVisible(false)}
            selected={tags}
            onChange={setTags}
            excludeIds={me?.id ? [me.id] : []}
          />
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 10, gap: 8 },
  seeAll: { color: '#868e96', fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 8 },
  replyRow: { marginLeft: 40 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eee' },
  avatarSmall: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#eee' },
  body: { flex: 1, minWidth: 0 },
  bubble: { backgroundColor: '#f1f3f5', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center' },
  authorWrap: { flexShrink: 1 },
  author: { fontSize: 13, fontWeight: '700' },
  heart: { marginLeft: 'auto', marginRight: 4 },
  text: { fontSize: 14, color: '#333', marginTop: 2 },
  attached: { marginTop: 4, fontSize: 12, color: '#7048e8', fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 3, marginLeft: 10 },
  time: { fontSize: 12, color: '#adb5bd' },
  likeButton: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  action: { fontSize: 12, color: '#868e96', fontWeight: '700' },
  actionLiked: { color: '#ff6b6b' },
  replyingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  replyingText: { flex: 1, fontSize: 12, color: '#4dabf7', fontWeight: '600' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#e7f5ff' },
  tagChipText: { fontSize: 12, fontWeight: '700', color: '#1971c2' },
  composer: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#e9ecef', borderRadius: 20, paddingHorizontal: 4, paddingVertical: 2,
  },
  // Del alto del clip (36); crece si escribes varias líneas.
  input: { flex: 1, minHeight: 36, maxHeight: 90, fontSize: 14, color: '#333', paddingVertical: 8 },
});

export default TopCommentPreview;
