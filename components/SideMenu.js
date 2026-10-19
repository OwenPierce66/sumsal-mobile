import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SideMenu = ({ navigation, signOut, user, buttonStyle }) => {
  const [visible, setVisible] = useState(false);
  let tabNavigation = navigation;
  while (tabNavigation?.getState?.()?.type !== 'tab' && tabNavigation?.getParent) {
    tabNavigation = tabNavigation.getParent();
  }

  const navigate = (routeName, params) => {
    setVisible(false);
    if (tabNavigation?.getState?.()?.routeNames?.includes(routeName)) {
      tabNavigation.navigate(routeName, params);
    }
  };

  const openTaskMenu = paramName => {
    navigate('Tasks', {
      screen: 'TasksList',
      params: { [paramName]: true },
    });
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.menuButton, buttonStyle]}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Abrir menú lateral"
      >
        <Ionicons name="menu-outline" size={28} color="#333" />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setVisible(false)}
            accessibilityLabel="Cerrar menú lateral"
          />
          <View style={styles.panel}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Sumsal</Text>
                <Text style={styles.subtitle}>
                  {user?.first_name || user?.username || 'Tu comunidad'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setVisible(false)}
                accessibilityLabel="Cerrar menú"
              >
                <Ionicons name="close" size={25} color="#555" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.options} showsVerticalScrollIndicator={false}>
              {[
                ['home-outline', 'Inicio', () => navigate('Tasks')],
                ['list-outline', 'Tareas', () => navigate('HomeTab')],
                ['videocam-outline', 'Reels', () => navigate('Reels')],
                ['chatbubbles-outline', 'Mensajes directos', () => navigate('Messages')],
                ['notifications-outline', 'Notificaciones', () => navigate('Notifications')],
                ['person-outline', 'Perfil', () => navigate('Profile')],
                ['time-outline', 'Historias', () => navigate('Stories')],
                ['share-outline', 'Compartidas', () => navigate('SharedTasks')],
                ['chatbox-outline', 'Foro', () => navigate('Forum')],
                ['bookmarks-outline', 'Filtros guardados', () => openTaskMenu('openSavedFilters')],
                ['eye-outline', 'Visibilidad de favoritos', () => openTaskMenu('openFavoriteVisibility')],
                ...(user?.is_staff || user?.is_superuser
                  ? [['shield-checkmark-outline', 'Administración', () => navigate('Profile', { screen: 'AdminCenter' })]]
                  : []),
              ].map(([icon, label, onPress]) => (
                <TouchableOpacity
                  key={label}
                  style={styles.item}
                  onPress={onPress}
                >
                  <Ionicons name={icon} size={21} color="#4dabf7" />
                  <Text style={styles.itemText}>{label}</Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[styles.item, styles.logout]}
                onPress={() => {
                  setVisible(false);
                  signOut?.();
                }}
              >
                <Ionicons name="log-out-outline" size={21} color="#e03131" />
                <Text style={[styles.itemText, styles.logoutText]}>Salir</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  menuButton: { padding: 2 },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    width: '82%',
    maxWidth: 360,
    height: '100%',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 20,
    backgroundColor: '#fff',
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 20,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  options: { flex: 1 },
  title: { color: '#212529', fontSize: 23, fontWeight: '800' },
  subtitle: { color: '#868e96', fontSize: 13, marginTop: 3 },
  item: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  itemText: { color: '#343a40', fontSize: 15, fontWeight: '600' },
  logout: {
    marginTop: 12,
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
  },
  logoutText: { color: '#e03131' },
});

export default SideMenu;
