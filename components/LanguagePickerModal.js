import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslationLanguage } from '@hooks/useTranslationLanguage';
import { LANGUAGE_NAMES } from '../utils/translation';

/**
 * Selector de "Mi idioma": el idioma al que se traducen los mensajes que
 * recibes cuando mantienes presionado un mensaje y eliges "Traducir".
 */
const LanguagePickerModal = ({ visible, onClose }) => {
  const { language, supported, configured, isLoading, isError, refetch, setLanguage, isSaving } =
    useTranslationLanguage();

  // Si el backend aún no responde, se ofrece la lista de respaldo.
  const options = supported.length
    ? supported
    : Object.entries(LANGUAGE_NAMES).map(([code, name]) => ({ code, name }));

  const handleSelect = async (code) => {
    if (code === language) {
      onClose();
      return;
    }
    try {
      await setLanguage(code);
      onClose();
    } catch (error) {
      const message = 'No se pudo cambiar el idioma. Inténtalo de nuevo.';
      if (Platform.OS === 'web') window.alert(message);
      else Alert.alert('Mi idioma', message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Mi idioma</Text>
          <Text style={styles.subtitle}>
            Los mensajes se traducirán a este idioma cuando elijas «Traducir».
          </Text>
          {!configured ? (
            <Text style={styles.notice}>El traductor todavía no está activado en el servidor.</Text>
          ) : null}
          {isLoading ? <ActivityIndicator color="#4dabf7" style={styles.loader} /> : null}
          {isError ? (
            <TouchableOpacity onPress={() => refetch()}>
              <Text style={styles.retry}>No se pudo cargar. Toca para reintentar.</Text>
            </TouchableOpacity>
          ) : null}
          {options.map(({ code, name }) => (
            <TouchableOpacity
              key={code}
              style={styles.option}
              onPress={() => handleSelect(code)}
              disabled={isSaving}
            >
              <Text style={[styles.optionText, code === language && styles.optionTextActive]}>{name}</Text>
              {code === language ? <Ionicons name="checkmark" size={20} color="#4dabf7" /> : null}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '800', color: '#222' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 8 },
  notice: { fontSize: 12, color: '#e8590c', marginBottom: 8 },
  loader: { marginVertical: 8 },
  retry: { fontSize: 13, color: '#e03131', marginVertical: 8 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  optionText: { fontSize: 16, color: '#333' },
  optionTextActive: { color: '#228be6', fontWeight: '700' },
  cancel: { alignItems: 'center', paddingTop: 14 },
  cancelText: { fontSize: 15, color: '#666', fontWeight: '600' },
});

export default LanguagePickerModal;
