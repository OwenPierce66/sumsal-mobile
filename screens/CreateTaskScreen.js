import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, ScrollView, TouchableOpacity, 
  StyleSheet, Alert, ActivityIndicator, Platform, Modal, FlatList 
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

// ⚡ ESTILOS DEL SELECTOR DE PERSONAS ETIQUETADAS
const tagStyles = StyleSheet.create({
  container: { marginHorizontal: 15, marginTop: 15 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f0ff',
    borderRadius: 15, paddingHorizontal: 10, paddingVertical: 5, marginRight: 6, marginBottom: 6,
  },
  chipText: { color: '#845ef7', fontSize: 13, fontWeight: '600', marginRight: 4 },
  addTagBtn: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#845ef7',
    borderStyle: 'dashed', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6,
  },
  addTagText: { color: '#845ef7', fontSize: 13, marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  searchInput: {
    backgroundColor: '#f1f3f5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 14, color: '#333', marginBottom: 10,
  },
  userRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f3f5',
  },
  userName: { fontSize: 15, color: '#333' },
  emptyText: { textAlign: 'center', color: '#999', marginVertical: 20 },
  doneBtn: { backgroundColor: '#845ef7', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10 },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  approveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 15, marginTop: 15, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffd43b',
  },
  approveBtnActive: { backgroundColor: '#fff3bf', borderColor: '#f08c00' },
  approveBtnText: { color: '#e67700', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  approveBtnTextActive: { color: '#d9480f' },
});

const CreateTaskScreen = ({ navigation, route }) => {
  const editTask = route?.params?.task || null;
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Al crear (no editar), respeta el PCH que estaba activo en TasksScreen
  const [tema, setTema] = useState(route?.params?.initialPch || 'consejos');
  const [availableCategories, setAvailableCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [manualCategories, setManualCategories] = useState('');
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [manualSubcategories, setManualSubcategories] = useState('');
  const [subthemesTree, setSubthemesTree] = useState(PREDEFINED_SUBTEMAS);
  // ⚡ Personas etiquetadas en la publicación
  const [taggedUsers, setTaggedUsers] = useState([]);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagUsersList, setTagUsersList] = useState([]);
  const [loadingTagUsers, setLoadingTagUsers] = useState(false);
  // ⚡ Aprobación: solo admins pueden poner la etiqueta 'aprobada'
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [loadingApprove, setLoadingApprove] = useState(false);

  const isPodcastTask = selectedCategories.some(
    category => category.trim().toLowerCase() === 'grabar podcast'
  ) || manualCategories.split(',').some(
    category => category.trim().toLowerCase() === 'grabar podcast'
  );

  useEffect(() => {
    if (!editTask) return;
    setTitle(editTask.title || '');
    setDescription(editTask.description || '');
    setTema(editTask.pch || 'consejos');
    setSelectedCategories((editTask.categories || '').split(',').map(value => value.trim()).filter(Boolean));
    setManualCategories('');
    setSelectedSubcategories([]);
    setManualSubcategories('');
    setTaggedUsers(Array.isArray(editTask.tagged_users) ? editTask.tagged_users : []);
    setIsApproved(
      (editTask.categories || '').split(',').map(c => c.trim().toLowerCase()).includes('aprobada')
    );

    const normalizeBlocks = (blocks) => {
      if (!Array.isArray(blocks) || blocks.length === 0) {
        return [{ title: '', description: '', image: null, mediaType: null }];
      }
      return blocks.map(block => ({
        id: block.id,
        title: block.title || '',
        description: block.description || '',
        image: block.image || block.video || null,
        mediaType: block.video ? 'video' : block.image ? 'image' : null,
      }));
    };

    setSubtasks(normalizeBlocks(editTask.subtasks));
    setSubfactores(normalizeBlocks(editTask.subfactores));
    setSubfuentes(normalizeBlocks(editTask.subfuentes));
  }, [editTask]);

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
        // ⚡ Cada PCH tiene sus propias categorías (más las globales)
        const response = await api.get('new-categories/', { params: { pch: tema } });
        const cats = response.data || [];
        setAvailableCategories(cats);
        // Al cambiar de PCH, limpiamos las seleccionadas que no existen en este tema
        const validNames = new Set(cats.map(c => c.name));
        setSelectedCategories(prev => prev.filter(name => validNames.has(name)));
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, [tema, isAdminUser]);

  const toggleCategory = (catName) => {
    if (catName.trim().toLowerCase() === 'aprobada' && !isAdminUser) return;
    setSelectedCategories(prev => {
      const isSelected = prev.includes(catName);
      if (isSelected) {
        return prev.filter(c => c !== catName);
      }
      return [...prev, catName];
    });
  }; 

  useEffect(() => {
    if (!isPodcastTask || isAdminUser) return;
    setSelectedSubcategories(prev => (
      prev.some(subcategory => subcategory.toLowerCase() === 'procesando')
        ? prev
        : [...prev, 'Procesando']
    ));
  }, [isPodcastTask, isAdminUser]);

  useEffect(() => {
    if (isPodcastTask || isAdminUser) return;
    setSelectedSubcategories(prev => prev.filter(
      subcategory => subcategory.toLowerCase() !== 'procesando'
    ));
  }, [isPodcastTask, isAdminUser]);

  const togglePodcastSubcategory = (subcat) => {
    if (isPodcastTask && !isAdminUser && subcat.toLowerCase() === 'procesando') return;
    toggleSubcategory(subcat);
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

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data } = await api.get('verify-admin/');
        setIsAdminUser(Boolean(data?.is_admin));
      } catch (error) {
        setIsAdminUser(false);
      }
    };
    checkAdmin();
  }, []);

  const handleToggleApprove = async () => {
    if (!editTask?.id || loadingApprove) return;
    setLoadingApprove(true);
    try {
      const { data } = await api.post(`tasks/${editTask.id}/approve/`, { approve: !isApproved });
      setIsApproved(Boolean(data?.approved));
      if (data?.categories && editTask) editTask.categories = data.categories;
      Alert.alert(
        'Listo',
        data?.approved
          ? 'Aportación aprobada. Se notificó a las personas etiquetadas. 🎉'
          : 'Aprobación retirada.'
      );
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'No se pudo cambiar la aprobación.');
    } finally {
      setLoadingApprove(false);
    }
  };

  // ⚡ Sincroniza las personas etiquetadas con el backend (endpoint JSON dedicado)
  const syncTaskTags = async (taskId) => {
    if (!taskId) return;
    try {
      await api.post(`tasks/${taskId}/tags/`, { user_ids: taggedUsers.map(u => u.id) });
    } catch (error) {
      console.error('[CreateTaskScreen] Error sincronizando etiquetas:', error.response?.data || error.message);
    }
  };

  const openTagModal = async () => {
    setTagModalVisible(true);
    if (tagUsersList.length > 0) return;
    setLoadingTagUsers(true);
    try {
      const response = await api.get('massaging/users/');
      const users = response.data?.users || [];
      setTagUsersList(users.filter(u => u?.id));
    } catch (error) {
      console.error('[CreateTaskScreen] Error cargando usuarios para etiquetar:', error.response?.data || error.message);
    } finally {
      setLoadingTagUsers(false);
    }
  };

  const toggleTagUser = (user) => {
    setTaggedUsers(prev =>
      prev.some(u => u.id === user.id) ? prev.filter(u => u.id !== user.id) : [...prev, user]
    );
  };

  const handleCreate = async () => {
    if (loading) return; 

    console.log('[CreateTaskScreen] Guardar pulsado:', { editing: Boolean(editTask), taskId: editTask?.id });

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

    if (editTask) {
      if (!editTask.id) {
        console.error('[CreateTaskScreen] La tarea no tiene ID:', editTask);
        Alert.alert('Error', 'No se encontró el identificador de la tarea.');
        setLoading(false);
        return;
      }

      try {
        const updateFormData = new FormData();
        updateFormData.append('title', title.trim());
        updateFormData.append('description', description);
        updateFormData.append('pch', tema);
        updateFormData.append('categories', finalCategories.join(','));

        const appendEditBlocks = async (blocks, prefix) => {
          const activeBlocks = blocks.filter(block => block.title.trim() || block.description.trim() || block.image);
          for (let index = 0; index < activeBlocks.length; index++) {
            const block = activeBlocks[index];
            if (block.id) updateFormData.append(`${prefix}[${index}][id]`, String(block.id));
            updateFormData.append(`${prefix}[${index}][title]`, block.title.trim());
            updateFormData.append(`${prefix}[${index}][description]`, block.description || '');

            if (!block.image || block.image.startsWith('http')) continue;
            let isVideo = block.mediaType === 'video';
            if (Platform.OS === 'web') {
              const fileResponse = await fetch(block.image);
              const blob = await fileResponse.blob();
              isVideo = isVideo || blob.type.startsWith('video/');
              const extension = blob.type.split('/')[1] || (isVideo ? 'mp4' : 'jpg');
              updateFormData.append(`${prefix}[${index}][${isVideo ? 'video' : 'image'}]`, blob, `${prefix}_${index}.${extension}`);
            } else {
              const uriParts = block.image.split('.');
              const extension = uriParts[uriParts.length - 1] || (isVideo ? 'mp4' : 'jpg');
              updateFormData.append(`${prefix}[${index}][${isVideo ? 'video' : 'image'}]`, {
                uri: block.image,
                name: `${prefix}_${index}.${extension}`,
                type: isVideo ? `video/${extension}` : `image/${extension === 'jpg' ? 'jpeg' : extension}`,
              });
            }
          }
        };

        await appendEditBlocks(subtasks, 'subtasks');
        await appendEditBlocks(subfactores, 'subfactores');
        await appendEditBlocks(subfuentes, 'subfuentes');

        console.log('[CreateTaskScreen] Actualizando tarea con multipart:', editTask.id);
        const response = await api.patch(`tasks/${editTask.id}/`, updateFormData);
        console.log('[CreateTaskScreen] Tarea actualizada:', {
          id: response.data?.id,
          title: response.data?.title,
          description: response.data?.description,
          pch: response.data?.pch,
          categories: response.data?.categories,
          subtasks: response.data?.subtasks?.length,
          subfactores: response.data?.subfactores?.length,
          subfuentes: response.data?.subfuentes?.length,
        });
        await syncTaskTags(editTask.id);
        Alert.alert("¡Éxito!", "Aportación actualizada correctamente.");
        navigation.goBack();
      } catch (error) {
        console.error("Error actualizando tarea:", error.response?.data || error.message);
        const detail = error.response?.data?.detail || error.response?.data?.error;
        Alert.alert("Error", detail || "No se pudo actualizar la aportación.");
      } finally {
        setLoading(false);
      }
      return;
    }

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
      const createResponse = await api.post('tasks/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' } });
      const createdTaskId = createResponse?.data?.id;
      if (createdTaskId && taggedUsers.length > 0) {
        await syncTaskTags(createdTaskId);
      }
      
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

      <View style={tagStyles.container}>
        <Text style={styles.sectionTitle}>Etiquetar personas (Opcional)</Text>
        <View style={tagStyles.chipsRow}>
          {taggedUsers.map(u => (
            <View key={u.id} style={tagStyles.chip}>
              <Text style={tagStyles.chipText}>@{u.username || u.first_name || 'usuario'}</Text>
              <TouchableOpacity onPress={() => toggleTagUser(u)}>
                <Ionicons name="close-circle" size={16} color="#845ef7" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={tagStyles.addTagBtn} onPress={openTagModal}>
            <Ionicons name="pricetag-outline" size={18} color="#845ef7" />
            <Text style={tagStyles.addTagText}>Etiquetar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={tagModalVisible} animationType="slide" transparent onRequestClose={() => setTagModalVisible(false)}>
        <View style={tagStyles.modalOverlay}>
          <View style={tagStyles.modalContent}>
            <View style={tagStyles.modalHeader}>
              <Text style={tagStyles.modalTitle}>Etiquetar personas</Text>
              <TouchableOpacity onPress={() => setTagModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={tagStyles.searchInput}
              placeholder="Buscar por usuario o nombre..."
              placeholderTextColor="#999"
              value={tagSearch}
              onChangeText={setTagSearch}
            />
            {loadingTagUsers ? (
              <ActivityIndicator size="large" color="#845ef7" style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={tagUsersList.filter(u => {
                  if (!tagSearch.trim()) return true;
                  const q = tagSearch.trim().toLowerCase();
                  return (u.username || '').toLowerCase().includes(q)
                    || (u.first_name || '').toLowerCase().includes(q)
                    || (u.last_name || '').toLowerCase().includes(q);
                })}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => {
                  const selected = taggedUsers.some(u => u.id === item.id);
                  return (
                    <TouchableOpacity style={tagStyles.userRow} onPress={() => toggleTagUser(item)}>
                      <Text style={tagStyles.userName}>@{item.username || item.first_name || 'usuario'}</Text>
                      <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={22} color={selected ? '#845ef7' : '#999'} />
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={tagStyles.emptyText}>No se encontraron usuarios</Text>}
              />
            )}
            <TouchableOpacity style={tagStyles.doneBtn} onPress={() => setTagModalVisible(false)}>
              <Text style={tagStyles.doneBtnText}>Listo ({taggedUsers.length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isAdminUser && editTask?.id && (
        <TouchableOpacity
          style={[tagStyles.approveBtn, isApproved && tagStyles.approveBtnActive]}
          onPress={handleToggleApprove}
          disabled={loadingApprove}
        >
          {loadingApprove ? (
            <ActivityIndicator size="small" color="#e67700" />
          ) : (
            <Ionicons name="ribbon" size={20} color={isApproved ? '#d9480f' : '#e67700'} />
          )}
          <Text style={[tagStyles.approveBtnText, isApproved && tagStyles.approveBtnTextActive]}>
            {isApproved ? 'Aprobada ✓ (tocar para quitar)' : 'Aprobar aportación'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.categoriesBlock}>
        <Text style={styles.sectionTitle}>Categorías (Opcional)</Text>
        
        {availableCategories.length > 0 && (
          <View style={styles.tagsContainer}>
            {availableCategories
              .filter(cat => isAdminUser || cat.name.trim().toLowerCase() !== 'aprobada')
              .map(cat => (
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

        {isPodcastTask && !isAdminUser && (
          <View style={styles.lockedSubthemeBadge}>
            <Ionicons name="lock-closed" size={14} color="#2b8a3e" />
            <Text style={styles.lockedSubthemeText}>Procesando (obligatorio)</Text>
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
                      onPress={() => togglePodcastSubcategory(subcat)}
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
            <Text style={styles.submitBtnText}>{editTask ? 'GUARDAR CAMBIOS' : 'PUBLICAR ÉXITO'}</Text>
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
  lockedSubthemeBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15,
    backgroundColor: '#d3f9d8', borderWidth: 1, borderColor: '#69db7c',
    marginBottom: 12,
  },
  lockedSubthemeText: { color: '#2b8a3e', fontSize: 13, fontWeight: '700', marginLeft: 5 },
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