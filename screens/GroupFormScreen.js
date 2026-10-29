import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import api from '@api';
import { compressImage } from '../utils/compressImage';

/** Mensaje legible de un error del backend al guardar el grupo. */
export function groupErrorMessage(error) {
  const data = error?.response?.data;
  if (!data) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
  if (typeof data === 'string') return data.slice(0, 300);
  if (data.detail) return data.detail;
  return Object.entries(data)
    .map(([, value]) => (Array.isArray(value) ? value.join(' ') : String(value)))
    .join('\n') || 'No se pudo guardar el grupo.';
}

async function appendImage(formData, uri) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    formData.append('image', blob, `grupo.${blob.type.split('/')[1] || 'jpg'}`);
    return;
  }
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  formData.append('image', { uri, name: `grupo.${ext}`, type: `image/${ext === 'jpg' ? 'jpeg' : ext}` });
}

/**
 * Crear o editar un grupo: nombre, descripción, reglas, portada y si es privado.
 * Con `route.params.group` edita (solo admins); sin él, crea y quien lo crea queda como su creador y admin.
 */
const GroupFormScreen = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const editing = route?.params?.group || null;
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [rules, setRules] = useState(editing?.rules || '');
  const [isPrivate, setIsPrivate] = useState(Boolean(editing?.is_private));
  const [imageUri, setImageUri] = useState(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: Platform.OS !== 'web',
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const asset = await compressImage(result.assets[0]);
      setImageUri(asset.uri);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ponle un nombre a tu grupo.');
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('rules', rules.trim());
      formData.append('is_private', isPrivate ? 'true' : 'false');
      if (imageUri) await appendImage(formData, imageUri);

      const { data } = editing
        ? await api.patch(`groups/${editing.id}/`, formData)
        : await api.post('groups/', formData);
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.setQueryData(['group', String(data.id)], data);
      if (editing) {
        navigation.goBack();
      } else {
        navigation.replace('GroupDetail', { groupId: data.id });
      }
    } catch (error) {
      Alert.alert('No se pudo guardar el grupo', groupErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const coverUri = imageUri || editing?.image_url;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{editing ? 'Editar grupo' : 'Crear grupo'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.coverPicker} onPress={pickImage} accessibilityLabel="Elegir portada del grupo">
          {coverUri ? (
            <Image source={{ uri: coverUri }} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, styles.coverEmpty]}>
              <Ionicons name="image-outline" size={30} color="#4dabf7" />
              <Text style={styles.coverText}>Portada (opcional)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Nombre</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nombre del grupo"
          style={styles.input}
          maxLength={120}
          accessibilityLabel="Nombre del grupo"
        />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="¿De qué trata el grupo?"
          style={[styles.input, styles.multiline]}
          multiline
          accessibilityLabel="Descripción del grupo"
        />

        <Text style={styles.label}>Reglas</Text>
        <TextInput
          value={rules}
          onChangeText={setRules}
          placeholder={'1. Respeta a todos\n2. Publica sobre el tema del grupo'}
          style={[styles.input, styles.multiline]}
          multiline
          accessibilityLabel="Reglas del grupo"
        />

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>Grupo privado</Text>
            <Text style={styles.hint}>
              {isPrivate
                ? 'Para entrar hay que pedirlo y un admin lo aprueba. Solo los integrantes ven lo que se publica.'
                : 'Cualquiera puede unirse al instante y lo publicado se ve en toda la app.'}
            </Text>
          </View>
          <Switch value={isPrivate} onValueChange={setIsPrivate} accessibilityLabel="Grupo privado" />
        </View>

        {!editing ? (
          <Text style={styles.hint}>
            Serás el creador y admin del grupo. Las publicaciones de los integrantes esperan a que un admin las apruebe;
            las de los admins se publican al instante.
          </Text>
        ) : null}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.saveText}>{editing ? 'GUARDAR CAMBIOS' : 'CREAR GRUPO'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5' },
  topBar: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingTop: Platform.OS === 'ios' ? 50 : 16 },
  backBtn: { position: 'absolute', left: 16, top: Platform.OS === 'ios' ? 50 : 16, zIndex: 10 },
  topBarTitle: { fontSize: 20, fontWeight: '800', color: '#333' },
  content: { padding: 16, paddingBottom: 40 },
  coverPicker: { alignSelf: 'center', marginBottom: 10 },
  cover: { width: 110, height: 110, borderRadius: 24, backgroundColor: '#e7f5ff' },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  coverText: { fontSize: 11, color: '#4dabf7', fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '800', color: '#555', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333' },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 10 },
  switchText: { flex: 1 },
  switchTitle: { fontSize: 15, fontWeight: '700', color: '#333', marginBottom: 2 },
  hint: { fontSize: 12, color: '#868e96' },
  saveButton: { marginTop: 22, height: 50, borderRadius: 14, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
  saveButtonDisabled: { backgroundColor: '#adb5bd' },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

export default GroupFormScreen;
