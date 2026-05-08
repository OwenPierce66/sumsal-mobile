import React, { useState, useContext } from 'react'; // ⚡ IMPORTAMOS useContext
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import api, { saveAuthData } from '../api';
import { AuthContext } from '../App'; // ⚡ IMPORTAMOS EL CONTEXTO GLOBAL

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(''); // ⚡ NUEVO ESTADO PARA USERNAME
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // ⚡ Obtenemos signIn del control remoto de App.js
  const { signIn } = useContext(AuthContext);

  const handleRegister = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Email, username y contraseña son obligatorios.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    try {
      const response = await api.post('auth/register/', {
        email,
        username: username.toLowerCase().trim(), // Lo mandamos en minúsculas y sin espacios
        first_name: firstName,
        last_name: lastName,
        password,
      });

      // Guardamos los tokens
      await saveAuthData(response.data);
      
      // ⚡ Le avisamos a App.js que ya hay sesión y entramos directo a Home
      signIn(response.data.access);

    } catch (error) {
      const backendData = error.response?.data;
      let message = 'No se pudo registrar. Verifica los datos.';

      if (backendData) {
        if (backendData.detail) {
          message = backendData.detail;
        } else if (typeof backendData === 'object') {
          message = Object.values(backendData)
            .flat()
            .join(' ');
        }
      }

      Alert.alert('Registro Fallido', String(message));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      {/* ⚡ NUEVO INPUT PARA EL USERNAME */}
      <TextInput
        style={styles.input}
        placeholder="Nombre de usuario (@apodo)"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Nombre real"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Apellido"
        value={lastName}
        onChangeText={setLastName}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirmar contraseña"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      <Button title="Registrarme" onPress={handleRegister} />
      <View style={styles.loginLink}>
        <Text>¿Ya tienes cuenta?</Text>
        <Button title="Ir a Login" onPress={() => navigation.navigate('Login')} />
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
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
});

export default RegisterScreen;