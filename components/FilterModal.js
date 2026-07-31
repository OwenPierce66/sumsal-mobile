import React, { useState, useEffect, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Switch no se usa aquí, se usa en el componente ToggleOption
import api from '../api';

// ⚡ DICCIONARIO INTELIGENTE DE SUBTEMAS
const PREDEFINED_SUBTEMAS = {
  'programacion': ['React', 'Python', 'Node.js', 'Django', 'React Native', 'JavaScript', 'Frontend', 'Backend'],
  'tecnologia': ['Inteligencia Artificial', 'Ciberseguridad', 'Hardware', 'Software', 'Innovación'],
  'educacion': ['Matemáticas', 'Idiomas', 'Ciencias', 'Historia', 'Pedagogía'],
  'salud': ['Nutrición', 'Ejercicio', 'Bienestar Mental', 'Medicina', 'Psicología'],
  'finanzas': ['Inversiones', 'Ahorro', 'Criptomonedas', 'Emprendimiento', 'Economía'],
  'arte': ['Pintura', 'Música', 'Fotografía', 'Cine', 'Diseño'],
  'deportes': ['Fútbol', 'Baloncesto', 'Tenis', 'Natación', 'Fitness'],
};

const ToggleOption = ({ label, value, onValueChange }) => (
  <View style={styles.toggleOption}>
    <Text style={styles.toggleLabel}>{label}</Text>
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onValueChange(e.target.checked)}
      style={{ transform: 'scale(1.2)' }}
    />
  </View>
);

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

const FilterModal = ({ visible, onClose, onApply, currentCategory, currentDateFilter, currentSortBy, currentFavorites, currentFavoriteUsers, currentVerifiedUsers, currentRecommendedUsers, isSuperAdmin }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [manualSubthemeText, setManualSubthemeText] = useState('');
  const [manualSubcategories, setManualSubcategories] = useState([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState('');
  const [sortBy, setSortBy] = useState(currentSortBy || 'recent');
  const [favoritesOnly, setFavoritesOnly] = useState(currentFavorites || false);
  const [favoriteUsersOnly, setFavoriteUsersOnly] = useState(currentFavoriteUsers || false);
  const [verifiedUsersOnly, setVerifiedUsersOnly] = useState(currentVerifiedUsers || false);
  const [recommendedUsersOnly, setRecommendedUsersOnly] = useState(currentRecommendedUsers || false);
  // ✅ USAMOS LA PROP DIRECTAMENTE, NO UN ESTADO LOCAL
  const isSuper = isSuperAdmin;
  const [newCatName, setNewCatName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [categoriesOrder, setCategoriesOrder] = useState([]);
  const [subthemesTree, setSubthemesTree] = useState(PREDEFINED_SUBTEMAS);
  const [adminSubthemeInputs, setAdminSubthemeInputs] = useState({});

  useEffect(() => {
    fetchCategories();
    loadSubthemesTree();
  }, []);

  const loadSubthemesTree = async () => {
    try {
      const stored = await AsyncStorage.getItem('subthemesTree');
      if (stored) setSubthemesTree(JSON.parse(stored));
    } catch(e){}
  };

  const handleDeleteCat = (catId) => { if (Platform.OS === "web") { if (window.confirm("¿Estás seguro de que deseas eliminar esta categoria? Esta acción no se puede deshacer.")) { executeDeleteCat(catId); } } else { Alert.alert("Eliminar Categoria", "¿Estás seguro de que deseas eliminar esta categoria? Esta acción no se puede deshacer.", [{ text: "Cancelar", style: "cancel" }, { text: "Eliminar", style: "destructive", onPress: () => executeDeleteCat(catId) }]); } }; const executeDeleteCat = async (catId) => { try { await api.delete("new-categories/" + catId + "/"); fetchCategories(); if (selectedCategory !== "" && categories.find(c => c.id === catId)?.name === selectedCategory) { setSelectedCategory(""); } } catch (error) { console.error("Error deleting category:", error); } };

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
    // ⚡ INICIALIZAMOS LA CATEGORÍA Y LOS SUBTEMAS CORRECTAMENTE
    if (currentCategory) {
      const parts = currentCategory.split(',').map(c => c.trim()).filter(Boolean);
      setSelectedCategory(parts[0] || '');
      
      const subcats = parts.slice(1);
      if (subcats.length > 0) {
        const allPredefinedSet = new Set(Object.values(subthemesTree).flat());
        setSelectedSubcategories(subcats.filter(c => allPredefinedSet.has(c)));
        setManualSubcategories(subcats.filter(c => !allPredefinedSet.has(c)));
      } else {
        setSelectedSubcategories([]);
        setManualSubcategories([]);
      }
    } else {
      setSelectedCategory('');
      setSelectedSubcategories([]);
      setManualSubcategories([]);
    }

    setSelectedDateFilter(currentDateFilter || '');
    setSortBy(currentSortBy || 'recent');
    setFavoritesOnly(currentFavorites || false);
    setFavoriteUsersOnly(currentFavoriteUsers || false);
    setVerifiedUsersOnly(currentVerifiedUsers || false);
    setRecommendedUsersOnly(currentRecommendedUsers || false);
  }, [currentCategory, currentDateFilter, currentSortBy, currentFavorites, currentFavoriteUsers, currentVerifiedUsers, currentRecommendedUsers, visible, subthemesTree]);

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

  // ⚡ LÓGICA PARA GESTIONAR SUBTEMAS MANUALES O DE DICCIONARIO
  const toggleSubcategory = (subcat) => {
    setSelectedSubcategories(prev => 
      prev.includes(subcat) ? prev.filter(c => c !== subcat) : [...prev, subcat]
    );
  };

  const handleAddManualSubtheme = () => {
    if (!manualSubthemeText.trim()) return;
    const newSubcat = manualSubthemeText.trim();
    if (!manualSubcategories.includes(newSubcat) && !selectedSubcategories.includes(newSubcat)) {
      setManualSubcategories(prev => [...prev, newSubcat]);
    }
    setManualSubthemeText('');
  };

  const removeManualSubcategory = (subcat) => {
    setManualSubcategories(prev => prev.filter(c => c !== subcat));
  };

  // ⚡ LÓGICA DE ADMIN PARA GUARDAR SUBTEMAS CONSECUTIVOS AL ÁRBOL Y A LA DB
  const handleAdminAddSubtheme = async (parentTheme) => {
    const text = adminSubthemeInputs[parentTheme];
    if (!text || !text.trim()) return;
    const newSubTheme = text.trim();
    const parentKey = parentTheme.toLowerCase();
    const currentSubs = subthemesTree[parentKey] || [];

    if (!currentSubs.includes(newSubTheme)) {
      const newTree = { ...subthemesTree, [parentKey]: [...currentSubs, newSubTheme] };
      setSubthemesTree(newTree);
      await AsyncStorage.setItem('subthemesTree', JSON.stringify(newTree));

      try {
        await api.post("new-categories/", { name: newSubTheme });
        fetchCategories();
      } catch(e){}
    }
    setAdminSubthemeInputs(prev => ({ ...prev, [parentTheme]: '' }));
  };

  const handleApply = () => {
    let finalCategory = selectedCategory;
    const allSubcats = [...selectedSubcategories, ...manualSubcategories];
    if (finalCategory && allSubcats.length > 0) finalCategory = [finalCategory, ...allSubcats].join(',');
    else if (!finalCategory && allSubcats.length > 0) finalCategory = allSubcats.join(',');

    onApply({
      category: finalCategory,
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
    setSelectedSubcategories([]);
    setManualSubcategories([]);
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
            <View style={styles.toggleContainer}>
              <ToggleOption 
                label="Mis Tareas Favoritas" 
                value={favoritesOnly} 
                onValueChange={setFavoritesOnly} 
              />
              <ToggleOption 
                label="Mis Creadores Favoritos" 
                value={favoriteUsersOnly} 
                onValueChange={setFavoriteUsersOnly} 
              />
              <ToggleOption 
                label="Solo Usuarios Verificados" 
                value={verifiedUsersOnly} 
                onValueChange={setVerifiedUsersOnly} 
              />
              <ToggleOption 
                label="Solo Usuarios Recomendados" 
                value={recommendedUsersOnly} 
                onValueChange={setRecommendedUsersOnly} 
              />
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
                onPress={() => {
                  setSelectedCategory('');
                  setSelectedSubcategories([]);
                  setManualSubcategories([]);
                }}
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
                  setSelectedCategory={(name) => {
                    setSelectedCategory(name);
                    setSelectedSubcategories([]);
                    setManualSubcategories([]);
                  }}
                  isSuper={isSuper}
                  handleDeleteCat={handleDeleteCat}
                  setScrollEnabled={setScrollEnabled}
                  saveCategoriesOrder={saveCategoriesOrder}
                />
              ))}
            </View>

            {/* ⚡ BLOQUE INTELIGENTE DE SUBTEMAS */}
            {selectedCategory !== '' && (
              <>
                {[selectedCategory, ...selectedSubcategories].map((theme, idx) => {
                  const themeKey = theme.toLowerCase();
                  const subs = subthemesTree[themeKey] || [];
                  
                  if (subs.length === 0 && !isSuper) return null;

                  return (
                    <View key={`sub-${themeKey}-${idx}`} style={styles.subthemesSection}>
                      <Text style={styles.sectionTitle}>Subtemas de {theme}</Text>
                      
                      {subs.length > 0 && (
                        <View style={styles.optionsContainer}>
                          {subs.map((subcat, i) => (
                            <TouchableOpacity
                              key={i}
                              style={[
                                styles.optionBadge,
                                selectedSubcategories.includes(subcat) && styles.optionBadgeActive,
                              ]}
                              onPress={() => toggleSubcategory(subcat)}
                            >
                              <Text style={[styles.optionText, selectedSubcategories.includes(subcat) && styles.optionTextActive]}>
                                {subcat}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {isSuper && (
                        <View style={styles.addManualSubthemeContainer}>
                          <TextInput
                            style={[styles.manualSubthemeInput, { borderColor: '#4dabf7', borderWidth: 1 }]}
                            placeholder={`Añadir subtema a ${theme} (Admin)...`}
                            value={adminSubthemeInputs[theme] || ''}
                            onChangeText={(txt) => setAdminSubthemeInputs(prev => ({...prev, [theme]: txt}))}
                            onSubmitEditing={() => handleAdminAddSubtheme(theme)}
                          />
                          <TouchableOpacity style={styles.addBtn} onPress={() => handleAdminAddSubtheme(theme)}>
                            <Ionicons name="save" size={20} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                <View style={styles.subthemesSection}>
                  <Text style={styles.sectionTitle}>Filtro de Subtemas Manuales</Text>
                  <View style={styles.addManualSubthemeContainer}>
                    <TextInput
                      style={styles.manualSubthemeInput}
                      placeholder="Agregar subtema manual..."
                      value={manualSubthemeText}
                      onChangeText={setManualSubthemeText}
                      onSubmitEditing={handleAddManualSubtheme}
                    />
                    <TouchableOpacity style={styles.addBtn} onPress={handleAddManualSubtheme}>
                      <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {manualSubcategories.length > 0 && (
                    <View style={[styles.optionsContainer, { marginTop: 10 }]}>
                      {manualSubcategories.map((subcat, idx) => (
                        <TouchableOpacity key={idx} style={[styles.optionBadge, styles.optionBadgeActive]} onPress={() => removeManualSubcategory(subcat)}>
                          <Text style={[styles.optionText, styles.optionTextActive]}>{subcat}  <Ionicons name="close" size={12} color="#fff" /></Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

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
  subthemesSection: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  addManualSubthemeContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
    alignItems: 'center',
  },
  manualSubthemeInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 10,
    color: '#333',
  },
  addBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#4dabf7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  toggleContainer: { gap: 10, marginBottom: 15 },
  toggleOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f8f8', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
  toggleLabel: { fontSize: 15, color: '#333', fontWeight: '500' },
});

export default FilterModal;
