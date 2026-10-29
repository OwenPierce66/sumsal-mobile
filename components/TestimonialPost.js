import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import api, { getImageUrl } from '@api';
import TouchableUsername from './TouchableUsername';
import FollowHeart from './FollowHeart';
import TieredLikesModal from '../screens/TieredLikesModal';

/**
 * Un testimonio escrito en un perfil (es una publicación, pch "testimonios"), con el estilo
 * de los testimonios: quién lo escribió y su cita. Una vez aprobado tiene like, comentarios
 * y compartir en mi historia; el menú de 3 puntos es el de cualquier publicación.
 * Arriba, su estado: la persona del perfil (`isOwner`) decide si lo muestra; quien lo
 * escribió (`isMine`) ve si sigue esperando.
 */
const TestimonialPost = ({ testimonial, navigation, isOwner = false, isMine = false, onAnswer, onOpenActions }) => {
  const [task, setTask] = useState(testimonial);
  useEffect(() => { setTask(testimonial); }, [testimonial]);
  const [likesVisible, setLikesVisible] = useState(false);
  const busyRef = useRef(new Set());

  const author = task.user || {};
  const avatar = getImageUrl(author.user_image || author.image);
  const status = testimonial.status;
  const isPending = status === 'pending';
  const isApproved = status === 'approved';

  const once = async (key, work) => {
    if (busyRef.current.has(key)) return;
    busyRef.current.add(key);
    try { await work(); } finally { busyRef.current.delete(key); }
  };
  const patch = (changes) => setTask((previous) => ({ ...previous, ...changes }));

  const like = () => once('like', async () => {
    const before = { user_has_liked: Boolean(task.user_has_liked), likes_count: task.likes_count || 0 };
    patch({ user_has_liked: !before.user_has_liked, likes_count: Math.max(0, before.likes_count + (before.user_has_liked ? -1 : 1)) });
    try {
      const { data } = await api.post(`tasks/${task.id}/like/`);
      patch({ user_has_liked: Boolean(data.liked), likes_count: data.likes_count ?? before.likes_count });
    } catch {
      patch(before);
    }
  });

  const shareToStory = () => once('story', async () => {
    try {
      await api.post('stories/share-task/', { task_id: task.id });
      Alert.alert('Listo', 'Se compartió en tu historia de 24 horas.');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo compartir en tu historia.');
    }
  });

  const openDetail = () => navigation?.push?.('TaskDetail', { taskId: task.id });

  return (
    <View style={[styles.card, isPending && styles.cardPending]}>
      {isPending && isOwner ? (
        <View style={styles.statusRow}>
          <Ionicons name="time-outline" size={14} color="#845ef7" />
          <Text style={styles.statusText}>Pendiente: solo tú lo ves hasta que lo apruebes</Text>
        </View>
      ) : null}
      {isMine && !isApproved ? (
        <View style={styles.statusRow}>
          <Ionicons name={isPending ? 'time-outline' : 'eye-off-outline'} size={14} color="#845ef7" />
          <Text style={styles.statusText}>
            {isPending ? 'Esperando a que lo apruebe para mostrarlo en su perfil' : 'No lo muestra en su perfil'}
          </Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Image source={{ uri: avatar || 'https://ui-avatars.com/api/?name=Usuario' }} style={styles.avatar} />
        <View style={styles.headerText}>
          <TouchableUsername
            username={author.username || 'Usuario'}
            userId={author.id}
            userImage={avatar}
            navigation={navigation}
            textStyle={styles.author}
          />
          <Text style={styles.date}>{moment(task.created_at).locale('es').fromNow()}</Text>
        </View>
        <Ionicons name="chatbox-ellipses" size={18} color="#845ef7" />
        <FollowHeart userId={author.id} username={author.username} size={18} />
        {onOpenActions ? (
          <TouchableOpacity onPress={() => onOpenActions(task)} accessibilityLabel="Más opciones del testimonio">
            <Ionicons name="ellipsis-vertical" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      <TouchableOpacity activeOpacity={0.8} onPress={openDetail} accessibilityLabel="Abrir testimonio">
        {task.title ? <Text style={styles.title}>{task.title}</Text> : null}
        {task.description ? <Text style={styles.text}>“{task.description}”</Text> : null}
      </TouchableOpacity>

      {isApproved ? (
        <View style={styles.footer}>
          <View style={styles.stat}>
            <TouchableOpacity onPress={like} accessibilityLabel={task.user_has_liked ? 'Quitar me gusta' : 'Me gusta'}>
              <Ionicons name={task.user_has_liked ? 'heart' : 'heart-outline'} size={18} color={task.user_has_liked ? '#ff6b6b' : '#999'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setLikesVisible(true)} style={styles.count} accessibilityLabel="Ver a quién le gusta">
              <Text style={styles.statText}>{task.likes_count ?? 0}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.stat} onPress={openDetail} accessibilityLabel="Comentarios">
            <Ionicons name="chatbubble-outline" size={18} color="#4dabf7" />
            <Text style={styles.statText}>{task.comments_count || 0}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stat} onPress={shareToStory} accessibilityLabel="Compartir en mi historia">
            <Ionicons name="add-circle-outline" size={18} color="#845ef7" />
            <Text style={styles.statText}>Mi historia</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isOwner ? (
        <View style={styles.actions}>
          {isPending ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.approve]}
                onPress={() => onAnswer?.(testimonial, 'approved')}
                accessibilityRole="button"
              >
                <Text style={styles.approveText}>Mostrar en mi perfil</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={() => onAnswer?.(testimonial, 'rejected')} accessibilityRole="button">
                <Text style={styles.buttonText}>No mostrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.button} onPress={() => onAnswer?.(testimonial, 'rejected')} accessibilityRole="button">
              <Text style={styles.buttonText}>Quitar de mi perfil</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <TieredLikesModal
        visible={likesVisible}
        onClose={() => setLikesVisible(false)}
        apiUrl={`tasks/${task.id}/users-who-liked/`}
        title="Le gusta a"
        navigation={navigation}
      />
    </View>
  );
};

// Mismo estilo que TestimonialCard (los testimonios que vienen de comentarios).
const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 12, borderRadius: 16, padding: 14, elevation: 2 },
  cardPending: { borderWidth: 1, borderColor: '#e5dbff', backgroundColor: '#fbfaff' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  statusText: { flexShrink: 1, fontSize: 12, fontWeight: '700', color: '#845ef7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee' },
  headerText: { flex: 1 },
  author: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11, color: '#999', marginTop: 2 },
  title: { fontSize: 15, fontWeight: '700', color: '#343a40', marginBottom: 4 },
  text: { fontSize: 15, lineHeight: 21, color: '#343a40', fontStyle: 'italic' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f3f5' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  count: { paddingHorizontal: 2 },
  statText: { fontSize: 13, color: '#666', fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: '#f1f3f5' },
  buttonText: { color: '#495057', fontSize: 12, fontWeight: '700' },
  approve: { backgroundColor: '#845ef7' },
  approveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

export default TestimonialPost;
