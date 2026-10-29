import React, { useState } from 'react';
import { Text, Modal, View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';
import { useMyRelations } from '../hooks/useMyRelations';

// Color del corazón según la relación (solo se pinta el contorno).
const HEART_COLORS = {
  none: '#adb5bd',
  following: '#297fce',
  favorite: '#000000',
  pinned: '#845ef7',
};

const ACCESSIBILITY_LABELS = {
  none: (name) => `Seguir a ${name}`,
  following: (name) => `Agregar a ${name} a favoritos`,
  favorite: () => 'Opciones de seguimiento',
  pinned: () => 'Opciones de seguimiento',
};

/**
 * Corazón para seguir un perfil. Cada toque sube un nivel: seguir → favorito;
 * ya en favoritos (o anclado) abre el menú para anclar, quitar o dejar de seguir.
 * Mantenerlo presionado abre el menú en cualquier nivel.
 *
 * Va separado del nombre, al otro extremo de la fila (junto al menú de 3 puntos si lo hay).
 * `iconStyle`: estilo extra del ícono (p. ej. un brillo para verse sobre un video).
 */
const FollowHeart = ({ userId, username, size = 20, style, iconStyle, onChange }) => {
  const [relationMenuVisible, setRelationMenuVisible] = useState(false);
  const { ready: relationsReady, getState, setStateLocally, refresh: refreshRelations } = useMyRelations();
  const relationState = relationsReady && userId ? getState(userId) : null;
  // Sin corazón solo en el propio perfil (o mientras cargan las relaciones).
  const showHeart = !!relationState;

  const runRelationAction = async (nextState, request) => {
    setRelationMenuVisible(false);
    setStateLocally(userId, nextState);
    try {
      await request();
      onChange?.();
    } catch (error) {
      refreshRelations();
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo completar la acción');
    }
  };

  const handleFollow = () => runRelationAction('following', () => api.post(`users/${userId}/follow/`));
  const handleAddFavorite = () => runRelationAction('favorite', () => api.post('pfavoritos/agregar/', { perfil_id: userId }));
  const handlePinToggle = () => runRelationAction(
    relationState === 'pinned' ? 'favorite' : 'pinned',
    () => api.post('favorites/pin/', {
      type: 'profile',
      target_id: userId,
      is_pinned: relationState !== 'pinned',
    }),
  );
  const handleRemoveFavorite = () => runRelationAction(
    'following',
    () => api.post('pfavoritos/agregar/', { perfil_id: userId }),
  );
  // Dejar de seguir quita todo: favorito y lugar en el top 5.
  const handleUnfollow = () => runRelationAction(
    'none',
    () => api.delete(`users/${userId}/follow/`),
  );

  const handleHeartPress = () => {
    if (!userId) return;
    if (relationState === 'none') handleFollow();
    else if (relationState === 'following') handleAddFavorite();
    else setRelationMenuVisible(true);
  };
  const handleLongPress = () => {
    if (userId && relationState !== 'none') setRelationMenuVisible(true);
  };

  if (!showHeart) return null;

  const icon = <Ionicons name="heart-outline" size={size} color={HEART_COLORS[relationState]} style={iconStyle} />;
  const accessibilityLabel = ACCESSIBILITY_LABELS[relationState](username || 'este perfil');

  return (
    <>
      <TouchableOpacity
        onPress={handleHeartPress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        style={[styles.button, style]}
        hitSlop={8}
        accessibilityLabel={accessibilityLabel}
      >
        {icon}
      </TouchableOpacity>

      <Modal
        visible={relationMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRelationMenuVisible(false)}
      >
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setRelationMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuUsername}>{username || 'Usuario'}</Text>
              <Ionicons name="heart-outline" size={22} color={HEART_COLORS[relationState] || '#333'} />
            </View>

            <TouchableOpacity style={styles.menuOption} onPress={handlePinToggle}>
              <Ionicons name="pin-outline" size={20} color="#845ef7" />
              <Text style={styles.menuOptionText}>
                {relationState === 'pinned' ? 'Quitar del top 5' : 'Anclar en mi top 5'}
              </Text>
            </TouchableOpacity>

            {relationState === 'following' ? (
              <TouchableOpacity style={styles.menuOption} onPress={handleAddFavorite}>
                <Ionicons name="star-outline" size={20} color="#333" />
                <Text style={styles.menuOptionText}>Agregar a favoritos</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.menuOption} onPress={handleRemoveFavorite}>
                <Ionicons name="star-outline" size={20} color="#333" />
                <Text style={styles.menuOptionText}>Quitar de favoritos</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.menuOption, styles.menuOptionDanger]} onPress={handleUnfollow}>
              <Ionicons name="person-remove-outline" size={20} color="#d32f2f" />
              <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>Dejar de seguir</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancel} onPress={() => setRelationMenuVisible(false)}>
              <Text style={styles.menuCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: { padding: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  menuContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 30 },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuUsername: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuOptionText: { marginLeft: 12, fontSize: 14, color: '#333', fontWeight: '500' },
  menuOptionDanger: { backgroundColor: '#ffebee' },
  menuOptionTextDanger: { color: '#d32f2f' },
  menuCancel: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  menuCancelText: { fontSize: 14, color: 'red', fontWeight: '600' },
});

export default FollowHeart;
