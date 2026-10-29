import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import api from '@api';
import { useCategoryTree } from '@hooks/useCategoryFilter';
import { categoryKey, categoryPath, normalizeCategory } from '../utils/categoryFilter';

const RESERVED = new Set(['aprobada', 'aprobadas', 'aprovada', 'aprovadas', 'procesando']);

/**
 * Elegir categorías al publicar (p. ej. un post del foro), igual que al crear una tarea:
 * las de la app o las tuyas, y debajo de cada una elegida sus subcategorías, nivel por
 * nivel. Las nuevas se guardan en tu filtro personal, así luego sirven para filtrar.
 *
 * `value`/`onChange`: "Tema,Subtema,..." en el orden en que se eligieron (como Task.categories).
 */
const CategoryPicker = ({ value = '', onChange, title = 'Categorías (opcional)' }) => {
  const queryClient = useQueryClient();
  const { nodes, myCategories } = useCategoryTree({ includeApproval: false });
  const [newName, setNewName] = useState('');
  const [subName, setSubName] = useState('');
  const [subParent, setSubParent] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = categoryPath(value);
  const isSelected = (name) => selected.some((item) => categoryKey(item) === categoryKey(name));

  const usable = useMemo(() => nodes.filter((node) => !RESERVED.has(categoryKey(node.name))), [nodes]);
  const childrenOf = (name) => {
    const parents = new Set(usable.filter((node) => categoryKey(node.name) === categoryKey(name)).map((node) => node.id));
    return categoryPath(usable.filter((node) => parents.has(node.parent)).map((node) => node.name));
  };
  const roots = useMemo(() => {
    const known = new Set(usable.map((node) => categoryKey(node.name)));
    // Las elegidas que no están en ningún árbol (p. ej. al editar) también se pueden quitar.
    const loose = selected.filter((name) => !known.has(categoryKey(name)));
    return categoryPath([...usable.filter((node) => node.parent == null).map((node) => node.name), ...loose]);
  }, [usable, selected]);

  const descendantsOf = (name, seen = new Set()) => {
    if (seen.has(categoryKey(name))) return [];
    seen.add(categoryKey(name));
    return childrenOf(name).flatMap((child) => [child, ...descendantsOf(child, seen)]);
  };

  const toggle = (name) => {
    if (isSelected(name)) {
      // Quitar una categoría quita también las subcategorías que colgaban de ella.
      const removed = new Set([name, ...descendantsOf(name)].map(categoryKey));
      onChange?.(selected.filter((item) => !removed.has(categoryKey(item))).join(','));
      if (removed.has(categoryKey(subParent))) setSubParent('');
      return;
    }
    onChange?.([...selected, name].join(','));
    setSubParent(name);
  };

  // Tu filtro personal guarda cada categoría con su padre (CategoryP).
  const findMine = (name, parentId = undefined) => myCategories.find((item) => (
    categoryKey(item.name) === categoryKey(name)
    && (parentId === undefined || String(item.parent ?? '') === String(parentId ?? ''))
  ));
  const createMine = async (name, parentId = null) => {
    const response = await api.post('categories/', parentId ? { name, parent: parentId } : { name });
    queryClient.setQueryData(['myCategories'], (previous) => [...(previous || []), response.data]);
    return response.data;
  };

  const validName = (raw) => {
    const name = normalizeCategory(raw);
    if (!name) return '';
    if (RESERVED.has(categoryKey(name))) {
      Alert.alert('No permitido', `"${name}" es una etiqueta de estado, no una categoría.`);
      return '';
    }
    return name;
  };

  const addCategory = async () => {
    const name = validName(newName);
    if (!name || saving) return;
    setSaving(true);
    try {
      const exists = usable.some((node) => node.parent == null && categoryKey(node.name) === categoryKey(name));
      if (!exists) await createMine(name);
      if (!isSelected(name)) onChange?.([...selected, name].join(','));
      setSubParent(name);
      setNewName('');
    } catch (error) {
      Alert.alert('No se pudo agregar', String(error.response?.data?.name || 'Intenta con otro nombre.'));
    } finally {
      setSaving(false);
    }
  };

  const addSubcategory = async () => {
    const name = validName(subName);
    if (!name || !subParent || saving) return;
    setSaving(true);
    try {
      const exists = childrenOf(subParent).some((child) => categoryKey(child) === categoryKey(name));
      if (!exists) {
        const parent = findMine(subParent) || await createMine(subParent);
        if (!findMine(name, parent.id)) await createMine(name, parent.id);
      }
      if (!isSelected(name)) onChange?.([...selected, name].join(','));
      setSubParent(name);
      setSubName('');
    } catch (error) {
      const detail = error.response?.data?.name || error.response?.data?.parent;
      Alert.alert('No se pudo agregar', String(detail || 'Intenta con otro nombre.'));
    } finally {
      setSaving(false);
    }
  };

  const chip = (name, keyPrefix, onPress = () => toggle(name), active = isSelected(name)) => (
    <TouchableOpacity
      key={`${keyPrefix}-${categoryKey(name)}`}
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      accessibilityLabel={`${active ? 'Quitar' : 'Elegir'} ${name}`}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chips}>{roots.map((name) => chip(name, 'root'))}</View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe una categoría nueva..."
          placeholderTextColor="#999"
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={addCategory}
        />
        <TouchableOpacity style={styles.addButton} onPress={addCategory} accessibilityLabel="Agregar categoría">
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Subcategorías de cada elegida, nivel por nivel. */}
      {selected.map((name) => {
        const children = childrenOf(name);
        if (!children.length) return null;
        return (
          <View key={`subs-${categoryKey(name)}`} style={styles.level}>
            <Text style={styles.levelTitle}>Subtemas de {name}</Text>
            <View style={styles.chips}>{children.map((child) => chip(child, `sub-${categoryKey(name)}`))}</View>
          </View>
        );
      })}

      {selected.length ? (
        <View style={styles.level}>
          <Text style={styles.levelTitle}>Agregar subcategoría a</Text>
          <View style={styles.chips}>
            {selected.map((name) => chip(name, 'parent', () => setSubParent(name), categoryKey(subParent) === categoryKey(name)))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder={subParent ? `Subcategoría de ${subParent}...` : 'Elige primero una categoría arriba'}
              placeholderTextColor="#999"
              value={subName}
              onChangeText={setSubName}
              onSubmitEditing={addSubcategory}
              editable={Boolean(subParent)}
            />
            <TouchableOpacity style={styles.addButton} onPress={addSubcategory} accessibilityLabel="Agregar subcategoría">
              <Ionicons name="git-branch-outline" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#e0e0e0', backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextActive: { color: '#fff' },
  level: { marginTop: 12 },
  levelTitle: { fontSize: 12, fontWeight: '700', color: '#868e96', marginBottom: 6 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { flex: 1, height: 38, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#f1f3f5', color: '#333', fontSize: 13 },
  addButton: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
});

export default CategoryPicker;
