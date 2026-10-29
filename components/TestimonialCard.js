import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import moment from 'moment';
import 'moment/locale/es';
import { getImageUrl } from '@api';
import TouchableUsername from './TouchableUsername';
import FollowHeart from './FollowHeart';
import ContentActionsButton from './ContentActionsMenu';

/**
 * Un testimonio que viene de un comentario donde etiquetaron a la persona del perfil
 * (los escritos en el perfil son publicaciones: ver TestimonialPost).
 * Su dueño ve también los pendientes y decide si se muestran.
 */
const TestimonialCard = ({ testimonial, navigation, isOwner = false, onAnswer, currentUserId }) => {
  const { author = {}, comment = {}, status } = testimonial;
  const task = testimonial.task || {};
  const avatar = getImageUrl(author.image || author.user_image);
  const isPending = status === 'pending';

  return (
    <View style={[styles.card, isPending && styles.cardPending]}>
      {isPending ? (
        <View style={styles.pendingRow}>
          <Ionicons name="time-outline" size={14} color="#845ef7" />
          <Text style={styles.pendingText}>Pendiente: solo tú lo ves hasta que lo apruebes</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Image
          source={{ uri: avatar || 'https://ui-avatars.com/api/?name=Usuario' }}
          style={styles.avatar}
        />
        <View style={styles.headerText}>
          <TouchableUsername
            username={author.username || 'Usuario'}
            userId={author.id}
            userImage={avatar}
            navigation={navigation}
            textStyle={styles.author}
          />
          <Text style={styles.date}>{moment(testimonial.created_at).locale('es').fromNow()}</Text>
        </View>
        <Ionicons name="chatbox-ellipses" size={18} color="#845ef7" />
        <FollowHeart userId={author.id} username={author.username} size={18} />
        <ContentActionsButton
          accessibilityLabel="Más opciones del testimonio"
          author={author}
          currentUserId={currentUserId}
          navigation={navigation}
          report={{ targetType: 'comment', targetId: comment.id }}
        />
      </View>

      <Text style={styles.text}>“{comment.text}”</Text>

      {task.id ? (
        <TouchableOpacity
          onPress={() => navigation?.push?.('TaskDetail', { taskId: task.id })}
          accessibilityRole="link"
          accessibilityLabel={`Abrir aportación ${task.title || ''}`}
        >
          <Text style={styles.source} numberOfLines={1}>
            en <Text style={styles.sourceTitle}>{task.title || 'una aportación'}</Text>
          </Text>
        </TouchableOpacity>
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
              <TouchableOpacity
                style={styles.button}
                onPress={() => onAnswer?.(testimonial, 'rejected')}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>No mostrar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.button}
              onPress={() => onAnswer?.(testimonial, 'rejected')}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Quitar de mi perfil</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 12, borderRadius: 16, padding: 14, elevation: 2 },
  cardPending: { borderWidth: 1, borderColor: '#e5dbff', backgroundColor: '#fbfaff' },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  pendingText: { fontSize: 12, fontWeight: '700', color: '#845ef7' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eee' },
  headerText: { flex: 1 },
  author: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11, color: '#999', marginTop: 2 },
  text: { fontSize: 15, lineHeight: 21, color: '#343a40', fontStyle: 'italic' },
  source: { marginTop: 8, fontSize: 12, color: '#868e96' },
  sourceTitle: { color: '#1971c2', fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  button: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: '#f1f3f5' },
  buttonText: { color: '#495057', fontSize: 12, fontWeight: '700' },
  approve: { backgroundColor: '#845ef7' },
  approveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});

export default TestimonialCard;
