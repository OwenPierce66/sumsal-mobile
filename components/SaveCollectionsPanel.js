import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import api from '@api';
import { useCollection, useCollections } from '@hooks/useApi';

const confirm = (message, onConfirm) => {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm();
    return;
  }
  Alert.alert('Borrar colección', message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Borrar', style: 'destructive', onPress: onConfirm },
  ]);
};

/** Una colección abierta: sus publicaciones y, para su dueño, nombre, privacidad y borrar. */
const CollectionDetail = ({ collectionId, isOwner, navigation, onBack }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch } = useCollection(collectionId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const refreshLists = () => queryClient.invalidateQueries({ queryKey: ['collections'] });

  const update = async (changes) => {
    try {
      await api.patch(`collections/${collectionId}/`, changes);
      await refetch();
      refreshLists();
      setEditing(false);
    } catch (error) {
      Alert.alert('No se pudo guardar', String(error.response?.data?.name?.[0] || 'Intenta de nuevo.'));
    }
  };
  const remove = () => confirm(`¿Borrar la colección "${data?.name}"? Las publicaciones siguen en tus guardados.`, async () => {
    await api.delete(`collections/${collectionId}/`);
    refreshLists();
    onBack();
  });
  const removeItem = async (taskId) => {
    await api.delete(`collections/${collectionId}/items/${taskId}/`);
    refetch();
    refreshLists();
  };

  return (
    <View style={styles.detail}>
      <TouchableOpacity style={styles.back} onPress={onBack} accessibilityLabel="Volver a las colecciones">
        <Ionicons name="chevron-back" size={18} color="#1864ab" />
        <Text style={styles.backText}>Colecciones</Text>
      </TouchableOpacity>
      {isLoading || !data ? <ActivityIndicator color="#4dabf7" style={styles.loader} /> : (
        <>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={60} autoFocus accessibilityLabel="Nombre de la colección" />
              <TouchableOpacity style={styles.smallButton} onPress={() => update({ name })} accessibilityLabel="Guardar nombre">
                <Ionicons name="checkmark" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.titleRow}>
              <Text style={styles.detailTitle}>{data.name}</Text>
              {isOwner ? (
                <>
                  <TouchableOpacity onPress={() => { setName(data.name); setEditing(true); }} accessibilityLabel="Cambiar nombre">
                    <Ionicons name="pencil-outline" size={18} color="#4dabf7" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={remove} accessibilityLabel="Borrar colección">
                    <Ionicons name="trash-outline" size={18} color="#e03131" />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          )}
          {isOwner ? (
            <View style={styles.privacyRow}>
              <Text style={styles.privacyText}>{data.is_private ? 'Solo tú la ves' : 'Se ve en tu perfil'}</Text>
              <Switch
                value={!data.is_private}
                onValueChange={(value) => update({ is_private: !value })}
                trackColor={{ true: '#a5d8ff', false: '#dee2e6' }}
                thumbColor={!data.is_private ? '#4dabf7' : '#adb5bd'}
                accessibilityLabel="Colección pública"
              />
            </View>
          ) : null}
          {data.items.length === 0 ? (
            <Text style={styles.empty}>
              {isOwner ? 'Aún está vacía. Agrega publicaciones desde su menú ⋮ → "Guardar en una colección".' : 'Esta colección está vacía.'}
            </Text>
          ) : data.items.map((item) => (
            <View key={item.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => navigation.navigate('TaskDetail', { taskId: item.task.id })}
                accessibilityLabel={`Abrir ${item.task.title || 'publicación'}`}
              >
                <View style={styles.taskIcon}><Ionicons name="document-text-outline" size={20} color="#4dabf7" /></View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.task.title || 'Publicación'}</Text>
                  <Text style={styles.cardSubtitle} numberOfLines={1}>de @{item.task.user?.username || 'usuario'}</Text>
                </View>
              </TouchableOpacity>
              {isOwner ? (
                <TouchableOpacity onPress={() => removeItem(item.task.id)} accessibilityLabel={`Quitar ${item.task.title} de la colección`}>
                  <Ionicons name="close-circle-outline" size={20} color="#adb5bd" />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
        </>
      )}
    </View>
  );
};

/**
 * Colecciones (álbumes) dentro de guardados, en Favoritos. Sin `userId`: las mías (todas,
 * y puedo crear); de otra persona, solo las públicas.
 */
const SaveCollectionsPanel = ({ userId = null, navigation }) => {
  const isOwner = !userId;
  const queryClient = useQueryClient();
  const { data: collections = [], isLoading } = useCollections(userId);
  const [openId, setOpenId] = useState(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      await api.post('collections/', { name });
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    } catch (error) {
      Alert.alert('No se pudo crear', String(error.response?.data?.name?.[0] || error.response?.data?.detail || 'Intenta de nuevo.'));
    } finally {
      setCreating(false);
    }
  };

  if (openId) {
    return <CollectionDetail collectionId={openId} isOwner={isOwner} navigation={navigation} onBack={() => setOpenId(null)} />;
  }

  return (
    <View>
      {isOwner ? (
        <View style={styles.editRow}>
          <TextInput
            style={styles.input}
            placeholder="Nueva colección..."
            placeholderTextColor="#999"
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={create}
            maxLength={60}
            accessibilityLabel="Nombre de la nueva colección"
          />
          <TouchableOpacity style={styles.smallButton} onPress={create} disabled={creating} accessibilityLabel="Crear colección">
            {creating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="add" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
      ) : null}
      {isLoading ? <ActivityIndicator color="#4dabf7" style={styles.loader} /> : null}
      {!isLoading && collections.length === 0 ? (
        <Text style={styles.empty}>
          {isOwner ? 'Crea álbumes para ordenar tus guardados.' : 'No tiene colecciones públicas.'}
        </Text>
      ) : null}
      {collections.map((collection) => (
        <TouchableOpacity
          key={collection.id}
          style={styles.card}
          onPress={() => setOpenId(collection.id)}
          accessibilityRole="button"
          accessibilityLabel={`Abrir colección ${collection.name}`}
        >
          <View style={[styles.taskIcon, styles.albumIcon]}>
            <Ionicons name="albums" size={20} color="#845ef7" />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle} numberOfLines={1}>{collection.name}</Text>
            <Text style={styles.cardSubtitle}>
              {collection.count} {collection.count === 1 ? 'publicación' : 'publicaciones'}
            </Text>
          </View>
          {isOwner ? (
            <Ionicons name={collection.is_private ? 'lock-closed' : 'eye-outline'} size={16} color="#868e96" />
          ) : null}
          <Ionicons name="chevron-forward" size={18} color="#ced4da" />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: '#868e96', marginTop: 24, marginHorizontal: 12 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  input: { flex: 1, height: 40, borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e9ecef', color: '#333' },
  smallButton: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10 },
  cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e7f5ff' },
  albumIcon: { backgroundColor: '#f3f0ff' },
  cardText: { flex: 1 },
  cardTitle: { color: '#212529', fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: '#868e96', fontSize: 12, marginTop: 3 },
  detail: {},
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  backText: { color: '#1864ab', fontWeight: '700' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  detailTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#212529' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  privacyText: { color: '#555', fontSize: 13 },
});

export default SaveCollectionsPanel;
