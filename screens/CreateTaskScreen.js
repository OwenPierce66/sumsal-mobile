import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, ScrollView, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Video } from 'expo-av';

const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http') && !path.includes('localhost') && !path.includes('127.0.0.1') && !path.includes('192.168.')) {
    return path;
  }
  const IP = Platform.OS === 'web' ? 'localhost' : '192.168.0.115';
  let cleanPath = path;
  if (cleanPath.startsWith('http')) {
    cleanPath = cleanPath.replace(/^https?:\/\/[^\/]+/, '');
  }
  return `http://${IP}:8001${cleanPath.startsWith('/') ? '' : '/'}${cleanPath}`;
};

// ⚡ DICCIONARIO INTELIGENTE DE SUBTEMAS
const PREDEFINED_SUBTEMAS = {
  'programacion': ['React', 'Python', 'Node.js', 'Django', 'React Native', 'JavaScript', 'Frontend', 'Backend'],
  'tecnologia': ['Inteligencia Artificial', 'Ciberseguridad', 'Hardware', 'Software', 'Innovación'],
  'educacion': ['Matemáticas', 'Idiomas', 'Ciencias', 'Historia', 'Pedagogía'],
  'salud': ['Nutrición', 'Ejercicio', 'Bienestar Mental', 'Medicina', 'Psicología'],
  'finanzas': ['Inversiones', 'Ahorro', 'Criptomonedas', 'Emprendimiento', 'Economía'],
  'arte': ['Pintura', 'Música', 'Fotografía', 'Cine', 'Diseño'],
  'deportes': ['Fútbol', 'Baloncesto', 'Tenis', 'Natación', 'Fitness'],
};

const CreateTaskScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tema, setTema] = useState('consejos');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [manualCategories, setManualCategories] = useState('');
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [manualSubcategories, setManualSubcategories] = useState('');
  const [subthemesTree, setSubthemesTree] = useState(PREDEFINED_SUBTEMAS);

  useEffect(() => {
    const loadTree = async () => {
      try {
        const stored = await AsyncStorage.getItem('subthemesTree');
        if (stored) setSubthemesTree(JSON.parse(stored));
      } catch(e){}
    };
    loadTree();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('new-categories/');
        setAvailableCategories(response.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const toggleCategory = (catName) => {
    setSelectedCategories(prev => 
      prev.includes(catName) ? prev.filter(c => c !== catName) : [...prev, catName]
    );
  }; 
  
  const toggleSubcategory = (subcat) => {
    setSelectedSubcategories(prev => 
      prev.includes(subcat) ? prev.filter(c => c !== subcat) : [...prev, subcat]
    );
  };

  const [subtasks, setSubtasks] = useState([{ title: '', description: '', image: null, mediaType: null }]);
  const [subfactores, setSubfactores] = useState([{ title: '', description: '', image: null, mediaType: null }]);
  const [subfuentes, setSubfuentes] = useState([{ title: '', description: '', image: null, mediaType: null }]);

  const pickImage = async (state, setState, index) => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      // ⚡ FIX: Aseguramos que la edición y calidad también apliquen a videos
      allowsEditing: Platform.OS !== 'web', // La edición en web puede ser problemática con videos
      quality: 0.7,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720, // Calidad de exportación para videos
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const newState = [...state];
      newState[index].image = asset.uri;
      
      // ⚡ Detección mejorada para saber si es video en la Web
      let isVideo = asset.type === 'video' || 
                    (asset.mimeType && asset.mimeType.startsWith('video')) ||
                    (asset.uri && asset.uri.startsWith('data:video')) ||
                    (asset.uri && /\.(mp4|mov|avi|mkv|webm)$/i.test(asset.uri));
                    
      newState[index].mediaType = isVideo ? 'video' : 'image';
      setState(newState);
    }
  };

  const addBlock = (state, setState) => {
    setState([...state, { title: '', description: '', image: null, mediaType: null }]);
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
    
    const manualArray = manualCategories.split(',').map(c => c.trim()).filter(Boolean);
    const manualSubArray = manualSubcategories.split(',').map(c => c.trim()).filter(Boolean);
    
    // ⚡ COMBINAMOS CATEGORÍAS Y SUBTEMAS PARA QUE SE GUARDEN Y SE PUEDAN FILTRAR JUNTOS
    const finalCategories = [...new Set([...selectedCategories, ...manualArray, ...selectedSubcategories, ...manualSubArray])];
    formData.append('categories', finalCategories.join(','));
    
    // Función asíncrona PRO: Respeta el await y convierte las imágenes
    const appendArrayToFormData = async (array, prefix) => {
      for (let index = 0; index < array.length; index++) {
        const item = array[index];
        // ⚡ AHORA SE ENVÍA SI HAY TÍTULO, DESCRIPCIÓN O IMAGEN
        if (item.title.trim() || item.description.trim() || item.image) {
          formData.append(`${prefix}[${index}][title]`, item.title.trim() ? item.title : `Elemento ${index + 1}`);
          formData.append(`${prefix}[${index}][description]`, item.description);
          
          if (item.image) {
            let isVideo = item.mediaType === 'video';

            if (Platform.OS === 'web') {
              // Convertimos la URI del navegador en un archivo Blob real
              const response = await fetch(item.image);
              const blob = await response.blob();
              
              // ⚡ FIX: Aseguramos detectar si es video verificando el Blob
              if (blob.type.includes('video')) isVideo = true;
              const fieldName = isVideo ? `${prefix}[${index}][video]` : `${prefix}[${index}][image]`;
              
              formData.append(fieldName, blob, `${prefix}_${index}.${isVideo ? 'mp4' : 'jpg'}`);
            } else {
              // Formato nativo para celular
              const fieldName = isVideo ? `${prefix}[${index}][video]` : `${prefix}[${index}][image]`;
              const uriParts = item.image.split('.');
              let fileType = uriParts[uriParts.length - 1] || 'jpg';
              if (isVideo && (fileType === 'jpg' || fileType === 'jpeg')) fileType = 'mp4';

              formData.append(fieldName, {
                uri: item.image,
                name: `${prefix}_${index}.${fileType}`,
                type: isVideo ? `video/${fileType}` : `image/${fileType === 'jpg' ? 'jpeg' : fileType}` });
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
        headers: { 'Content-Type': 'multipart/form-data' } });
      
      Alert.alert("¡Éxito!", "Aportación creada correctamente en Sumsal.");
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('TasksList');
      }
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
              item.mediaType === 'video' ? (
                <Video
                  source={{ uri: item.image }}
                  style={styles.preview}
                  useNativeControls
                  resizeMode="contain"
                />
              ) : (
                <Image source={{ uri: item.image }} style={styles.preview} contentFit="cover" />
              )
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="image-outline" size={24} color="#999" />
                <Text style={styles.placeholderText}>Añadir Imagen o Video</Text>
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
      <TouchableOpacity 
        style={styles.goBackBtn} 
        onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('TasksList');
          }
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
        <Text style={styles.goBackText}>Regresar</Text>
      </TouchableOpacity>

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

      <View style={styles.categoriesBlock}>
        <Text style={styles.sectionTitle}>Categorías (Opcional)</Text>
        
        {availableCategories.length > 0 && (
          <View style={styles.tagsContainer}>
            {availableCategories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.tagBadge, selectedCategories.includes(cat.name) && styles.tagBadgeActive]}
                onPress={() => toggleCategory(cat.name)}
              >
                <Text style={[styles.tagText, selectedCategories.includes(cat.name) && styles.tagTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TextInput
          style={styles.manualCatInput}
          placeholder="Añadir categorías manuales (separadas por coma)..."
          placeholderTextColor="#999"
          value={manualCategories}
          onChangeText={setManualCategories}
        />
      </View>

      {/* ⚡ BLOQUE INTELIGENTE DE SUBTEMAS INFINITO */}
      {selectedCategories.length > 0 && (
        <>
          {[...selectedCategories, ...selectedSubcategories]
            .filter((value, index, self) => self.indexOf(value) === index) // Evitar duplicados
            .map((theme, idx) => {
            const themeKey = theme.toLowerCase();
            const subs = subthemesTree[themeKey] || [];
            if (subs.length === 0) return null;

            return (
              <View key={`sub-${themeKey}-${idx}`} style={styles.categoriesBlock}>
                <Text style={styles.sectionTitle}>Subtemas de {theme}</Text>
                
                <View style={styles.tagsContainer}>
                  {subs.map((subcat, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.tagBadge, selectedSubcategories.includes(subcat) && styles.tagBadgeActive]}
                      onPress={() => toggleSubcategory(subcat)}
                    >
                      <Text style={[styles.tagText, selectedSubcategories.includes(subcat) && styles.tagTextActive]}>
                        {subcat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}

          <View style={styles.categoriesBlock}>
            <Text style={styles.sectionTitle}>Subtemas Manuales Adicionales</Text>
            <TextInput
              style={styles.manualCatInput}
              placeholder="Añadir subtemas manuales (separados por coma)..."
              placeholderTextColor="#999"
              value={manualSubcategories}
              onChangeText={setManualSubcategories}
            />
          </View>
        </>
      )}

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
  goBackBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingHorizontal: 5 },
  goBackText: { fontSize: 16, fontWeight: 'bold', color: '#333', marginLeft: 8 },
  mainBlock: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 4 },
  mainTitleInput: { fontSize: 20, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10, marginBottom: 10, color: '#333' },
  mainDescInput: { fontSize: 15, color: '#666', minHeight: 60, marginBottom: 15 },
  categoriesBlock: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, elevation: 4 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  tagBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0' },
  tagBadgeActive: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  tagText: { fontSize: 13, color: '#666' },
  tagTextActive: { color: '#fff', fontWeight: 'bold' },
  manualCatInput: { fontSize: 14, backgroundColor: '#f9f9f9', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#eee', color: '#333' },
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