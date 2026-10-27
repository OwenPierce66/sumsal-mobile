import React from 'react';
import { Text, Linking, Alert, StyleSheet } from 'react-native';
import { splitTextWithLinks } from '../utils/links';

/**
 * Texto de una descripción con sus enlaces (http(s):// o www.) tocables.
 * Se usa en lugar de <Text>: con o sin enlaces se ve igual que antes.
 */
const LinkifiedText = ({ text, style, linkStyle, numberOfLines }) => (
  <Text style={style} numberOfLines={numberOfLines}>
    {splitTextWithLinks(text).map((part, index) => (part.url ? (
      <Text
        key={index}
        style={[styles.link, linkStyle]}
        onPress={() => Linking.openURL(part.url).catch(() => Alert.alert('No se pudo abrir el enlace', part.url))}
        accessibilityRole="link"
      >
        {part.text}
      </Text>
    ) : part.text))}
  </Text>
);

const styles = StyleSheet.create({
  link: { color: '#1c7ed6', textDecorationLine: 'underline' },
});

export default LinkifiedText;
