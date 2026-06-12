import React, { useState, useEffect, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';

const ROW_HEIGHT = 45;
const DraggableCategory = ({ cat, index, categories, setCategories, selectedCategory, setSelectedCategory, isSuper, handleDeleteCat, setScrollEnabled, saveCategoriesOrder }) => {
  const pan = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);
  
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        setScrollEnabled(false);
        pan.setOffset(0);
        pan.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dy: pan }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gestureState) => {
        setIsDragging(false);
        setScrollEnabled(true);
        pan.flattenOffset();
        
        const offset = Math.round(gestureState.dy / ROW_HEIGHT);
        let newIndex = index + offset;
        if (newIndex < 0) newIndex = 0;
        if (newIndex >= categories.length) newIndex = categories.length - 1;
        
        if (newIndex !== index) {
          const newCategories = [...categories];
          const [movedItem] = newCategories.splice(index, 1);
          newCategories.splice(newIndex, 0, movedItem);
          setCategories(newCategories);
          saveCategoriesOrder(newCategories);
        }
        
        Animated.spring(pan, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        setScrollEnabled(true);
        Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
      }
    })
  ).current;

  return (
    <Animated.View style={[
      { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginRight: 8, height: ROW_HEIGHT },
      { transform: [{ translateY: pan }], zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.8 : 1 }
    ]}>
      <TouchableOpacity
        style={[
          styles.optionBadge,
          selectedCategory === cat.name && styles.optionBadgeActive,
          isSuper && { paddingRight: 40, marginBottom: 0, marginRight: 0 }
        ]}
        onPress={() => setSelectedCategory(cat.name)}
      >
        <Text style={[styles.optionText, selectedCategory === cat.name && styles.optionTextActive]}>
          {cat.name}
        </Text>
      </TouchableOpacity>
      
      {isSuper && (
        <View {...panResponder.panHandlers} style={{ padding: 10, position: 'absolute', right: 35, zIndex: 10 }}>
          <Ionicons name="menu" size={20} color="#999" />
        </View>
      )}
      
      {isSuper && (
        <TouchableOpacity
          style={{ position: 'absolute', right: 6, top: '50%', marginTop: -10, padding: 8, zIndex: 20, elevation: 10 }}
          onPress={() => handleDeleteCat(cat.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={16} color="#ff6b6b" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const FilterModal = ({ visible, onClose, onApply, currentCategory, currentDateFilter, currentSortBy, currentFavorites, currentFavoriteUsers, currentVerifiedUsers, currentRecommendedUsers }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(currentCategory || '');
  const [selectedDateFilter, setSelectedDateFilter] = useState(currentDateFilter || '');
  const [sortBy, setSortBy] = useState(currentSortBy || 'recent');
  const [favoritesOnly, setFavoritesOnly] = useState(currentFavorites || false);
  const [favoriteUsersOnly, setFavoriteUsersOnly] = useState(currentFavoriteUsers || false);
  const [verifiedUsersOnly, setVerifiedUsersOnly] = useState(currentVerifiedUsers || false);
  const [recommendedUsersOnly, setRecommendedUsersOnly] = useState(currentRecommendedUsers || false);
  const [isSuper, setIsSuper] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [categoriesOrder, setCategoriesOrder] = useState([]);

  useEffect(() => {
    fetchCategories();
    checkSuperStatus();
  }, []);

  const handleDeleteCat = (catId) => { if (Platform.OS === "web") { if (window.confirm("¿Estás seguro de que deseas eliminar esta categoria? Esta acción no se puede deshacer.")) { executeDeleteCat(catId); } } else { Alert.alert("Eliminar Categoria", "¿Estás seguro de que deseas eliminar esta categoria? Esta acción no se puede deshacer.", [{ text: "Cancelar", style: "cancel" }, { text: "Eliminar", style: "destructive", onPress: () => executeDeleteCat(catId) }]); } }; const executeDeleteCat = async (catId) => { try { await api.delete("new-categories/" + catId + "/"); fetchCategories(); if (selectedCategory !== "" && categories.find(c => c.id === catId)?.name === selectedCategory) { setSelectedCategory(""); } } catch (error) { console.error("Error deleting category:", error); } };

  const checkSuperStatus = async () => {
    try {
      const response = await api.get("verify-admin/");
      setIsSuper(response.data?.is_admin || response.data?.is_staff);
    } catch (error) {
      setIsSuper(false);
    }
  };

  const handleCreateCat = async () => {
    if (!newCatName.trim()) return;
    setIsCreating(true);
    try {
      await api.post("new-categories/", { name: newCatName.trim() });
      setNewCatName("");
      fetchCategories();
    } catch (error) {} finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    setSelectedCategory(currentCategory || '');
    setSelectedDateFilter(currentDateFilter || '');
    setSortBy(currentSortBy || 'recent');
    setFavoritesOnly(currentFavorites || false);
    setFavoriteUsersOnly(currentFavoriteUsers || false);
    setVerifiedUsersOnly(currentVerifiedUsers || false);
    setRecommendedUsersOnly(currentRecommendedUsers || false);
  }, [currentCategory, currentDateFilter, currentSortBy, currentFavorites, currentFavoriteUsers, currentVerifiedUsers, currentRecommendedUsers, visible]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('new-categories/');
      let fetchedCats = response.data;
      try {
        const savedOrder = await AsyncStorage.getItem('categoriesOrder');
        if (savedOrder) {
          const orderArray = JSON.parse(savedOrder);
          setCategoriesOrder(orderArray);
          fetchedCats.sort((a, b) => {
            const idxA = orderArray.indexOf(a.id);
            const idxB = orderArray.indexOf(b.id);
            if (idxA === -1 && idxB === -1) return 0;
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
        }
      } catch(e) {}
      setCategories(fetchedCats);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const saveCategoriesOrder = async (newCats) => {
    try {
      const order = newCats.map(c => c.id);
      setCategoriesOrder(order);
      await AsyncStorage.setItem('categoriesOrder', JSON.stringify(order));
    } catch(e) {}
  };

  const dateOptions = [
    { label: 'Cualquier fecha', value: '' },
    { label: 'Hoy', value: 'hoy' },
    { label: 'Esta semana', value: 'esta_semana' },
    { label: 'Este mes', value: 'este_mes' },
  ];

  const sortOptions = [
    { label: 'Más recientes', value: 'recent' },
    { label: 'Más likes', value: 'likes' },
  ];

  const handleApply = () => {
    onApply({
      category: selectedCategory,
      date_filter: selectedDateFilter,
      sort_by: sortBy,
      favorites_only: favoritesOnly,
      favorite_users_only: favoriteUsersOnly,
      verified_users_only: verifiedUsersOnly,
      recommended_users_only: recommendedUsersOnly,
    });
    onClose();
  };

  const handleClear = () => {
    setSelectedCategory('');
    setSelectedDateFilter('');
    setSortBy('recent');
    setFavoritesOnly(false);
    setFavoriteUsersOnly(false);
    setVerifiedUsersOnly(false);
    setRecommendedUsersOnly(false);
    onApply({
      category: '',
      date_filter: '',
      sort_by: 'recent',
      favorites_only: false,
      favorite_users_only: false,
      verified_users_only: false,
      recommended_users_only: false,
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

          <ScrollView style={styles.content} scrollEnabled={scrollEnabled}>
            <Text style={styles.sectionTitle}>Ordenar por</Text>
            <View style={styles.optionsContainer}>
              {sortOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionBadge,
                    sortBy === option.value && styles.optionBadgeActive,
                  ]}
                  onPress={() => setSortBy(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      sortBy === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Especiales</Text>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionBadge,
                  favoritesOnly && styles.optionBadgeActive,
                ]}
                onPress={() => setFavoritesOnly(!favoritesOnly)}
              >
                <Text
                  style={[
                    styles.optionText,
                    favoritesOnly && styles.optionTextActive,
                  ]}
                >
                  Mis Favoritas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionBadge,
                  favoriteUsersOnly && styles.optionBadgeActive,
                ]}
                onPress={() => setFavoriteUsersOnly(!favoriteUsersOnly)}
              >
                <Text
                  style={[
                    styles.optionText,
                    favoriteUsersOnly && styles.optionTextActive,
                  ]}
                >
                  Mis Usuarios Favoritos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionBadge,
                  verifiedUsersOnly && styles.optionBadgeActive,
                ]}
                onPress={() => setVerifiedUsersOnly(!verifiedUsersOnly)}
              >
                <Text
                  style={[
                    styles.optionText,
                    verifiedUsersOnly && styles.optionTextActive,
                  ]}
                >
                  Usuarios Verificados
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionBadge,
                  recommendedUsersOnly && styles.optionBadgeActive,
                ]}
                onPress={() => setRecommendedUsersOnly(!recommendedUsersOnly)}
              >
                <Text
                  style={[
                    styles.optionText,
                    recommendedUsersOnly && styles.optionTextActive,
                  ]}
                >
                  Usuarios Recomendados
                </Text>
              </TouchableOpacity>
            </View>

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
            <View style={[styles.optionsContainer, {flexDirection: 'column'}]}>
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
              {categories.map((cat, index) => (
                <DraggableCategory
                  key={cat.id}
                  cat={cat}
                  index={index}
                  categories={categories}
                  setCategories={setCategories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                  isSuper={isSuper}
                  handleDeleteCat={handleDeleteCat}
                  setScrollEnabled={setScrollEnabled}
                  saveCategoriesOrder={saveCategoriesOrder}
                />
              ))}
            </View>
            {isSuper && (
              <View style={styles.adminSection}>
                <Text style={styles.adminTitle}>Panel Administrador</Text>
                <View style={styles.createCategoryContainer}>
                  <TextInput
                    style={styles.categoryInput}
                    placeholder="Nombre de la categoria..."
                    value={newCatName}
                    onChangeText={setNewCatName}
                  />
                  <TouchableOpacity 
                    style={styles.createCategoryBtn} 
                    onPress={handleCreateCat}
                    disabled={isCreating || !newCatName.trim()}
                  >
                    <Text style={styles.createCategoryBtnText}>Crear</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  adminSection: { marginTop: 20, padding: 15, backgroundColor: '#f8f9fa', borderRadius: 12, borderWidth: 1, borderColor: '#e0e0e0' },
  adminTitle: { fontSize: 16, fontWeight: 'bold', color: '#d9534f', marginBottom: 5 },
  createCategoryContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryInput: { flex: 1, height: 40, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10 },
  createCategoryBtn: { backgroundColor: '#d9534f', paddingHorizontal: 15, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  createCategoryBtnText: { color: '#fff', fontWeight: 'bold' },
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
