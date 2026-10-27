import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUserBadges } from '@hooks/useUserBadges';

// Mismos colores que los niveles de likes (TieredLikesModal).
export const BADGE_META = {
  app: { icon: 'apps', color: '#000', label: 'App' },
  admin: { icon: 'shield-checkmark', color: '#4dabf7', label: 'Administrador' },
  recommended: { icon: 'medal', color: '#f59f00', label: 'Recomendado' },
  verified: { icon: 'checkmark-circle', color: '#4dabf7', label: 'Verificado' },
  sub_red: { icon: 'star', color: '#ff6b6b', label: 'Suscripción +' },
  sub_green: { icon: 'star-half', color: '#51cf66', label: 'Suscripción' },
};

/** Íconos de insignia que van junto al nombre de `userId`. */
const UserBadges = ({ userId, size = 14, style }) => {
  const badges = useUserBadges(userId).filter((key) => BADGE_META[key]);
  if (badges.length === 0) return null;

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={badges.map((key) => BADGE_META[key].label).join(', ')}
    >
      {badges.map((key) => (
        <Ionicons key={key} name={BADGE_META[key].icon} size={size} color={BADGE_META[key].color} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  nameText: { flexShrink: 1 },
});

export default UserBadges;

/** Nombre con sus insignias al lado, para textos que no usan TouchableUsername. */
export const NameWithBadges = ({ userId, style, numberOfLines = 1, badgeSize = 14, containerStyle, children }) => (
  <View style={[styles.nameRow, containerStyle]}>
    <Text style={[style, styles.nameText]} numberOfLines={numberOfLines}>{children}</Text>
    <UserBadges userId={userId} size={badgeSize} />
  </View>
);
