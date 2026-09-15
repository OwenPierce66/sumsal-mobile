import React, { useState, useEffect, useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, Platform, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Switch no se usa aquí, se usa en el componente ToggleOption
import api from '../api';
import CategorySearchInput from './CategorySearchInput';

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
const DraggableCategory = ({ cat, index, categories, selectedCategory, setSelectedCategory, isSuper, handleDeleteCat, setScrollEnabled, onReorder }) => {
  const pan = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);
  
  const panResponder = React.useMemo(
    () => PanResponder.create({
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
          onReorder(newCategories);
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
    }),
    [categories, index, onReorder, pan, setScrollEnabled]
  );

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

const DraggableSubtheme = ({ name, index, subthemes, selected, onSelect, onReorder, setScrollEnabled, isSuper, onDelete }) => {
  const pan = useRef(new Animated.Value(0)).current;
  const [isDragging, setIsDragging] = useState(false);
  const panResponder = React.useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        setScrollEnabled(false);
        pan.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dy: pan }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        setScrollEnabled(true);
        const offset = Math.round(gestureState.dy / ROW_HEIGHT);
        const newIndex = Math.max(0, Math.min(subthemes.length - 1, index + offset));

        if (newIndex !== index) {
          const reordered = [...subthemes];
          const [movedItem] = reordered.splice(index, 1);
          reordered.splice(newIndex, 0, movedItem);
          onReorder(reordered);
        }
        Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        setScrollEnabled(true);
        Animated.spring(pan, { toValue: 0, useNativeDriver: false }).start();
      },
    }),
    [index, onReorder, pan, setScrollEnabled, subthemes]
  );

  return (
    <Animated.View style={[
      styles.draggableSubtheme,
      { transform: [{ translateY: pan }], zIndex: isDragging ? 100 : 1, opacity: isDragging ? 0.8 : 1 },
    ]}>
      <TouchableOpacity
        style={[styles.optionBadge, selected && styles.optionBadgeActive, styles.draggableSubthemeButton]}
        onPress={onSelect}
      >
        <Text style={[styles.optionText, selected && styles.optionTextActive]}>{name}</Text>
      </TouchableOpacity>
      <View {...panResponder.panHandlers} style={styles.dragHandle}>
        <Ionicons name="menu" size={20} color="#999" />
      </View>
      {isSuper && (
        <TouchableOpacity
          style={styles.subthemeDeleteButton}
          onPress={() => onDelete(name)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={`Eliminar ${name}`}
        >
          <Ionicons name="close" size={12} color="#fff" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const FilterModal = ({ visible, onClose, onApply, currentCategory, currentStatus, currentDateFilter, currentSortBy, currentFavorites, currentFavoriteUsers, currentVerifiedUsers, currentRecommendedUsers, isSuperAdmin, currentPch }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSubcategories, setSelectedSubcategories] = useState([]);
  const [customSubcategory, setCustomSubcategory] = useState('');
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
  // The backend parent relation is the only source of truth for the filter.
  const rootCategories = React.useMemo(
    () => categories.filter(category => {
      const normalized = String(category.name || '').trim().toLowerCase();
      return category.parent == null && !['aprobada', 'aprobadas', 'aprovada', 'aprovadas'].includes(normalized);
    }),
    [categories]
  );
  const legacyApprovalCategories = React.useMemo(
    () => categories.filter(category => (
      ['aprobada', 'aprobadas', 'aprovada', 'aprovadas'].includes(
        String(category.name || '').trim().toLowerCase()
      )
    )),
    [categories]
  );
  const childrenFor = (parentName) => {
    return childCategoriesFor(parentName)
      .map(category => category.name)
      .filter(name => !['aprobada', 'aprobadas', 'aprovada', 'aprovadas', 'procesando'].includes(
        String(name).trim().toLowerCase()
      ));
  };
  const isPodcastStatus = (parentName, subtheme) => (
    String(parentName).trim().replace(/\s+/g, ' ').toLowerCase() === 'grabar podcast'
    && ['procesando', 'aprobada', 'aprobadas'].includes(String(subtheme).trim().toLowerCase())
  );
  const isSelectedPodcastStatus = (subtheme) => {
    const normalized = String(subtheme).trim().toLowerCase();
    const selected = String(selectedStatus || '').trim().toLowerCase();
    return normalized === selected || (normalized === 'aprobadas' && selected === 'aprobada');
  };
  const displayedSubthemesFor = (parentName) => {
    const subthemes = childrenFor(parentName);
    if (String(parentName).trim().replace(/\s+/g, ' ').toLowerCase() !== 'grabar podcast') {
      return subthemes;
    }
    return [...subthemes, 'Procesando', 'Aprobadas'];
  };
  const childCategoriesFor = (parentName) => {
    const parent = categories.find(
      category => String(category.name).trim().toLowerCase() === String(parentName).trim().toLowerCase()
    );
    const children = parent
      ? categories.filter(category => (
        category.parent != null && String(category.parent) === String(parent.id)
      ))
      : [];
    const savedOrder = subthemesTree[String(parentName).trim().toLowerCase()];
    if (!Array.isArray(savedOrder)) return children;
    return [...children].sort((a, b) => {
      const indexA = savedOrder.findIndex(name => String(name).trim().toLowerCase() === String(a.name).trim().toLowerCase());
      const indexB = savedOrder.findIndex(name => String(name).trim().toLowerCase() === String(b.name).trim().toLowerCase());
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const isPetitionsPch = String(currentPch || '').trim().toLowerCase() === 'peticiones';

  useEffect(() => {
    fetchCategories();
    loadSubthemesTree();
  }, [currentPch]);

  const loadSubthemesTree = async () => {
    try {
      const stored = await AsyncStorage.getItem('subthemesTree');
      if (stored) setSubthemesTree(JSON.parse(stored));
    } catch(e){}
  };

  const handleDeleteCat = (catId) => {
    if (!catId) return;
    if (Platform.OS === "web") {
      if (window.confirm("¿Estás seguro de que deseas eliminar esta categoria? Esta acción no se puede deshacer.")) {
        executeDeleteCat(catId);
      }
    } else {
      Alert.alert("Eliminar Categoria", "¿Estás seguro de que deseas eliminar esta categoria? Esta acción no se puede deshacer.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => executeDeleteCat(catId) },
      ]);
    }
  };
  const executeDeleteCat = async (catId) => {
    try {
      await api.delete("new-categories/" + catId + "/");
      await fetchCategories();
      if (selectedCategory !== "" && categories.find(c => c.id === catId)?.name === selectedCategory) {
        setSelectedCategory("");
      }
    } catch (error) {
      const status = error.response?.status;
      const detail = error.response?.data?.detail || error.response?.data?.name?.[0] || "No se pudo eliminar la categoría.";
      Alert.alert(status === 403 ? "Sin permisos" : "No se pudo eliminar", String(detail));
    }
  };

  const handleCreateCat = async () => {
    if (!newCatName.trim()) return;
    setIsCreating(true);
    try {
      // ⚡ La categoría nace asignada al PCH que se está viendo (vacío = global)
      await api.post("new-categories/", { name: newCatName.trim(), pch: currentPch || '' });
      setNewCatName("");
      fetchCategories();
    } catch (error) {
      const detail = error.response?.data?.name?.[0] || error.response?.data?.detail;
      if (detail) Alert.alert('No se pudo crear', String(detail));
    } finally {
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
        // Keep terms returned by saved filters even when they are not in the
        // catalog. They are valid transient backend search criteria.
        setSelectedSubcategories(subcats);
      } else {
        setSelectedSubcategories([]);
      }
    } else {
      setSelectedCategory('');
      setSelectedSubcategories([]);
    }
    setCustomSubcategory('');

    setSelectedStatus(currentStatus || '');
    setSelectedDateFilter(currentDateFilter || '');
    setSortBy(currentSortBy || 'recent');
    setFavoritesOnly(currentFavorites || false);
    setFavoriteUsersOnly(currentFavoriteUsers || false);
    setVerifiedUsersOnly(currentVerifiedUsers || false);
    setRecommendedUsersOnly(currentRecommendedUsers || false);
  }, [currentCategory, currentStatus, currentDateFilter, currentSortBy, currentFavorites, currentFavoriteUsers, currentVerifiedUsers, currentRecommendedUsers, visible, subthemesTree]);

  const fetchCategories = async () => {
    try {
      // ⚡ Categorías del PCH activo + globales
      const response = await api.get('new-categories/', {
        params: currentPch
          ? { pch: currentPch, include_approval: 'true' }
          : { include_approval: 'true' },
      });
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

  const saveSubthemesOrder = async (parentTheme, reorderedSubthemes) => {
    const parentKey = parentTheme.toLowerCase();
    const newTree = { ...subthemesTree, [parentKey]: reorderedSubthemes };
    setSubthemesTree(newTree);
    await AsyncStorage.setItem('subthemesTree', JSON.stringify(newTree));
  };

  const reorderRootCategories = (reorderedRoots) => {
    const rootIds = new Set(reorderedRoots.map(category => category.id));
    const nonRoots = categories.filter(category => !rootIds.has(category.id));
    setCategories([...reorderedRoots, ...nonRoots]);
    saveCategoriesOrder(reorderedRoots);
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

  const selectMainCategory = (category) => {
    setSelectedCategory(category);
    setSelectedSubcategories([]);
  };

  const selectSubcategoryAtLevel = (subcategory, level) => {
    setSelectedSubcategories(prev => {
      if (prev[level] === subcategory) {
        return prev.slice(0, level);
      }
      return [...prev.slice(0, level), subcategory];
    });
  };

  const normalizeCategoryName = value => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

  const findCategory = value => categories.find(
    category => normalizeCategoryName(category.name) === normalizeCategoryName(value)
  );

  const commitCategorySearch = (searchValue = customSubcategory) => {
    const value = searchValue.trim().replace(/\s+/g, ' ');
    if (!value) return;

    const exactCategory = findCategory(value);
    if (!selectedCategory) {
      if (exactCategory?.parent == null) {
        selectMainCategory(exactCategory.name);
      } else if (exactCategory?.parent != null) {
        const parent = categories.find(category => String(category.id) === String(exactCategory.parent));
        if (parent) {
          setSelectedCategory(parent.name);
          setSelectedSubcategories([exactCategory.name]);
        } else {
          setSelectedCategory(value);
          setSelectedSubcategories([]);
        }
      } else {
        setSelectedSubcategories(prev => [...prev, value]);
      }
    } else {
      const parentName = selectedSubcategories[selectedSubcategories.length - 1] || selectedCategory;
      const parent = findCategory(parentName);
      const isChild = exactCategory && parent && String(exactCategory.parent) === String(parent.id);
      if (isChild) {
        selectSubcategoryAtLevel(exactCategory.name, selectedSubcategories.length);
      } else {
        setSelectedSubcategories(prev => (
          prev.some(item => normalizeCategoryName(item) === normalizeCategoryName(value))
            ? prev
            : [...prev, value]
        ));
      }
    }
    setCustomSubcategory('');
  };

  const removeSelectedCategoryPart = level => {
    if (level === 0) {
      setSelectedCategory('');
      setSelectedSubcategories([]);
      setSelectedStatus('');
      return;
    }
    setSelectedSubcategories(prev => prev.slice(0, level - 1));
  };

  // ⚡ LÓGICA DE ADMIN PARA GUARDAR SUBTEMAS CONSECUTIVOS AL ÁRBOL Y A LA DB
  const handleAdminAddSubtheme = async (parentTheme) => {
    const text = adminSubthemeInputs[parentTheme];
    if (!text || !text.trim()) return;
    const newSubTheme = text.trim();
    const parent = categories.find(
      category => String(category.name).trim().toLowerCase() === parentTheme.trim().toLowerCase()
    );
    try {
      await api.post('new-categories/', {
        name: newSubTheme,
        pch: currentPch || '',
        parent: parent?.id || null,
      });
      await fetchCategories();
      setAdminSubthemeInputs(prev => ({ ...prev, [parentTheme]: '' }));
    } catch (error) {
      const detail = error.response?.data?.name?.[0] || error.response?.data?.detail;
      Alert.alert('No se pudo crear', String(detail || 'Intenta con otro nombre.'));
    }
  };

  const handleApply = () => {
    let finalCategory = selectedCategory;
    const typedSubcategory = customSubcategory.trim().replace(/\s+/g, ' ');
    const allSubcats = typedSubcategory
      ? [...selectedSubcategories, typedSubcategory]
      : selectedSubcategories;
    const uniqueSubcategories = allSubcats.filter(
      (value, index, values) =>
        values.findIndex(item => item.trim().toLowerCase() === value.trim().toLowerCase()) === index
    );
    if (finalCategory && uniqueSubcategories.length > 0) finalCategory = [finalCategory, ...uniqueSubcategories].join(',');
    else if (!finalCategory && uniqueSubcategories.length > 0) finalCategory = uniqueSubcategories.join(',');

    onApply({
      category: finalCategory,
      status: selectedStatus,
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
    setSelectedStatus('');
    setSelectedSubcategories([]);
    setCustomSubcategory('');
    setSelectedDateFilter('');
    setSortBy('recent');
    setFavoritesOnly(false);
    setFavoriteUsersOnly(false);
    setVerifiedUsersOnly(false);
    setRecommendedUsersOnly(false);
    onApply({
      category: '',
      status: '',
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
            <View style={styles.hierarchyContainer}>
              <Text style={styles.hierarchyTitle}>Temas</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalOptions}>
                <TouchableOpacity
                  style={[styles.hierarchyBadge, selectedCategory === '' && styles.hierarchyBadgeActive]}
                  onPress={() => selectMainCategory('')}
                >
                  <Text style={[styles.hierarchyText, selectedCategory === '' && styles.hierarchyTextActive]}>Todos</Text>
                </TouchableOpacity>
                {rootCategories.map(category => (
                  <View key={category.id} style={styles.hierarchyBadgeWrapper}>
                    <TouchableOpacity
                      style={[styles.hierarchyBadge, selectedCategory === category.name && styles.hierarchyBadgeActive, isSuper && styles.hierarchyBadgeWithDelete]}
                      onPress={() => selectMainCategory(category.name)}
                    >
                      <Text style={[styles.hierarchyText, selectedCategory === category.name && styles.hierarchyTextActive]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                    {isSuper && (
                      <TouchableOpacity
                        style={styles.hierarchyDeleteButton}
                        onPress={() => handleDeleteCat(category.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel={`Eliminar ${category.name}`}
                      >
                        <Ionicons name="close" size={12} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </ScrollView>

              {selectedCategory !== '' && [selectedCategory, ...selectedSubcategories].map((parentTheme, level) => {
                const subthemes = displayedSubthemesFor(parentTheme);
                if (subthemes.length === 0 && !isSuper) return null;
                const selectedSubtheme = selectedSubcategories[level];

                return (
                  <View key={`${parentTheme}-${level}`} style={styles.hierarchyLevel}>
                    <Text style={styles.hierarchyTitle}>Subtemas de {parentTheme}</Text>
                    {subthemes.length > 0 ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalOptions}>
                        {subthemes.map(subtheme => (
                          <View key={subtheme} style={styles.hierarchyBadgeWrapper}>
                            <TouchableOpacity
                              style={[
                                styles.hierarchyBadge,
                                (
                                  selectedSubtheme === subtheme
                                  || (isPodcastStatus(parentTheme, subtheme) &&
                                    isSelectedPodcastStatus(subtheme))
                                ) && styles.hierarchyBadgeActive,
                                isSuper && styles.hierarchyBadgeWithDelete,
                              ]}
                              onPress={() => {
                                if (isPodcastStatus(parentTheme, subtheme)) {
                                  setSelectedStatus(
                                    subtheme.toLowerCase().startsWith('aprob')
                                      ? 'Aprobada'
                                      : 'Procesando'
                                  );
                                  return;
                                }
                                selectSubcategoryAtLevel(subtheme, level);
                              }}
                            >
                              <Text style={[styles.hierarchyText, (
                                selectedSubtheme === subtheme
                                || (isPodcastStatus(parentTheme, subtheme) &&
                                  isSelectedPodcastStatus(subtheme))
                              ) && styles.hierarchyTextActive]}>
                                {subtheme}
                              </Text>
                            </TouchableOpacity>
                            {isSuper && !isPodcastStatus(parentTheme, subtheme) && (
                              <TouchableOpacity
                                style={styles.hierarchyDeleteButton}
                                onPress={() => handleDeleteCat(childCategoriesFor(parentTheme).find(child => child.name === subtheme)?.id)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel={`Eliminar ${subtheme}`}
                              >
                                <Ionicons name="close" size={12} color="#fff" />
                              </TouchableOpacity>
                            )}
                          </View>
                        ))}
                      </ScrollView>
                    ) : null}
                    {isSuper ? (
                      <View style={styles.addManualSubthemeContainer}>
                        <TextInput
                          style={[styles.manualSubthemeInput, styles.adminSubthemeInput]}
                          placeholder={`Añadir subtema a ${parentTheme}...`}
                          value={adminSubthemeInputs[parentTheme] || ''}
                          onChangeText={text => setAdminSubthemeInputs(prev => ({ ...prev, [parentTheme]: text }))}
                          onSubmitEditing={() => handleAdminAddSubtheme(parentTheme)}
                        />
                        <TouchableOpacity style={styles.addBtn} onPress={() => handleAdminAddSubtheme(parentTheme)}>
                          <Ionicons name="save" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              })}
              {(selectedCategory || selectedSubcategories.length > 0) && (
                <View style={styles.selectedSearchTerms}>
                  {[selectedCategory, ...selectedSubcategories].filter(Boolean).map((term, index) => (
                    <View key={`${term}-${index}`} style={styles.selectedSearchTerm}>
                      <Text style={styles.selectedSearchTermText}>{term}</Text>
                      <TouchableOpacity
                        onPress={() => removeSelectedCategoryPart(index)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityLabel={`Quitar ${term}`}
                      >
                        <Ionicons name="close-circle" size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <CategorySearchInput
                categories={categories}
                onSubmit={commitCategorySearch}
              />
              <View style={styles.customSubcategoryRow}>
                <Text style={styles.customSubcategoryHint}>
                  Presiona Enter para agregar cualquier término. Después puedes buscar otra subcategoría tantas veces como quieras.
                </Text>
              </View>
            </View>

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

            {isPetitionsPch ? (
              <>
                <Text style={styles.sectionTitle}>Podcast</Text>
                <TouchableOpacity
                  style={[
                    styles.podcastRankingButton,
                    selectedCategory === 'Grabar Podcast' &&
                      selectedSubcategories.includes('Procesando') &&
                      sortBy === 'likes' &&
                      styles.podcastRankingButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory('Grabar Podcast');
                    setSelectedSubcategories(['Procesando']);
                    setSortBy('likes');
                  }}
                >
                  <Ionicons name="mic-outline" size={18} color="#fff" />
                  <View style={styles.podcastRankingCopy}>
                    <Text style={styles.podcastRankingTitle}>Top para podcast</Text>
                    <Text style={styles.podcastRankingSubtitle}>
                      Grabar Podcast + Procesando + Más likes
                    </Text>
                  </View>
                  <Ionicons name="flash-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </>
            ) : null}

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

            {isSuper ? (
              <>
                <Text style={styles.sectionTitle}>Ordenar y administrar temas</Text>
                <View style={[styles.optionsContainer, { flexDirection: 'column' }]}>
                  {rootCategories.map((cat, index) => (
                    <DraggableCategory
                      key={cat.id}
                      cat={cat}
                      index={index}
                      categories={rootCategories}
                      setCategories={setCategories}
                      selectedCategory={selectedCategory}
                      setSelectedCategory={selectMainCategory}
                      isSuper={isSuper}
                      handleDeleteCat={handleDeleteCat}
                      setScrollEnabled={setScrollEnabled}
                      onReorder={reorderRootCategories}
                    />
                  ))}
                </View>
                {legacyApprovalCategories.length > 0 && (
                  <View style={styles.legacyCategorySection}>
                    <Text style={styles.sectionTitle}>Estados antiguos para corregir</Text>
                    {legacyApprovalCategories.map(category => (
                      <View key={category.id} style={styles.legacyCategoryRow}>
                        <Text style={styles.legacyCategoryText}>{category.name}</Text>
                        <TouchableOpacity
                          onPress={() => handleDeleteCat(category.id)}
                          style={styles.legacyDeleteButton}
                          accessibilityLabel={`Eliminar ${category.name}`}
                        >
                          <Ionicons name="close" size={18} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                {selectedCategory !== '' && [selectedCategory, ...selectedSubcategories].map((parentTheme, level) => {
                  const subthemes = childrenFor(parentTheme);
                  if (subthemes.length === 0) return null;

                  return (
                    <View key={`order-${parentTheme}-${level}`} style={styles.nestedOrderSection}>
                      <Text style={styles.sectionTitle}>Ordenar subtemas de {parentTheme}</Text>
                      {subthemes.map((subtheme, index) => (
                        <DraggableSubtheme
                          key={`${parentTheme}-${subtheme}`}
                          name={subtheme}
                          index={index}
                          subthemes={subthemes}
                          selected={selectedSubcategories[level] === subtheme}
                          onSelect={() => selectSubcategoryAtLevel(subtheme, level)}
                          onReorder={reordered => saveSubthemesOrder(parentTheme, reordered)}
                          setScrollEnabled={setScrollEnabled}
                          isSuper={isSuper}
                          onDelete={name => handleDeleteCat(childCategoriesFor(parentTheme).find(child => child.name === name)?.id)}
                        />
                      ))}
                    </View>
                  );
                })}
              </>
            ) : null}

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
  hierarchyContainer: { marginBottom: 22 },
  hierarchyLevel: { marginTop: 14 },
  hierarchyTitle: { marginBottom: 8, fontSize: 14, fontWeight: '800', color: '#333' },
  horizontalOptions: { gap: 8, paddingRight: 14 },
  hierarchyBadgeWrapper: { position: 'relative' },
  hierarchyBadge: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#f0f2f5', borderWidth: 1, borderColor: '#e4e7eb' },
  hierarchyBadgeWithDelete: { paddingRight: 25 },
  hierarchyDeleteButton: { position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ff6b6b', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  hierarchyBadgeActive: { backgroundColor: '#4dabf7', borderColor: '#4dabf7' },
  hierarchyText: { color: '#555', fontSize: 13, fontWeight: '700' },
  podcastSubcategoryStatus: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#f8f9fa', borderWidth: 1, borderColor: '#e9ecef' },
  hierarchyTextActive: { color: '#fff' },
  customSubcategoryRow: { marginTop: 14 },
  selectedSearchTerms: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  selectedSearchTerm: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 16, backgroundColor: '#4dabf7' },
  selectedSearchTermText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customSubcategoryInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#d9e2ec',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#333',
  },
  searchCommitButton: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
  searchSuggestions: { marginTop: 5, borderWidth: 1, borderColor: '#e4e7eb', borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' },
  searchSuggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  searchSuggestionText: { color: '#333', fontSize: 14 },
  customSubcategoryHint: { marginTop: 5, color: '#777', fontSize: 12 },
  adminSubthemeInput: { borderColor: '#4dabf7' },
  nestedOrderSection: { marginTop: 14, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: '#dceeff' },
  legacyCategorySection: { marginTop: 14, padding: 12, backgroundColor: '#fff4e6', borderRadius: 10 },
  legacyCategoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  legacyCategoryText: { color: '#995000', fontWeight: '700' },
  legacyDeleteButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ff6b6b', alignItems: 'center', justifyContent: 'center' },
  draggableSubtheme: { position: 'relative', flexDirection: 'row', alignItems: 'center', height: ROW_HEIGHT, marginBottom: 8 },
  draggableSubthemeButton: { flex: 1, marginRight: 0, marginBottom: 0, paddingRight: 44 },
  dragHandle: { position: 'absolute', right: 4, padding: 10, zIndex: 10 },
  subthemeDeleteButton: { position: 'absolute', right: 42, top: -5, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ff6b6b', alignItems: 'center', justifyContent: 'center', zIndex: 20, elevation: 5 },
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
  podcastRankingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#845ef7',
    borderWidth: 1,
    borderColor: '#7048e8',
    marginBottom: 10,
  },
  podcastRankingButtonActive: {
    backgroundColor: '#5f3dc4',
    borderColor: '#3b238a',
  },
  podcastRankingCopy: {
    flex: 1,
    marginHorizontal: 10,
  },
  podcastRankingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  podcastRankingSubtitle: {
    color: '#f3f0ff',
    fontSize: 11,
    marginTop: 2,
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
