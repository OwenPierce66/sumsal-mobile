import React, { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';

const FilterModal = ({ visible, onClose, onApply, currentCategory, currentDateFilter }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory || '');
  const [selectedDateFilter, setSelectedDateFilter] = useState(currentDateFilter || '');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    setSelectedCategory(currentCategory || '');
    setSelectedDateFilter(currentDateFilter || '');
  }, [currentCategory, currentDateFilter, visible]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('new-categories/');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const dateOptions = [
    { label: 'Cualquier fecha', value: '' },
    { label: 'Hoy', value: 'hoy' },
    { label: 'Esta semana', value: 'esta_semana' },
    { label: 'Este mes', value: 'este_mes' },
  ];

  const handleApply = () => {
    onApply({
      category: selectedCategory,
      date_filter: selectedDateFilter,
    });
    onClose();
  };

  const handleClear = () => {
    setSelectedCategory('');
    setSelectedDateFilter('');
    onApply({
      category: '',
      date_filter: '',
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filtros</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>Fecha</Text>
            <View style={styles.optionsContainer}>
              {dateOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionBadge,
                    selectedDateFilter === option.value && styles.optionBadgeActive,
                  ]}
                  onPress={() => setSelectedDateFilter(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedDateFilter === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Categoría</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionBadge,
                  selectedCategory === '' && styles.optionBadgeActive,
                ]}
                onPress={() => setSelectedCategory('')}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedCategory === '' && styles.optionTextActive,
                  ]}
                >
                  Todas
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.optionBadge,
                    selectedCategory === cat.name && styles.optionBadgeActive,
                  ]}
                  onPress={() => setSelectedCategory(cat.name)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedCategory === cat.name && styles.optionTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Aplicar Filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    marginTop: 10,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionBadgeActive: {
    backgroundColor: '#4dabf7',
    borderColor: '#4dabf7',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  clearBtn: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  applyBtn: {
    flex: 2,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#4dabf7',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default FilterModal;