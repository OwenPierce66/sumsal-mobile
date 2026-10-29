import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTasks } from '@hooks/useApi';

const TOPICS = [
  { pch: 'consejos', title: 'Consejos' },
  { pch: 'peticiones', title: 'Peticiones' },
  { pch: 'historias', title: 'Historias' },
];

const PERIOD_LABELS = {
  top_day: 'Más likes en las últimas 24 horas',
  top_week: 'Más likes en los últimos 7 días',
  top_month: 'Más likes en los últimos 30 días',
};

const TopicSection = ({ topic, navigation, onSelectTopic, sortBy }) => {
  const { data: tasks = [], isLoading, isError, refetch } = useTasks({
    pch: topic.pch,
    sort_by: sortBy,
    page_size: 5,
  });

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Top de {topic.title}</Text>
          <Text style={styles.sectionSubtitle}>{PERIOD_LABELS[sortBy] || PERIOD_LABELS.top_month}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onSelectTopic(topic.pch)}
          accessibilityRole="button"
          accessibilityLabel={`Ver todas las publicaciones de ${topic.title}`}
        >
          <Ionicons name="arrow-forward-circle-outline" size={25} color="#4dabf7" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#4dabf7" style={styles.loading} />
      ) : isError ? (
        <TouchableOpacity onPress={refetch} style={styles.message}>
          <Text style={styles.errorText}>No se pudo cargar. Toca para reintentar.</Text>
        </TouchableOpacity>
      ) : tasks.length === 0 ? (
        <Text style={styles.message}>Todavía no hay publicaciones en este top.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
          {tasks.map(task => (
            <TouchableOpacity
              key={task.id}
              style={styles.card}
              onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Abrir publicación ${task.title || 'sin título'}`}
            >
              <Text style={styles.cardTitle} numberOfLines={2}>
                {task.title || 'Sin título'}
              </Text>
              <Text style={styles.cardDescription} numberOfLines={3}>
                {task.description || 'Sin descripción'}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.author} numberOfLines={1}>
                  {task.user?.username || task.username || 'Usuario'}
                </Text>
                <View style={styles.likes}>
                  <Ionicons name="heart" size={14} color="#ff6b6b" />
                  <Text style={styles.likeCount}>{task.period_likes_count ?? 0}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

// `sortBy`: periodo del top (top_day, top_week o top_month).
const TopicTopSections = ({ navigation, onSelectTopic, sortBy = 'top_month' }) => (
  <View style={styles.container}>
    {TOPICS.map(topic => (
      <TopicSection
        key={topic.pch}
        topic={topic}
        navigation={navigation}
        onSelectTopic={onSelectTopic}
        sortBy={sortBy}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  container: { paddingTop: 14, paddingBottom: 4 },
  section: { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 9 },
  sectionTitle: { color: '#212529', fontSize: 16, fontWeight: '800' },
  sectionSubtitle: { color: '#868e96', fontSize: 11, marginTop: 2 },
  loading: { height: 76 },
  message: { color: '#868e96', fontSize: 12, marginHorizontal: 16, paddingVertical: 16 },
  errorText: { color: '#c92a2a', fontSize: 12 },
  cards: { paddingHorizontal: 16, gap: 10 },
  card: { width: 210, minHeight: 126, justifyContent: 'space-between', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#e9ecef', backgroundColor: '#fff' },
  cardTitle: { color: '#212529', fontSize: 14, fontWeight: '800' },
  cardDescription: { color: '#495057', fontSize: 12, lineHeight: 17, marginTop: 6, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  author: { color: '#868e96', fontSize: 11, flex: 1 },
  likes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeCount: { color: '#495057', fontSize: 11, fontWeight: '700' },
});

export default TopicTopSections;
