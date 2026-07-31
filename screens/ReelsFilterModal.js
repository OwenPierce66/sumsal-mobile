﻿﻿﻿import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const FilterOption = ({ label, value, selectedValue, onSelect }) => (
  <TouchableOpacity
    style={[styles.option, selectedValue === value && styles.optionSelected]}
    onPress={() => onSelect(value)}
  >
    <Text style={[styles.optionText, selectedValue === value && styles.optionTextSelected]}>
      {label}
    </Text>
  </TouchableOpacity>
);

const ReelsFilterModal = ({
  visible,
  onClose,
  onApply,
  currentSortBy,
  currentDateFilter,
}) => {
  const [sortBy, setSortBy] = useState(currentSortBy);
  const [dateFilter, setDateFilter] = useState(currentDateFilter);

  useEffect(() => {
    setSortBy(currentSortBy);
    setDateFilter(currentDateFilter);
  }, [visible, currentSortBy, currentDateFilter]);

  const handleApply = () => {
    onApply({
      sort_by: sortBy,
      date_filter: dateFilter,
    });
    onClose();
  };

  const handleReset = () => {
    setSortBy('all');
    setDateFilter('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Filtros</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView>
            <Text style={styles.sectionTitle}>Ordenar por</Text>
            <View style={styles.optionsContainer}>
              <FilterOption label="Todas" value="all" selectedValue={sortBy} onSelect={setSortBy} />
              <FilterOption label="Recientes" value="recent" selectedValue={sortBy} onSelect={setSortBy} />
              <FilterOption label="Más gustados" value="likes" selectedValue={sortBy} onSelect={setSortBy} />
            </View>

            <Text style={styles.sectionTitle}>Fecha de publicación</Text>
            <View style={styles.optionsContainer}>
              <FilterOption label="Cualquier fecha" value="" selectedValue={dateFilter} onSelect={setDateFilter} />
              <FilterOption label="Hoy" value="today" selectedValue={dateFilter} onSelect={setDateFilter} />
              <FilterOption label="Esta semana" value="week" selectedValue={dateFilter} onSelect={setDateFilter} />
              <FilterOption label="Este mes" value="month" selectedValue={dateFilter} onSelect={setDateFilter} />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Limpiar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '60%', padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#555', marginTop: 15, marginBottom: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 10 },
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#f0f0f0', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  option: { paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#f0f0f0', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  optionSelected: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  optionText: { color: '#333', fontWeight: '500' },
  optionText: { color: '#333', fontWeight: '500', fontSize: 13 },
  optionTextSelected: { color: '#fff', fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee', marginTop: 'auto' },
  resetButton: { padding: 12, borderRadius: 10 },
  resetButtonText: { color: '#555', fontWeight: 'bold' },
  applyButton: { backgroundColor: '#4dabf7', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 10 },
  applyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});

export default ReelsFilterModal;
