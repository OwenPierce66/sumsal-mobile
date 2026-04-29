import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import api, { saveAuthData } from '../api';

const CreateTaskScreen = ({ navigation }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tema, setTema] = useState('consejos');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('new-categories/');
      setCategories(response.data.results ?? response.data ?? []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  };

  const toggleCategory = categoryId => {
    if (selectedCategories.includes(categoryId)) {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    } else {
      setSelectedCategories([...selectedCategories, categoryId]);
    }
  };

  const handleCreateTask = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Error', 'Título y descripción son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const headers = await authHeaders();
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('pch', tema);
      formData.append('categories', selectedCategories.join(','));

      if (selectedImage) {
        formData.append('image', {
          uri: selectedImage.uri,
          type: 'image/jpeg',
          name: `task_${Date.now()}.jpg`,
        });
      }

      const response = await api.post('tasks/', formData, {
        headers: {
          ...headers,
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Éxito', 'Tarea creada correctamente');
      navigation.goBack();
    } catch (error) {
      const message = error.response?.data?.detail || 'Error al crear la tarea';
      Alert.alert('Error', String(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nueva Tarea</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.form}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Tipo de contenido *</Text>
          <View style={styles.temaSelector}>
            {['consejos', 'peticiones', 'historias'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.temaBadge, tema === t && styles.temaBadgeActive]}
                onPress={() => setTema(t)}
              >
                <Text style={[styles.temaBadgeText, tema === t && styles.temaBadgeTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Título *</Text>
          <TextInput
            style={styles.input}
            placeholder="Escribe un título atractivo"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            placeholderTextColor="#999"
          />
          <Text style={styles.charCount}>{title.length}/100</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Descripción *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe tu contenido en detalle"
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
            multiline
            placeholderTextColor="#999"
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Categorías</Text>
          {loadingCategories ? (
            <ActivityIndicator size="small" color="#4dabf7" />
          ) : (
            <View style={styles.categoriesContainer}>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    selectedCategories.includes(cat.id) && styles.categoryChipActive,
                  ]}
                  onPress={() => toggleCategory(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selectedCategories.includes(cat.id) && styles.categoryChipTextActive,
                    ]}
                  >
                    {selectedCategories.includes(cat.id) && '✓ '}
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Imagen (opcional)</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {selectedImage ? (
              <>
                <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close" size={20} color="#fff" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="image-outline" size={40} color="#4dabf7" />
                <Text style={styles.imagePickerText}>Seleccionar imagen</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
          onPress={handleCreateTask}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Crear Tarea</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  form: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'right',
  },
  temaSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  temaBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
  },
  temaBadgeActive: {
    backgroundColor: '#4dabf7',
  },
  temaBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  temaBadgeTextActive: {
    color: '#fff',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4dabf7',
  },
  categoryChipActive: {
    backgroundColor: '#4dabf7',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4dabf7',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  imagePicker: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#4dabf7',
    borderStyle: 'dashed',
    borderRadius: 8,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 6,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePickerText: {
    fontSize: 14,
    color: '#4dabf7',
    marginTop: 8,
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#4dabf7',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default CreateTaskScreen;
