/**
 * screens/CategoryExplorerScreen.js
 *
 * Explorar categorías: cada una con su imagen y de qué trata. Se entra nivel por nivel
 * (tema → subtema); en cada categoría aparece lo más destacado y el botón para ver todas
 * sus publicaciones en el feed. Un admin edita aquí mismo la imagen y la descripción.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import { getImageUrl } from '@api';
import { useCategories, useIsAdmin, useTasks } from '@hooks/useApi';
import CategoryHeader, { findCategoryNode } from '@components/CategoryHeader';
import { categoryKey, categoryPath } from '../utils/categoryFilter';

const TOPICS = [
  { pch: 'consejos', label: 'Consejos' },
  { pch: 'peticiones', label: 'Peticiones' },
  { pch: 'historias', label: 'Historias' },
];

const isApproval = (node) => categoryKey(node?.name) === 'aprobada';
const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** Lo más destacado de la categoría (más likes de siempre). */
const CategoryHighlights = ({ pch, path, onOpenTask }) => {
  const { data: tasks = [], isLoading } = useTasks({ pch, category: path, sort_by: 'likes', page_size: 5 });

  if (isLoading) return <ActivityIndicator color="#4dabf7" style={styles.loading} />;
  if (!tasks.length) return <Text style={styles.empty}>Todavía no hay publicaciones en esta categoría.</Text>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
      {tasks.map((task) => (
        <TouchableOpacity
          key={task.id}
          style={styles.highlight}
          onPress={() => onOpenTask(task.id)}
          accessibilityLabel={`Abrir publicación ${task.title || 'sin título'}`}
        >
          <Text style={styles.highlightTitle} numberOfLines={2}>{task.title || 'Sin título'}</Text>
          <Text style={styles.highlightDescription} numberOfLines={3}>{task.description || ''}</Text>
          <View style={styles.highlightFooter}>
            <Text style={styles.highlightAuthor} numberOfLines={1}>{task.user?.username || task.username || 'Usuario'}</Text>
            <Ionicons name="heart" size={13} color="#ff6b6b" />
            <Text style={styles.highlightLikes}>{task.likes_count ?? 0}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

/** Una categoría en la cuadrícula: imagen (o un marcador), nombre y de qué trata. */
const CategoryCard = ({ node, childCount, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} accessibilityLabel={`Abrir categoría ${node.name}`}>
    {node.image_url ? (
      <Image source={{ uri: getImageUrl(node.image_url) }} style={styles.cardImage} contentFit="cover" />
    ) : (
      <View style={[styles.cardImage, styles.cardPlaceholder]}>
        <Text style={styles.cardInitial}>{String(node.name || '?').trim().charAt(0).toUpperCase()}</Text>
      </View>
    )}
    <View style={styles.cardBody}>
      <Text style={styles.cardName} numberOfLines={1}>{node.name}</Text>
      {node.description ? <Text style={styles.cardDescription} numberOfLines={2}>{node.description}</Text> : null}
      {childCount ? (
        <Text style={styles.cardMeta}>{childCount === 1 ? '1 subcategoría' : `${childCount} subcategorías`}</Text>
      ) : null}
    </View>
  </TouchableOpacity>
);

const CategoryExplorerScreen = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const [pch, setPch] = useState(route?.params?.pch || 'consejos');
  const [path, setPath] = useState(() => categoryPath(route?.params?.path));
  const { data: rawCategories = [], isLoading, isError, refetch } = useCategories(pch);
  const { data: adminInfo } = useIsAdmin();
  const isAdmin = Boolean(adminInfo?.isAdmin || adminInfo?.isStaff);

  const categories = useMemo(
    () => (Array.isArray(rawCategories) ? rawCategories : []).filter((node) => !isApproval(node)),
    [rawCategories],
  );
  const current = useMemo(() => (path.length ? findCategoryNode(categories, path) : null), [categories, path]);
  const childrenOf = (parent) => categories
    .filter((node) => (parent ? sameId(node.parent, parent.id) : node.parent == null))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const children = childrenOf(current);

  // Una ruta que no existe en este tipo de aportación (p. ej. al cambiar de tipo) vuelve al inicio.
  useEffect(() => {
    if (path.length && !isLoading && categories.length && !current) setPath([]);
  }, [path, isLoading, categories, current]);

  const choosePch = (value) => {
    if (value === pch) return;
    setPch(value);
    setPath([]);
  };

  const goBack = () => {
    if (path.length) setPath(path.slice(0, -1));
    else navigation.goBack();
  };

  // El feed de Aportaciones ya filtrado por esta categoría.
  const openFeed = () => navigation.getParent()?.navigate('Tasks', {
    screen: 'TasksList', params: { categoryPath: path.join(','), categoryPch: pch },
  });

  const onUpdated = () => queryClient.invalidateQueries({ queryKey: ['categories'] });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.title}>Explorar categorías</Text>
      </View>

      <View style={styles.topics}>
        {TOPICS.map((topic) => (
          <TouchableOpacity
            key={topic.pch}
            style={[styles.topic, pch === topic.pch && styles.topicActive]}
            onPress={() => choosePch(topic.pch)}
            accessibilityState={{ selected: pch === topic.pch }}
          >
            <Text style={[styles.topicText, pch === topic.pch && styles.topicTextActive]}>{topic.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Dónde estás: cada nivel se puede tocar para volver a él. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbs}>
          <TouchableOpacity onPress={() => setPath([])} accessibilityLabel="Todas las categorías">
            <Text style={[styles.crumb, !path.length && styles.crumbCurrent]}>Todas</Text>
          </TouchableOpacity>
          {path.map((name, index) => (
            <View key={`${name}-${index}`} style={styles.crumbItem}>
              <Ionicons name="chevron-forward" size={14} color="#adb5bd" />
              <TouchableOpacity onPress={() => setPath(path.slice(0, index + 1))} disabled={index === path.length - 1}>
                <Text style={[styles.crumb, index === path.length - 1 && styles.crumbCurrent]}>{name}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {current ? (
          <>
            <CategoryHeader
              categories={categories}
              path={path.join(',')}
              isAdmin={isAdmin}
              onUpdated={onUpdated}
              variant="hero"
              showEmpty
            >
              <TouchableOpacity style={styles.feedButton} onPress={openFeed} accessibilityLabel={`Ver publicaciones de ${current.name}`}>
                <Ionicons name="albums-outline" size={18} color="#fff" />
                <Text style={styles.feedButtonText}>Ver publicaciones</Text>
              </TouchableOpacity>
            </CategoryHeader>
            <Text style={styles.sectionTitle}>Lo más destacado</Text>
            <CategoryHighlights
              pch={pch}
              path={path.join(',')}
              onOpenTask={(taskId) => navigation.push('TaskDetail', { taskId })}
            />
          </>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color="#4dabf7" style={styles.loading} />
        ) : isError ? (
          <TouchableOpacity onPress={refetch}>
            <Text style={styles.error}>No se pudieron cargar las categorías. Toca para reintentar.</Text>
          </TouchableOpacity>
        ) : children.length ? (
          <>
            <Text style={styles.sectionTitle}>{current ? 'Subcategorías' : 'Categorías'}</Text>
            <View style={styles.grid}>
              {children.map((node) => (
                <CategoryCard
                  key={node.id}
                  node={node}
                  childCount={childrenOf(node).length}
                  onPress={() => setPath([...path, node.name])}
                />
              ))}
            </View>
          </>
        ) : !current ? (
          <Text style={styles.empty}>Todavía no hay categorías aquí.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f3f5' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8, backgroundColor: '#fff' },
  backButton: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#212529' },
  topics: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#fff' },
  topic: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 18, backgroundColor: '#f1f3f5' },
  topicActive: { backgroundColor: '#4dabf7' },
  topicText: { fontSize: 13, fontWeight: '700', color: '#495057' },
  topicTextActive: { color: '#fff' },
  content: { paddingBottom: 32 },
  breadcrumbs: { alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, gap: 4 },
  crumbItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumb: { fontSize: 13, fontWeight: '600', color: '#4dabf7' },
  crumbCurrent: { color: '#212529', fontWeight: '800' },
  feedButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingVertical: 10, borderRadius: 12, backgroundColor: '#4dabf7' },
  feedButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#212529', marginHorizontal: 14, marginTop: 16, marginBottom: 8 },
  highlights: { paddingHorizontal: 12, gap: 10 },
  highlight: { width: 200, minHeight: 118, padding: 12, borderRadius: 14, backgroundColor: '#fff', justifyContent: 'space-between' },
  highlightTitle: { fontSize: 14, fontWeight: '800', color: '#212529' },
  highlightDescription: { flex: 1, marginTop: 4, fontSize: 12, lineHeight: 17, color: '#495057' },
  highlightFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  highlightAuthor: { flex: 1, fontSize: 11, color: '#868e96' },
  highlightLikes: { fontSize: 11, fontWeight: '700', color: '#495057' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 12, rowGap: 12 },
  card: { width: '48.5%', borderRadius: 14, backgroundColor: '#fff', overflow: 'hidden' },
  cardImage: { width: '100%', height: 104, backgroundColor: '#e7f5ff' },
  cardPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  cardInitial: { fontSize: 36, fontWeight: '900', color: '#74c0fc' },
  cardBody: { padding: 10, gap: 3 },
  cardName: { fontSize: 14, fontWeight: '800', color: '#212529' },
  cardDescription: { fontSize: 12, lineHeight: 16, color: '#495057' },
  cardMeta: { fontSize: 11, fontWeight: '700', color: '#4dabf7' },
  loading: { marginVertical: 24 },
  empty: { marginHorizontal: 14, marginVertical: 12, fontSize: 13, color: '#868e96' },
  error: { marginHorizontal: 14, marginVertical: 12, fontSize: 13, color: '#c92a2a' },
});

export default CategoryExplorerScreen;
