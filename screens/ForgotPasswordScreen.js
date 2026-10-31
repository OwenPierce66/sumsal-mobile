/**
 * screens/ForgotPasswordScreen.js
 *
 * Recuperar la contraseña: se pide un código al correo y con él se elige una nueva.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import api from '@api';
import {
  validateEmail, validatePassword, validatePasswordConfirm, runValidations,
} from '../utils/validation';

const RESEND_SECONDS = 60;
// El servidor gratis se duerme: la primera petición puede tardar cerca de un minuto.
const SLOW_SERVER_TIMEOUT_MS = 90000;

const ForgotPasswordScreen = ({ navigation, route }) => {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(route?.params?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const clearFieldError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
    if (serverError) setServerError('');
  };

  const showError = (error, fallback) => {
    const data = error.response?.data;
    if (data?.email || data?.code || data?.new_password) {
      setErrors({ email: data.email?.[0], code: data.code?.[0], password: data.new_password?.join(' ') });
      return;
    }
    setServerError(data?.detail ? String(data.detail) : fallback);
  };

  const sendCode = async () => {
    if (isLoading) return;
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }
    setIsLoading(true);
    setErrors({});
    setServerError('');
    try {
      await api.post('auth/password-reset/', { email: email.trim() }, { timeout: SLOW_SERVER_TIMEOUT_MS });
      setStep('code');
      setResendIn(RESEND_SECONDS);
    } catch (error) {
      showError(error, 'No se pudo enviar el código. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async () => {
    if (isLoading) return;
    const fieldErrors = runValidations({
      code: () => (/^\d{6}$/.test(code.trim()) ? null : 'Escribe los 6 dígitos del código.'),
      password: () => validatePassword(password),
      confirmPassword: () => validatePasswordConfirm(password, confirmPassword),
    });
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    setErrors({});
    setServerError('');
    try {
      const response = await api.post(
        'auth/password-reset/confirm/',
        { email: email.trim(), code: code.trim(), new_password: password },
        { timeout: SLOW_SERVER_TIMEOUT_MS },
      );
      navigation.navigate('Login', { email: response.data.email || email.trim(), notice: response.data.detail });
    } catch (error) {
      showError(error, 'No se pudo cambiar la contraseña. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailStep = () => (
    <>
      <Text style={styles.hint}>Escribe el correo de tu cuenta y te enviaremos un código.</Text>
      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="Correo"
        value={email}
        onChangeText={(value) => { setEmail(value); clearFieldError('email'); }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="send"
        onSubmitEditing={sendCode}
      />
      {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
      {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={sendCode}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar código</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.link} onPress={() => navigation.goBack()}>
        <Text style={styles.linkAction}>Volver a iniciar sesión</Text>
      </TouchableOpacity>
    </>
  );

  const renderCodeStep = () => (
    <>
      <Text style={styles.hint}>
        Si existe una cuenta con {email.trim()}, te enviamos un código de 6 dígitos. Vence en 15 minutos; si no lo ves, revisa spam.
      </Text>
      <TextInput
        style={[styles.input, errors.code && styles.inputError]}
        placeholder="Código de 6 dígitos"
        value={code}
        onChangeText={(value) => { setCode(value); clearFieldError('code'); }}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      {errors.code ? <Text style={styles.fieldError}>{errors.code}</Text> : null}

      <TextInput
        ref={passwordRef}
        style={[styles.input, errors.password && styles.inputError]}
        placeholder="Contraseña nueva"
        secureTextEntry
        value={password}
        onChangeText={(value) => { setPassword(value); clearFieldError('password'); }}
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

      <TextInput
        ref={confirmRef}
        style={[styles.input, errors.confirmPassword && styles.inputError]}
        placeholder="Repite la contraseña nueva"
        secureTextEntry
        value={confirmPassword}
        onChangeText={(value) => { setConfirmPassword(value); clearFieldError('confirmPassword'); }}
        returnKeyType="done"
        onSubmitEditing={changePassword}
      />
      {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
      {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={changePassword}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Cambiar contraseña</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.link} onPress={sendCode} disabled={isLoading || resendIn > 0}>
        <Text style={resendIn > 0 ? styles.linkMuted : styles.linkAction}>
          {resendIn > 0 ? `Reenviar código en ${resendIn} s` : 'Reenviar código'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.link}
        onPress={() => { setStep('email'); setErrors({}); setServerError(''); }}
      >
        <Text style={styles.linkAction}>Usar otro correo</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Recuperar contraseña</Text>
        {step === 'email' ? renderEmailStep() : renderCodeStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: '#1a1a2e' },
  hint: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20 },
  input: {
    height: 50,
    borderColor: '#cccccc',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: '#fafafa',
    fontSize: 15,
  },
  inputError: { borderColor: '#e74c3c', backgroundColor: '#fff5f5' },
  fieldError: { color: '#e74c3c', fontSize: 12, marginBottom: 10, marginLeft: 4 },
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', marginTop: 18 },
  linkAction: { color: '#4dabf7', fontSize: 14, fontWeight: '600' },
  linkMuted: { color: '#868e96', fontSize: 14 },
});

export default ForgotPasswordScreen;
