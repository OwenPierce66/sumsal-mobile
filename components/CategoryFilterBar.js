import React, { useMemo, useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CategoryHierarchy from './CategoryHierarchy';
import { useCategoryTree } from '@hooks/useCategoryFilter';
import {
  categoryKey, categoryPath, limitCategoryTree, normalizeCategory, withCustomPaths,
} from '../utils/categoryFilter';

const STATUS_KEYS = new Set(['procesando', 'aprobada', 'aprobadas', 'aprovada', 'aprovadas']);
const isStatus = (name) => STATUS_KEYS.has(categoryKey(name));

/**
 * Filtro por categorías y subcategorías (niveles), el mismo de las tareas, para cualquier
 * lista: tareas, perfiles o foro. Se ve directamente: las categorías de la app y las tuyas;
 * tocar la elegida otra vez la quita. La lupa al final deja escribir otra (p. ej. una
 * propia de otra persona).
 *
 * `value`/`onChange` usan la ruta como texto: "Tema,Subtema" (como el parámetro `category`).
 * `onlyNames`: mostrar solo las categorías que llevan a esos nombres (p. ej. las de tus
 * guardadas); entonces no se escribe otra.
 */
const CategoryFilterBar = ({
  value = '',
  onChange,
  pch = '',
  includePersonal = true,
  showStatuses = true,
  onlyNames,
  style,
}) => {
  const { nodes: allNodes } = useCategoryTree({ pch, includePersonal });
  const nodes = useMemo(
    () => (onlyNames ? limitCategoryTree(allNodes, onlyNames) : allNodes),
    [allNodes, onlyNames],
  );
  const [customPaths, setCustomPaths] = useState([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  const path = categoryPath(value);
  const levelsKey = path.filter((name) => !isStatus(name)).join(',');
  const levels = useMemo(() => categoryPath(levelsKey), [levelsKey]);
  const status = showStatuses ? path.find(isStatus) || '' : '';
  const tree = useMemo(
    () => withCustomPaths(nodes, [levels, ...customPaths]),
    [nodes, levels, customPaths],
  );

  const emit = (nextLevels, nextStatus = '') => {
    onChange?.([...categoryPath(nextLevels), ...(nextStatus ? [nextStatus] : [])].join(','));
  };

  const handleSelect = (nextValue) => {
    const nextLevels = categoryPath(nextValue);
    // Los estados (Procesando/Aprobadas) solo existen dentro de "Grabar Podcast".
    const keepStatus = categoryKey(nextLevels[0]) === 'grabar podcast' ? status : '';
    emit(nextLevels, keepStatus);
  };

  const handleRemove = (node) => {
    if (!node?.isSearchCategory || !Array.isArray(node.searchPath)) return;
    const removed = node.searchPath.map(categoryKey).join(',');
    const descends = (candidate) => {
      const key = categoryPath(candidate).map(categoryKey).join(',');
      return key === removed || key.startsWith(`${removed},`);
    };
    setCustomPaths((previous) => previous.filter((candidate) => !descends(candidate)));
    if (descends(levels)) emit(levels.slice(0, node.searchPath.length - 1));
  };

  const addCustom = () => {
    const name = normalizeCategory(customName);
    if (!name) return;
    const nextLevels = levels.some((item) => categoryKey(item) === categoryKey(name)) ? levels : [...levels, name];
    setCustomPaths((previous) => [...previous, nextLevels]);
    setCustomName('');
    setCustomOpen(false);
    emit(nextLevels);
  };

  const searchButton = onlyNames ? null : (
    <TouchableOpacity
      style={[styles.searchChip, customOpen && styles.searchChipActive]}
      onPress={() => setCustomOpen((previous) => !previous)}
      accessibilityLabel="Buscar otra categoría"
    >
      <Ionicons name="search" size={16} color={customOpen ? '#fff' : '#4dabf7'} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <CategoryHierarchy
        availableCategories={tree}
        selectedCategoryPath={levels}
        selectedStatus={status}
        onStatusSelect={(nextStatus) => emit(levels, categoryKey(nextStatus) === categoryKey(status) ? '' : nextStatus)}
        onSelect={handleSelect}
        onRemoveCategory={handleRemove}
        showDescendants
        deselectable
        showStatuses={showStatuses}
        containerStyle={styles.levels}
        rootTrailing={searchButton}
      />
      {customOpen ? (
        <View style={styles.customRow}>
          <TextInput
            style={styles.customInput}
            placeholder={levels.length ? `Otra subcategoría de ${levels[levels.length - 1]}...` : 'Otra categoría...'}
            placeholderTextColor="#999"
            value={customName}
            onChangeText={setCustomName}
            onSubmitEditing={addCustom}
            returnKeyType="search"
            autoFocus
            accessibilityLabel="Otra categoría"
          />
          <TouchableOpacity style={styles.customButton} onPress={addCustom} accessibilityLabel="Filtrar por esa categoría">
            <Ionicons name="arrow-forward" size={17} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  // CategoryHierarchy ya trae su propio margen lateral por fila.
  levels: { marginTop: 4, marginBottom: 0, marginHorizontal: -4 },
  searchChip: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#4dabf7',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  searchChipActive: { backgroundColor: '#4dabf7' },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 4 },
  customInput: { flex: 1, height: 36, borderRadius: 18, paddingHorizontal: 14, backgroundColor: '#f1f3f5', color: '#333', fontSize: 13 },
  customButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
});

export default CategoryFilterBar;
