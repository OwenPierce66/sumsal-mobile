import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Componente simple para nombres de usuarios que navega al perfil
 */
const UsernameLink = (props) => {
  try {
    const { username, userId, navigation, style, textStyle } = props;
    console.log('[UsernameLink] RENDERING:', username, userId);

    const handlePress = () => {
      console.log('[UsernameLink] TAP on', username);
      try {
        navigation?.navigate('UserProfile', {
          userId,
          userName: username,
        });
      } catch (e) {
        console.error('[UsernameLink] Navigation error:', e);
      }
    };

    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        style={style}
      >
        <Text style={[styles.username, textStyle]}>
          {username || 'Usuario'}
        </Text>
      </TouchableOpacity>
    );
  } catch (error) {
    console.error('[UsernameLink] Render error:', error);
    return <Text>Error rendering UsernameLink</Text>;
  }
};

const styles = StyleSheet.create({
  username: {
    color: '#297fce',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default UsernameLink;
