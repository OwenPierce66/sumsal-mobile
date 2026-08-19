import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_SUBTHEMES = {
  programacion: ['React', 'Python', 'Node.js', 'Django', 'React Native', 'JavaScript', 'Frontend', 'Backend'],
  tecnologia: ['Inteligencia Artificial', 'Ciberseguridad', 'Hardware', 'Software', 'Innovación'],
  educacion: ['Matemáticas', 'Idiomas', 'Ciencias', 'Historia', 'Pedagogía'],
  salud: ['Nutrición', 'Ejercicio', 'Bienestar Mental', 'Medicina', 'Psicología'],
  finanzas: ['Inversiones', 'Ahorro', 'Criptomonedas', 'Emprendimiento', 'Economía'],
  arte: ['Pintura', 'Música', 'Fotografía', 'Cine', 'Diseño'],
  deportes: ['Fútbol', 'Baloncesto', 'Tenis', 'Natación', 'Fitness'],
};

const normalize = value => String(value || '').trim();
const keyFor = value => normalize(value).toLowerCase();

const CategoryHierarchy = ({ categories, availableCategories, onSelect, showDescendants = false }) => {
  const [tree, setTree] = useState(DEFAULT_SUBTHEMES);
  const [selectedPath, setSelectedPath] = useState([]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem('subthemesTree')
      .then(stored => {
        if (!mounted || !stored) return;
        try {
          setTree({ ...DEFAULT_SUBTHEMES, ...JSON.parse(stored) });
        } catch (error) {
          console.warn('[CategoryHierarchy] Árbol inválido guardado localmente');
        }
      })
      .catch(error => console.warn('[CategoryHierarchy] No se pudo cargar el árbol:', error));

    return () => { mounted = false; };
  }, []);

  const selected = useMemo(() => {
    const sourceValues = categories || availableCategories || [];
    const values = Array.isArray(sourceValues) ? sourceValues : String(sourceValues || '').split(',');
    const unique = [];
    const seen = new Set();
    values.map(value => normalize(typeof value === 'object' ? value.name : value)).filter(Boolean).forEach(value => {
      const key = keyFor(value);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(value);
      }
    });
    return unique;
  }, [categories, availableCategories]);

  const selectedKeys = useMemo(() => new Set(selected.map(keyFor)), [selected]);

  const childrenOf = parent => {
    const children = tree[keyFor(parent)] || [];
    return children
      .map(normalize)
      .filter(child => showDescendants || selectedKeys.has(keyFor(child)));
  };

  const roots = useMemo(() => {
    const allChildren = new Set(
      Object.values(tree).flat().map(keyFor)
    );
    return selected.filter(value => !allChildren.has(keyFor(value)));
  }, [selected, tree]);

  const handleSelect = (value, level) => {
    const valueKey = keyFor(value);
    setSelectedPath(previous => {
      if (previous[level] === valueKey) return previous.slice(0, level);
      return [...previous.slice(0, level), valueKey];
    });
    onSelect?.(value);
  };

  const renderLevel = (values, level, parentKey, parentLabel = '') => {
    if (!values.length) return null;
    const selectedValue = selectedPath[level];
    const selectedLabel = values.find(value => keyFor(value) === selectedValue);
    const visibleChildren = selectedLabel ? childrenOf(selectedLabel) : [];

    return (
      <View key={`${parentKey}-${level}`} style={[styles.level, { paddingLeft: level * 14 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          keyboardShouldPersistTaps="handled"
        >
          {values.map(value => (
            <TouchableOpacity
              key={`${parentKey}-${keyFor(value)}`}
              onPress={() => handleSelect(value, level)}
              style={[styles.badge, level === 0 ? styles.rootBadge : styles.childBadge, selectedValue === keyFor(value) && styles.selectedBadge]}
            >
              <Text style={[styles.badgeText, level === 0 ? styles.rootText : styles.childText, selectedValue === keyFor(value) && styles.selectedText]}>{value}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {selectedLabel && visibleChildren.length > 0 && renderLevel(visibleChildren, level + 1, keyFor(selectedLabel), selectedLabel)}
      </View>
    );
  };

  if (!selected.length) return null;
  return (
    <View style={styles.container}>
      {renderLevel(roots.length ? roots : selected, 0, 'root')}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 10, marginBottom: 8 },
  level: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, minHeight: 36, justifyContent: 'center' },
  rootBadge: { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0' },
  childBadge: { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0' },
  selectedBadge: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  badgeText: { fontSize: 14 },
  rootText: { color: '#666' },
  childText: { color: '#666' },
  selectedText: { color: '#fff' },
});

export default CategoryHierarchy;
