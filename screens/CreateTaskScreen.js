import React, { useState } from 'react';
import { 
  View, Text, TextInput, ScrollView, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, Image, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';

const CreateTaskScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tema, setTema] = useState('consejos'); 
  
  const [subtasks, setSubtasks] = useState([{ title: '', description: '', image: null }]);
  const [subfactores, setSubfactores] = useState([{ title: '', description: '', image: null }]);
  const [subfuentes, setSubfuentes] = useState([{ title: '', description: '', image: null }]);

  const pickImage = async (state, setState, index) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const newState = [...state];
      newState[index].image = result.assets[0].uri;
      setState(newState);
    }
  };

  const addBlock = (state, setState) => {
    setState([...state, { title: '', description: '', image: null }]);
  };

  const removeBlock = (state, setState, indexToRemove) => {
    setState(state.filter((_, index) => index !== indexToRemove));
  };

  const handleCreate = async () => {
    if (loading) return; 

    if (!title.trim()) {
      return Alert.alert("Falta información", "El título principal es obligatorio.");
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('pch', tema);
    
    // Función asíncrona PRO: Respeta el await y convierte las imágenes
    const appendArrayToFormData = async (array, prefix) => {
      for (let index = 0; index < array.length; index++) {
        const item = array[index];
        if (item.title.trim()) {
          formData.append(`${prefix}[${index}][title]`, item.title);
          formData.append(`${prefix}[${index}][description]`, item.description);
          
          if (item.image) {
            if (Platform.OS === 'web') {
              // Convertimos la URI del navegador en un archivo Blob real
              const response = await fetch(item.image);
              const blob = await response.blob();
              formData.append(`${prefix}[${index}][image]`, blob, `${prefix}_${index}.jpg`);
            } else {
              // Formato nativo para celular
              const uriParts = item.image.split('.');
              const fileType = uriParts[uriParts.length - 1] || 'jpg';
              formData.append(`${prefix}[${index}][image]`, {
                uri: item.image,
                name: `${prefix}_${index}.${fileType}`,
                type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
              });
            }
          }
        }
      }
    };

    try {
      // Usamos AWAIT para asegurar que las imágenes se carguen antes de enviar
      await appendArrayToFormData(subtasks, 'subtasks');
      await appendArrayToFormData(subfactores, 'subfactores');
      await appendArrayToFormData(subfuentes, 'subfuentes');

      // Forzamos el multipart para que envíe archivos
      await api.post('tasks/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      Alert.alert("¡Éxito!", "Aportación creada correctamente en Sumsal.");
      navigation.goBack();
    } catch (error) {
      console.error("Error creando tarea:", error.response?.data || error.message);
      Alert.alert("Error", "Hubo un problema al subir la información.");
    } finally {
      setLoading(false);
    }
  };

  const renderSection = (title, state, setState) => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {state.map((item, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardHeader}>
            <TextInput
              style={styles.subInputTitle}
              placeholder={`Título del ${title.slice(0, -1)}`}
              value={item.title}
              onChangeText={(txt) => {
                const newState = [...state];
                newState[index].title = txt;
                setState(newState);
              }}
            />
            {state.length > 1 && (
              <TouchableOpacity onPress={() => removeBlock(state, setState, index)}>
                <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
              </TouchableOpacity>
            )}
          </View>
          
          <TextInput
            style={styles.subInputDesc}
            placeholder="Descripción..."
            value={item.description}
            multiline
            onChangeText={(txt) => {
              const newState = [...state];
              newState[index].description = txt;
              setState(newState);
            }}
          />

          <TouchableOpacity onPress={() => pickImage(state, setState, index)} style={styles.imagePicker}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.preview} resizeMode="cover" />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={24} color="#999" />
                <Text style={styles.placeholderText}>Añadir Imagen</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={() => addBlock(state, setState)} style={styles.addBtn}>
        <Ionicons name="add-circle-outline" size={20} color="#4dabf7" />
        <Text style={styles.addBtnText}>Añadir otro {title.slice(0, -1)}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <View style={styles.mainBlock}>
        <TextInput 
          style={styles.mainTitleInput} 
          value={title} 
          onChangeText={setTitle} 
          placeholder="¿Qué objetivo quieres compartir?" 
          placeholderTextColor="#999"
        />
        <TextInput 
          style={styles.mainDescInput} 
          value={description} 
          onChangeText={setDescription} 
          placeholder="Agrega una descripción general (opcional)..." 
          multiline
          placeholderTextColor="#aaa"
        />
        
        <View style={styles.temaContainer}>
          {['consejos', 'peticiones', 'historias'].map(t => (
            <TouchableOpacity 
              key={t} 
              style={[styles.temaBtn, tema === t && styles.temaBtnActive]}
              onPress={() => setTema(t)}
            >
              <Text style={[styles.temaText, tema === t && styles.temaTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {renderSection("Aportaciones", subtasks, setSubtasks)}
      {renderSection("Factores", subfactores, setSubfactores)}
      {renderSection("Fuentes", subfuentes, setSubfuentes)}

      <TouchableOpacity 
        onPress={handleCreate} 
        style={[styles.submitBtn, loading && styles.submitBtnDisabled]} 
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="send" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>PUBLICAR ÉXITO</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FEF6F5', padding: 16 },
  mainBlock: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 4 },
  mainTitleInput: { fontSize: 20, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, marginBottom: 10, color: '#333' },
  mainDescInput: { fontSize: 15, color: '#666', minHeight: 60, marginBottom: 15 },
  temaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  temaBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f0f0f0', flex: 0.31, alignItems: 'center' },
  temaBtnActive: { backgroundColor: '#333' },
  temaText: { fontSize: 11, fontWeight: 'bold', color: '#666' },
  temaTextActive: { color: '#fff' },
  sectionContainer: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#333', marginBottom: 10, marginLeft: 5 },
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  subInputTitle: { flex: 1, fontSize: 16, fontWeight: 'bold', color: '#333' },
  subInputDesc: { fontSize: 14, color: '#666', minHeight: 40, marginBottom: 10 },
  imagePicker: { height: 120, backgroundColor: '#f9f9f9', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e0e0e0', borderStyle: 'dashed' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { marginTop: 5, color: '#999', fontSize: 12, fontWeight: '500' },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, gap: 5 },
  addBtnText: { color: '#4dabf7', fontWeight: 'bold', fontSize: 14 },
  submitBtn: { backgroundColor: '#4dabf7', flexDirection: 'row', padding: 18, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 10, elevation: 3 },
  submitBtnDisabled: { backgroundColor: '#9bcbf5' },
  submitBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});

export default CreateTaskScreen;