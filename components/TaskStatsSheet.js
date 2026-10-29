import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@api';

const PUBLIC_ROWS = [
  ['likes', 'heart', '#ff6b6b', 'Me gusta'],
  ['comments', 'chatbubble', '#4dabf7', 'Comentarios'],
  ['reposts', 'trending-up', '#f59f00', 'Impulsos'],
  ['shares', 'share-social', '#51cf66', 'Compartidas'],
];
const PRIVATE_ROWS = [
  ['saves', 'bookmark', '#f59f00', 'La guardaron'],
  ['favorites', 'star', '#f59f00', 'La tienen en favoritos'],
  ['pinned', 'pin', '#845ef7', 'En su top 5'],
  ['category_pins', 'pricetags', '#845ef7', 'En un top 5 por categoría'],
  ['story_shares', 'albums', '#51cf66', 'La compartieron en su historia'],
];

/**
 * Estadísticas de una publicación (menú de 3 puntos). Todos ven los números públicos y
 * cuántas veces la citaron; su creador ve además quién la guardó, la puso en favoritos,
 * la ancló o la compartió en su historia.
 */
const TaskStatsSheet = ({ visible, taskId, onClose }) => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible || !taskId) return undefined;
    let active = true;
    setStats(null);
    setError(false);
    api.get(`tasks/${taskId}/stats/`)
      .then((response) => { if (active) setStats(response.data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [visible, taskId]);

  const row = ([key, icon, color, label], value) => (
    <View key={key} style={styles.row}>
      <Ionicons name={icon} size={18} color={color} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? 0}</Text>
    </View>
  );

  const citations = stats?.public?.citations;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Estadísticas</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          {error ? (
            <Text style={styles.muted}>No se pudieron cargar las estadísticas.</Text>
          ) : !stats ? (
            <ActivityIndicator style={styles.loader} color="#4dabf7" />
          ) : (
            <>
              {PUBLIC_ROWS.map((entry) => row(entry, stats.public?.[entry[0]]))}
              {row(['citations', 'attach', '#495057', 'Citada en comentarios'], citations?.total)}
              {citations?.total ? (
                <Text style={styles.breakdown}>
                  {[
                    citations.comments ? `${citations.comments} en aportaciones` : null,
                    citations.forum ? `${citations.forum} en el foro` : null,
                    citations.shared_comments ? `${citations.shared_comments} en compartidas` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              ) : null}

              {stats.private ? (
                <>
                  <Text style={styles.section}>Solo tú ves esto</Text>
                  {PRIVATE_ROWS.map((entry) => row(entry, stats.private[entry[0]]))}
                </>
              ) : null}
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18, paddingBottom: Platform.OS === 'ios' ? 36 : 22,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '800', color: '#222' },
  loader: { marginVertical: 24 },
  muted: { color: '#868e96', marginVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  rowIcon: { width: 28 },
  rowLabel: { flex: 1, color: '#343a40', fontSize: 15 },
  rowValue: { color: '#212529', fontSize: 16, fontWeight: '800' },
  breakdown: { color: '#868e96', fontSize: 12, marginTop: 4, marginLeft: 28 },
  section: { color: '#5f3dc4', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginTop: 16, marginBottom: 2 },
});

export default TaskStatsSheet;
