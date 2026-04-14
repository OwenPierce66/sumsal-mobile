import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import api, { saveAuthData } from '../api';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email y contraseña son obligatorios.');
      return;
    }

    try {
      const payload = {
        password,
      };

      if (email.includes('@')) {
        payload.email = email;
      } else {
        payload.username = email;
      }

      console.log('Login payload:', payload);

      const response = await api.post('auth/login/', payload);
      await saveAuthData(response.data);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      const backendData = error.response?.data;
      let message = 'No se pudo iniciar sesión. Revisa tus credenciales.';

      if (backendData) {
        if (backendData.detail) {
          message = backendData.detail;
        } else if (backendData.non_field_errors?.length) {
          message = backendData.non_field_errors[0];
        } else if (typeof backendData === 'object') {
          message = Object.values(backendData)
            .flat()
            .join(' ');
        }
      }

      Alert.alert('Login fallido', String(message));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Iniciar sesión</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Ingresar" onPress={handleLogin} />
      <View style={styles.registerLink}>
        <Text>¿No tienes cuenta?</Text>
        <Button title="Registrarse" onPress={() => navigation.navigate('Register')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderColor: '#cccccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
});

export default LoginScreen;