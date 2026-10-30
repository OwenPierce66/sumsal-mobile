import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import api, { getImageUrl, UPLOAD_TIMEOUT_MS } from '@api';
import { appendMediaFile } from '../utils/mediaUpload';
import { categoryKey, categoryPath } from '../utils/categoryFilter';

/** La categoría elegida dentro del árbol: sigue la ruta nivel por nivel ("Tema,Subtema"). */
export function findCategoryNode(categories, path) {
  const parts = categoryPath(path);
  const nodes = Array.isArray(categories) ? categories : [];
  if (!parts.length) return null;
  let parentId = null;
  let node = null;
  for (const name of parts) {
    const next = nodes.find((item) => (
      categoryKey(item.name) === categoryKey(name)
      && (item.parent == null ? null : String(item.parent)) === (parentId == null ? null : String(parentId))
    ));
    if (!next) {
      // Una categoría que no está en ese nivel (p. ej. una propia): se busca solo por nombre.
      return nodes.find((item) => categoryKey(item.name) === categoryKey(parts[parts.length - 1])) || node;
    }
    node = next;
    parentId = next.id;
  }
  return node;
}

/**
 * Cabecera de la categoría elegida en el feed: su imagen y de qué trata. Un admin la
 * edita aquí mismo (imagen y descripción).
 * - variant="hero": la versión grande de Explorar categorías.
 * - showEmpty: se muestra aunque aún no tenga imagen ni descripción.
 * - children: acciones debajo (p. ej. "Ver publicaciones").
 */
const CategoryHeader = ({
  categories, path, isAdmin = false, onUpdated, variant = 'card', showEmpty = false, children = null,
}) => {
  const category = useMemo(() => findCategoryNode(categories, path), [categories, path]);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!category || typeof category.id !== 'number') return null;
  // La URL del backend puede venir sin el puerto del proxy: getImageUrl la arma bien.
  const imageUrl = getImageUrl(category.image_url);
  const hasContent = Boolean(imageUrl || category.description);
  if (!hasContent && !isAdmin && !showEmpty) return null;
  const hero = variant === 'hero';

  const startEditing = () => {
    setDescription(category.description || '');
    setImage(null);
    setEditing(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]) setImage(result.assets[0]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('description', description.trim());
      if (image) await appendMediaFile(formData, 'image', image);
      const { data } = await api.patch(`new-categories/${category.id}/`, formData, { timeout: UPLOAD_TIMEOUT_MS });
      onUpdated?.(data);
      setEditing(false);
    } catch (error) {
      const detail = error.response?.data;
      Alert.alert('No se pudo guardar', String(detail?.image?.[0] || detail?.description?.[0] || 'Intenta de nuevo.'));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <View style={styles.card}>
        <Text style={styles.name}>{category.name}</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} accessibilityLabel="Elegir imagen de la categoría">
          {image?.uri || imageUrl ? (
            <Image source={{ uri: image?.uri || imageUrl }} style={[styles.image, hero && styles.heroImage]} contentFit="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={26} color="#868e96" />
              <Text style={styles.placeholderText}>Elegir imagen</Text>
            </View>
          )}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="¿De qué trata esta categoría?"
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          accessibilityLabel="Descripción de la categoría"
        />
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => setEditing(false)} disabled={saving} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save} disabled={saving} style={styles.primaryButton} accessibilityLabel="Guardar presentación">
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryText}>Guardar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={[styles.image, hero && styles.heroImage]} contentFit="cover" />
      ) : null}
      <View style={styles.titleRow}>
        <Text style={[styles.name, hero && styles.heroName]}>{category.name}</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={startEditing} accessibilityLabel="Editar presentación de la categoría">
            <Ionicons name="pencil-outline" size={18} color="#4dabf7" />
          </TouchableOpacity>
        ) : null}
      </View>
      {category.description ? (
        <Text style={[styles.description, hero && styles.heroDescription]}>{category.description}</Text>
      ) : isAdmin ? (
        <Text style={styles.hint}>Agrega una imagen y una descripción para presentar esta categoría.</Text>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginTop: 10, marginBottom: 4, borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden', padding: 12, gap: 8 },
  image: { width: '100%', height: 150, borderRadius: 12, backgroundColor: '#f1f3f5' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 18, fontWeight: '800', color: '#212529' },
  description: { fontSize: 14, lineHeight: 20, color: '#495057' },
  heroImage: { height: 210 },
  heroName: { fontSize: 24 },
  heroDescription: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 12, color: '#868e96' },
  imagePicker: { borderRadius: 12, overflow: 'hidden' },
  imagePlaceholder: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#ced4da' },
  placeholderText: { color: '#868e96', fontSize: 12 },
  input: { minHeight: 70, borderRadius: 10, padding: 10, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef', color: '#333', textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  secondaryButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f3f5' },
  secondaryText: { color: '#495057', fontWeight: '700' },
  primaryButton: { minWidth: 90, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#4dabf7' },
  primaryText: { color: '#fff', fontWeight: '800' },
});

export default CategoryHeader;
