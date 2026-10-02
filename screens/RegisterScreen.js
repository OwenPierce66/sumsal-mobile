import React, { useState, useContext, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import api, { saveAuthData } from '@api';
import { AuthContext } from '@app';
import {
  validateEmail, validateUsername, validatePassword,
  validatePasswordConfirm, runValidations,
} from '../utils/validation';

const RegisterScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { signIn } = useContext(AuthContext);

  // Refs para navegación entre campos con el teclado
  const usernameRef = useRef(null);
  const firstNameRef = useRef(null);
  const lastNameRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const abortControllerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const clearFieldError = (field) => {
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    if (serverError) setServerError('');
  };

  // Re-valida confirmPassword en tiempo real cuando cambia la contraseña
  const handlePasswordChange = (v) => {
    setPassword(v);
    clearFieldError('password');
    if (confirmPassword) {
      const err = validatePasswordConfirm(v, confirmPassword);
      setErrors(prev => ({ ...prev, confirmPassword: err }));
    }
  };

  const handleRegister = async () => {
    if (isLoading) return;

    const fieldErrors = runValidations({
      email:           () => validateEmail(email),
      username:        () => validateUsername(username),
      password:        () => validatePassword(password),
      confirmPassword: () => validatePasswordConfirm(password, confirmPassword),
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
      const response = await api.post(
        'auth/register/',
        {
          email: email.trim(),
          username: username.toLowerCase().trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          password,
        },
        { signal: abortControllerRef.current.signal },
      );

      await saveAuthData(response.data);
      signIn(response.data.access);

    } catch (error) {
      if (error.name === 'CanceledError' || error.name === 'AbortError') return;

      const backendData = error.response?.data;
      let message = 'No se pudo registrar. Verifica los datos.';

      if (backendData) {
        if (backendData.detail) {
          message = backendData.detail;
        } else if (typeof backendData === 'object') {
          // Mapear errores de campo del backend a errores inline
          const fieldMap = {
            email: 'email', username: 'username',
            password: 'password', first_name: 'firstName', last_name: 'lastName',
          };
          const inlineErrors = {};
          let hasInline = false;
          for (const [backendField, stateField] of Object.entries(fieldMap)) {
            if (backendData[backendField]) {
              inlineErrors[stateField] = [].concat(backendData[backendField])[0];
              hasInline = true;
            }
          }
          if (hasInline) {
            setErrors(prev => ({ ...prev, ...inlineErrors }));
            setIsLoading(false);
            return;
          }
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
        <Text style={styles.title}>Crear cuenta</Text>

        {/* Email */}
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Email *"
          value={email}
          onChangeText={(v) => { setEmail(v); clearFieldError('email'); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => usernameRef.current?.focus()}
        />
        {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

        {/* Username */}
        <TextInput
          ref={usernameRef}
          style={[styles.input, errors.username && styles.inputError]}
          placeholder="Nombre de usuario (@apodo) *"
          value={username}
          onChangeText={(v) => { setUsername(v); clearFieldError('username'); }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          onSubmitEditing={() => firstNameRef.current?.focus()}
        />
        {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : null}

        {/* Nombre real */}
        <TextInput
          ref={firstNameRef}
          style={styles.input}
          placeholder="Nombre real"
          value={firstName}
          onChangeText={setFirstName}
          returnKeyType="next"
          onSubmitEditing={() => lastNameRef.current?.focus()}
        />

        {/* Apellido */}
        <TextInput
          ref={lastNameRef}
          style={styles.input}
          placeholder="Apellido"
          value={lastName}
          onChangeText={setLastName}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />

        {/* Contraseña */}
        <TextInput
          ref={passwordRef}
          style={[styles.input, errors.password && styles.inputError]}
          placeholder="Contraseña * (mín. 8 caracteres)"
          secureTextEntry
          value={password}
          onChangeText={handlePasswordChange}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

        {/* Confirmar contraseña */}
        <TextInput
          ref={confirmRef}
          style={[styles.input, errors.confirmPassword && styles.inputError]}
          placeholder="Confirmar contraseña *"
          secureTextEntry
          value={confirmPassword}
          onChangeText={(v) => {
            setConfirmPassword(v);
            setErrors(prev => ({ ...prev, confirmPassword: validatePasswordConfirm(password, v) }));
          }}
          returnKeyType="done"
          onSubmitEditing={handleRegister}
        />
        {errors.confirmPassword
          ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
          : null}

        {/* Error global del servidor */}
        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Registrarme</Text>
          }
        </TouchableOpacity>

        <View style={styles.loginLink}>
          <Text style={styles.linkText}>¿Ya tienes cuenta?{' '}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={[styles.linkText, styles.linkAction]}>Iniciar sesión</Text>
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
    marginBottom: 24,
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
  loginLink: {
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

export default RegisterScreen;