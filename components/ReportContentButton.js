import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@api';

const ReportContentButton = ({ targetType, targetId, color = '#868e96', size = 21 }) => {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      Alert.alert('Falta el motivo', 'Describe brevemente por qué reportas este contenido.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('reports/', {
        target_type: targetType,
        target_id: String(targetId),
        reason: normalizedReason,
      });
      setVisible(false);
      setReason('');
      Alert.alert('Reporte enviado', 'El equipo de moderación revisará el contenido.');
    } catch (error) {
      Alert.alert('No se pudo reportar', error.response?.data?.detail || 'Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!targetId) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Reportar contenido"
        style={styles.trigger}
      >
        <Ionicons name="flag-outline" size={size} color={color} />
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.title}>Reportar contenido</Text>
            <Text style={styles.description}>Cuéntanos qué debería revisar moderación.</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              style={styles.input}
              placeholder="Describe el motivo"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              accessibilityLabel="Motivo del reporte"
            />
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={submit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Enviar reporte</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: { padding: 6 },
  overlay: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { backgroundColor: '#fff', borderRadius: 18, padding: 20 },
  title: { color: '#212529', fontSize: 18, fontWeight: '800' },
  description: { color: '#868e96', fontSize: 13, marginTop: 6 },
  input: { minHeight: 110, borderWidth: 1, borderColor: '#dee2e6', borderRadius: 12, marginTop: 16, padding: 12, color: '#212529' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  cancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14 },
  cancelText: { color: '#495057', fontWeight: '700' },
  submitButton: { minHeight: 40, minWidth: 112, alignItems: 'center', justifyContent: 'center', borderRadius: 20, paddingHorizontal: 14, backgroundColor: '#4dabf7' },
  submitText: { color: '#fff', fontWeight: '700' },
});

export default ReportContentButton;
