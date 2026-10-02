import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import api, { saveAuthData } from '@api';
import { AuthContext } from '@app';
import { validateEmailOrUsername, validatePassword, runValidations } from '../utils/validation';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});       // errores por campo
  const [serverError, setServerError] = useState(''); // error global del servidor
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useContext(AuthContext);
  const passwordRef = useRef(null);

  // AbortController: cancela la petición si el usuario sale antes de que responda
  const abortControllerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Limpia el error de un campo al empezar a escribir
  const clearFieldError = (field) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    if (serverError) setServerError('');
  };

  const handleLogin = async () => {
    if (isLoading) return;

    // Validación en tiempo real antes de enviar
    const fieldErrors = runValidations({
      email:    () => validateEmailOrUsername(email),
      password: () => validatePassword(password),
    });

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setServerError('');

    try {
      const payload = { password };
      if (email.trim().includes('@')) {
        payload.email = email.trim();
      } else {
        payload.username = email.trim();
      }

      const response = await api.post('auth/login/', payload, {
        signal: abortControllerRef.current.signal,
      });

      await saveAuthData(response.data);
      signIn(response.data.access);

    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;

      const backendData = error.response?.data;
      let message = 'No se pudo iniciar sesión. Revisa tus credenciales.';

      if (backendData) {
        if (backendData.detail) {
          message = backendData.detail;
        } else if (backendData.non_field_errors?.length) {
          message = backendData.non_field_errors[0];
        } else if (typeof backendData === 'object') {
          message = Object.values(backendData).flat().join(' ');
        }
      }

      setServerError(String(message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Iniciar sesión</Text>

        {/* Email / Username */}
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Email o usuario"
          value={email}
          onChangeText={(v) => { setEmail(v); clearFieldError('email'); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

        {/* Contraseña */}
        <TextInput
          ref={passwordRef}
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={(v) => { setPassword(v); clearFieldError('password'); }}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />
        {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

        {/* Error global del servidor */}
        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Ingresar</Text>
          }
        </TouchableOpacity>

        <View style={styles.registerLink}>
          <Text style={styles.linkText}>¿No tienes cuenta?{' '}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.linkText, styles.linkAction]}>Regístrate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 28,
    textAlign: 'center',
    color: '#1a1a2e',
  },
  input: {
    height: 50,
    borderColor: '#cccccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 4,
    backgroundColor: '#fafafa',
    fontSize: 15,
  },
  inputError: {
    borderColor: '#e74c3c',
    backgroundColor: '#fff5f5',
  },
  fieldError: {
    color: '#e74c3c',
    fontSize: 12,
    marginBottom: 10,
    marginLeft: 4,
  },
  serverError: {
    color: '#e74c3c',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 10,
    backgroundColor: '#fff5f5',
    padding: 10,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#4dabf7',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },
  linkText: {
    color: '#555',
    fontSize: 14,
  },
  linkAction: {
    color: '#4dabf7',
    fontWeight: '600',
  },
});

export default LoginScreen;