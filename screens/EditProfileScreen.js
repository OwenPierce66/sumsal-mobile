import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import api, { getImageUrl } from '../api';
import { AuthContext } from '../App';

const EditProfileScreen = ({ navigation, route }) => {
  const { user: initialUser } = route.params;
  const { refreshCurrentUser } = useContext(AuthContext);

  const [firstName, setFirstName] = useState(initialUser?.first_name || '');
  const [lastName, setLastName] = useState(initialUser?.last_name || '');
  const [username, setUsername] = useState(initialUser?.username || '');
  const [email, setEmail] = useState(initialUser?.email || '');
  const [image, setImage] = useState(null); // Para la nueva imagen seleccionada
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      console.log('[DEBUG] Imagen seleccionada:', JSON.stringify(result.assets[0], null, 2));
      setImage(result.assets[0]);
    }
  };

  const handleSave = async () => {
    if (loading) return;
    setLoading(true);

    console.log('[DEBUG] Iniciando guardado de perfil...');

    const formData = new FormData();
    formData.append('first_name', firstName);
    formData.append('last_name', lastName);
    formData.append('username', username);

    if (image) {
      console.log('[DEBUG] Adjuntando imagen al FormData...');
      if (Platform.OS === 'web') {
        const response = await fetch(image.uri);
        const blob = await response.blob();
        const ext = blob.type.split('/')[1] || 'jpg';
        formData.append('user_image', blob, `profile.${ext}`);
        console.log('[DEBUG] Imagen (web) añadida como blob.');
      } else {
        const uriParts = image.uri.split('.');
        const fileType = uriParts[uriParts.length - 1] || 'jpg';
        formData.append('user_image', {
          uri: image.uri,
          name: `profile.${fileType}`,
          type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
        });
        console.log('[DEBUG] Imagen (nativo) añadida con uri:', image.uri);
      }
    }

    try {
      // Para depurar, es útil ver qué contiene el FormData.
      // Nota: console.log(formData) no muestra los datos directamente en muchos entornos.
      console.log('[DEBUG] Enviando FormData al endpoint /api/users/me/');
      // Usamos PATCH para actualizar parcialmente el perfil
      await api.patch('users/me/', formData);

      await refreshCurrentUser(); // Actualizamos el usuario en el contexto global

      Alert.alert('Éxito', 'Perfil actualizado correctamente.');
      navigation.goBack();
    } catch (error) {
      console.error('--- ERROR ACTUALIZANDO PERFIL ---');
      console.error('Respuesta del servidor:', JSON.stringify(error.response?.data, null, 2));
      console.error('Configuración de la petición:', JSON.stringify(error.config, null, 2));
      Alert.alert('Error', 'No se pudo actualizar el perfil.');
    } finally {
      setLoading(false);
    }
  };

  const currentAvatar = image?.uri || getImageUrl(initialUser?.user_image || initialUser?.profile?.user_image);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Perfil</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
          <Image source={{ uri: currentAvatar }} style={styles.avatar} />
          <View style={styles.avatarOverlay}>
            <Ionicons name="camera" size={24} color="#fff" />
          </View>
        </TouchableOpacity>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Tu nombre"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Apellido</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Tu apellido"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de usuario</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Tu nombre de usuario"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={[styles.input, styles.disabledInput]}
            value={email}
            editable={false} // El email no se puede cambiar
            placeholder="Tu correo electrónico"
            keyboardType="email-address"
          />
        </View>
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  saveBtn: {
    backgroundColor: '#4dabf7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 30,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  disabledInput: {
    backgroundColor: '#e9ecef',
    color: '#6c757d',
  },
});

export default EditProfileScreen;