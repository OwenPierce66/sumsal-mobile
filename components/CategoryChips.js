import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { categoryKey, categoryPath } from '../utils/categoryFilter';

/** Las categorías de una publicación ("Tema,Subtema"); tocar una filtra por ella. */
const CategoryChips = ({ categories, onPress, style }) => {
  const names = categoryPath(categories);
  if (!names.length) return null;
  return (
    <View style={[styles.row, style]}>
      {names.map((name) => (
        <TouchableOpacity
          key={categoryKey(name)}
          style={styles.chip}
          onPress={onPress ? () => onPress(name) : undefined}
          disabled={!onPress}
          accessibilityLabel={`Categoría ${name}`}
        >
          <Text style={styles.text}>{name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { backgroundColor: '#e7f5ff', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  text: { color: '#1c7ed6', fontSize: 11, fontWeight: '600' },
});

export default CategoryChips;
