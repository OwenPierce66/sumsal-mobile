/**
 * screens/DeleteAccountScreen.js
 *
 * Eliminar la cuenta para siempre: explica qué se pierde y pide la contraseña y escribir
 * ELIMINAR, para que no ocurra por un toque accidental.
 */
import React, { useContext, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@api';
import { AuthContext } from '@app';

const CONFIRM_WORD = 'ELIMINAR';
// Borrar una cuenta con mucho contenido, con el servidor recién despertado, puede tardar.
const SLOW_SERVER_TIMEOUT_MS = 90000;

const CONSEQUENCES = [
  'Tu perfil, publicaciones, comentarios, likes y guardados.',
  'Tus conversaciones y los archivos que subiste.',
  'Las suscripciones que pagas o recibes: se cancelan al momento y ya no se cobran.',
  'Los grupos que creaste pasan a otro integrante, sin tus publicaciones.',
];

const DeleteAccountScreen = ({ navigation }) => {
  const { signOut } = useContext(AuthContext);
  const [password, setPassword] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const ready = Boolean(password) && confirmWord.trim().toUpperCase() === CONFIRM_WORD;

  const handleDelete = async () => {
    if (!ready || isLoading) return;
    setIsLoading(true);
    setPasswordError('');
    setServerError('');
    try {
      await api.post('users/me/delete/', { password }, { timeout: SLOW_SERVER_TIMEOUT_MS });
      await signOut({ accountDeleted: true });
    } catch (error) {
      const data = error.response?.data;
      if (data?.password) {
        setPasswordError(data.password[0]);
      } else {
        setServerError(data?.detail ? String(data.detail) : 'No se pudo eliminar tu cuenta. Revisa tu conexión e intenta de nuevo.');
      }
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.title}>Eliminar cuenta</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.warning}>
          <Ionicons name="warning" size={22} color="#c92a2a" />
          <Text style={styles.warningText}>Esto no se puede deshacer.</Text>
        </View>

        <Text style={styles.sectionTitle}>Se borrará para siempre:</Text>
        {CONSEQUENCES.map((consequence) => (
          <View key={consequence} style={styles.row}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.rowText}>{consequence}</Text>
          </View>
        ))}

        <Text style={styles.label}>Tu contraseña</Text>
        <TextInput
          style={[styles.input, passwordError && styles.inputError]}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={(value) => { setPassword(value); setPasswordError(''); }}
        />
        {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}

        <Text style={styles.label}>Escribe {CONFIRM_WORD} para confirmar</Text>
        <TextInput
          style={styles.input}
          placeholder={CONFIRM_WORD}
          value={confirmWord}
          onChangeText={setConfirmWord}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <TouchableOpacity
          style={[styles.button, (!ready || isLoading) && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={!ready || isLoading}
          activeOpacity={0.8}
          accessibilityLabel="Eliminar mi cuenta para siempre"
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Eliminar mi cuenta para siempre</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={() => navigation.goBack()} disabled={isLoading}>
          <Text style={styles.cancelText}>Conservar mi cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 34 : 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  back: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#212529' },
  content: { padding: 16, paddingBottom: 40 },
  warning: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#fff5f5' },
  warningText: { flex: 1, fontSize: 15, fontWeight: '800', color: '#c92a2a' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#212529', marginTop: 18, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bullet: { fontSize: 14, color: '#495057' },
  rowText: { flex: 1, fontSize: 14, color: '#495057' },
  label: { fontSize: 14, fontWeight: '700', color: '#343a40', marginTop: 16, marginBottom: 6 },
  input: { height: 48, borderColor: '#cccccc', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#fafafa', fontSize: 15 },
  inputError: { borderColor: '#e74c3c', backgroundColor: '#fff5f5' },
  fieldError: { color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 },
  serverError: { color: '#e74c3c', fontSize: 13, textAlign: 'center', marginTop: 14, backgroundColor: '#fff5f5', padding: 10, borderRadius: 8 },
  button: { backgroundColor: '#e03131', borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { alignItems: 'center', marginTop: 18 },
  cancelText: { color: '#4dabf7', fontSize: 14, fontWeight: '600' },
});

export default DeleteAccountScreen;
