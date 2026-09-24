import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const CategoryHierarchy = ({ categories, availableCategories, onSelect, onRemoveCategory, selectedStatus = '', onStatusSelect, showDescendants = false, selectedCategoryPath = [] }) => {
  const [tree, setTree] = useState(DEFAULT_SUBTHEMES);
  const [selectedPath, setSelectedPath] = useState([]);
  const [collapsedLevels, setCollapsedLevels] = useState(new Set());
  const levelScrollRefs = useRef(new Map());

  const source = categories || availableCategories || [];

  useEffect(() => {
    if (Array.isArray(selectedCategoryPath)) {
      setSelectedPath(selectedCategoryPath.map(normalize).filter(Boolean));
      setCollapsedLevels(previous => new Set(
        [...previous].filter(level => level < selectedCategoryPath.length)
      ));
    }
    requestAnimationFrame(() => {
      levelScrollRefs.current.forEach(scrollView => scrollView?.scrollToEnd({ animated: false }));
    });
  }, [selectedCategoryPath]);

  // Si el backend manda objetos con `parent`, la jerarquía viene de la base de datos.
  const nodes = useMemo(() => (
    Array.isArray(source) ? source.filter(item => item && typeof item === 'object' && item.id !== undefined) : []
  ), [source]);
  const treeMode = nodes.length > 0;

  useEffect(() => {
    if (treeMode) return undefined;
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
  }, [treeMode]);

  const selected = useMemo(() => {
    const values = Array.isArray(source) ? source : String(source || '').split(',');
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
  }, [source]);

  const selectedKeys = useMemo(() => new Set(selected.map(keyFor)), [selected]);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    if (!treeMode) return map;
    nodes.forEach(node => {
      const parentId = node.parent == null ? null : String(node.parent);
      const bucket = map.get(parentId) || [];
      bucket.push(node);
      map.set(parentId, bucket);
    });
    return map;
  }, [nodes, treeMode]);

  const childrenOf = node => {
    if (treeMode) {
      const children = childrenByParent.get(node?.id == null ? null : String(node.id)) || [];
      if (keyFor(node?.name) === 'grabar podcast') {
        return [
          ...children.filter(child => !['procesando', 'aprobada', 'aprobadas', 'aprovada', 'aprovadas'].includes(keyFor(child.name))),
          { id: 'podcast-status-processing', name: 'Procesando', virtualStatus: 'Procesando' },
          { id: 'podcast-status-approved', name: 'Aprobadas', virtualStatus: 'Aprobada' },
        ];
      }
      return children;
    }
    return (tree[keyFor(node)] || [])
      .map(normalize)
      .filter(child => showDescendants || selectedKeys.has(keyFor(child)));
  };

  const roots = useMemo(() => {
    if (treeMode) {
      const presentIds = new Set(nodes.map(node => String(node.id)));
      return nodes.filter(node => (
        node.parent == null || !presentIds.has(String(node.parent))
      ));
    }
    const allChildren = new Set(Object.values(tree).flat().map(keyFor));
    return selected.filter(value => !allChildren.has(keyFor(value)));
  }, [treeMode, nodes, selected, tree]);

  const labelOf = value => (typeof value === 'object' ? normalize(value.name) : normalize(value));

  const handleSelect = (value, level) => {
    const label = labelOf(value);
    const valueKey = keyFor(label);
    const isSameSelection = keyFor(selectedPath[level]) === valueKey;
    if (isSameSelection) {
      setCollapsedLevels(previousCollapsed => {
        const nextCollapsed = new Set(previousCollapsed);
        if (nextCollapsed.has(level)) {
          nextCollapsed.delete(level);
        } else {
          nextCollapsed.add(level);
        }
        return nextCollapsed;
      });
      return;
    }

    setCollapsedLevels(previousCollapsed => new Set(
      [...previousCollapsed].filter(collapsedLevel => collapsedLevel < level)
    ));
    const nextPath = [...selectedPath.slice(0, level), label];
    onSelect?.(nextPath.join(','));
    setSelectedPath(nextPath);
  };

  const renderLevel = (values, level, parentKey) => {
    if (!values.length) return null;
    const selectedValue = keyFor(selectedPath[level]);
    const selectedItem = values.find(value => keyFor(labelOf(value)) === selectedValue);
    const visibleChildren = selectedItem && !collapsedLevels.has(level)
      ? childrenOf(selectedItem)
      : [];

    return (
      <View key={`${parentKey}-${level}`} style={[styles.level, { paddingLeft: level * 14 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
          keyboardShouldPersistTaps="handled"
          ref={scrollView => levelScrollRefs.current.set(level, scrollView)}
        >
          {values.map(value => {
            const label = labelOf(value);
            const isSelected = selectedValue === keyFor(label);
            const isStatus = Boolean(value?.virtualStatus);
            const isStatusSelected = isStatus &&
              keyFor(selectedStatus) === keyFor(value.virtualStatus);
            const isRemovable = Boolean(value?.isSearchCategory);
            return (
              <View key={`${parentKey}-${value?.id ?? keyFor(label)}`} style={styles.badgeGroup}>
                <TouchableOpacity
                  onPress={() => {
                    if (isStatus) {
                      onStatusSelect?.(value.virtualStatus);
                      return;
                    }
                    handleSelect(value, level);
                  }}
                  style={[styles.badge, level === 0 ? styles.rootBadge : styles.childBadge, (isSelected || isStatusSelected) && styles.selectedBadge, isRemovable && styles.removableBadge]}
                >
                  <Text style={[styles.badgeText, level === 0 ? styles.rootText : styles.childText, (isSelected || isStatusSelected) && styles.selectedText]}>
                    {label}
                  </Text>
                </TouchableOpacity>
                {isRemovable ? (
                  <TouchableOpacity
                    style={styles.removeBadgeButton}
                    onPress={() => onRemoveCategory?.(value, level)}
                    accessibilityLabel={`Quitar ${label}`}
                  >
                    <Text style={styles.removeBadgeText}>×</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
        {selectedItem && visibleChildren.length > 0
          ? renderLevel(visibleChildren, level + 1, keyFor(labelOf(selectedItem)))
          : null}
      </View>
    );
  };

  const topLevel = roots.length ? roots : (treeMode ? nodes : selected);
  if (!topLevel.length) return null;

  return (
    <View style={styles.container}>
      {renderLevel(topLevel, 0, 'root')}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 10, marginBottom: 8 },
  level: { marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 2 },
  badgeGroup: { position: 'relative' },
  badge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, minHeight: 36, justifyContent: 'center' },
  removableBadge: { paddingRight: 27 },
  removeBadgeButton: { position: 'absolute', right: 5, top: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  removeBadgeText: { color: '#777', fontSize: 18, lineHeight: 18 },
  rootBadge: { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0' },
  childBadge: { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0' },
  selectedBadge: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  badgeText: { fontSize: 14 },
  rootText: { color: '#666' },
  childText: { color: '#666' },
  selectedText: { color: '#fff' },
});

export default CategoryHierarchy;
