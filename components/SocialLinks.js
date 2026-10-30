import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { filledSocialLinks } from '../utils/socialLinks';

const ICONS = {
  instagram: { name: 'logo-instagram', color: '#d6249f' },
  youtube: { name: 'logo-youtube', color: '#ff0000' },
  facebook: { name: 'logo-facebook', color: '#1877f2' },
  linkedin: { name: 'logo-linkedin', color: '#0a66c2' },
  website: { name: 'globe-outline', color: '#495057' },
  whatsapp: { name: 'logo-whatsapp', color: '#25d366' },
};

const NetworkIcon = ({ network }) => {
  if (network === 'tiktok') return <FontAwesome5 name="tiktok" size={18} color="#111" />;
  // No hay ícono de X en las librerías: su letra.
  if (network === 'x') return <Text style={styles.xLogo}>𝕏</Text>;
  const icon = ICONS[network];
  return <Ionicons name={icon.name} size={20} color={icon.color} />;
};

/** Las redes sociales del perfil: un botón por red que abre su enlace. */
const SocialLinks = ({ links, style }) => {
  const items = filledSocialLinks(links);
  if (!items.length) return null;
  return (
    <View style={[styles.row, style]}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.button}
          onPress={() => Linking.openURL(item.url).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={`Abrir ${item.label}`}
        >
          <NetworkIcon network={item.key} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef',
  },
  xLogo: { fontSize: 18, fontWeight: '900', color: '#111' },
});

export default SocialLinks;
