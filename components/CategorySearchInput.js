import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

const HISTORY_KEY = 'categorySearchHistory';
const normalize = value => String(value || '').trim().replace(/\s+/g, ' ');
const keyFor = value => normalize(value).toLowerCase();

const CategorySearchInput = ({
  categories = [],
  onSubmit,
  onQueryChange,
  value,
  autoFocus = false,
  placeholder = 'Buscar categoría o subcategoría...',
  contextLabel = '',
}) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (value !== undefined && value !== query) setQuery(value);
  }, [query, value]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(HISTORY_KEY)
      .then(value => {
        if (!mounted || !value) return;
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) setHistory(parsed.filter(Boolean).slice(0, 12));
        } catch (error) {
          console.warn('[CategorySearchInput] Historial inválido');
        }
      })
      .catch(error => console.warn('[CategorySearchInput] No se pudo cargar el historial:', error));
    return () => { mounted = false; };
  }, []);

  const suggestions = useMemo(() => {
    const normalizedQuery = keyFor(query);
    const source = normalizedQuery
      ? categories.filter(category => keyFor(category.name).includes(normalizedQuery))
      : history.map(name => ({ id: `history-${keyFor(name)}`, name, isHistory: true }));
    const seen = new Set();
    return source.filter(item => {
      const key = keyFor(item.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  }, [categories, history, query]);

  const submit = value => {
    const normalized = normalize(value);
    if (!normalized) return;
    const nextHistory = [normalized, ...history.filter(item => keyFor(item) !== keyFor(normalized))].slice(0, 12);
    setHistory(nextHistory);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory))
      .catch(error => console.warn('[CategorySearchInput] No se pudo guardar el historial:', error));
    setQuery('');
    onQueryChange?.('');
    onSubmit?.(normalized);
  };

  return (
    <View style={styles.container}>
      {contextLabel ? (
        <Text style={styles.contextLabel}>
          Buscando dentro de <Text style={styles.contextValue}>{contextLabel}</Text>
        </Text>
      ) : null}
      <View style={styles.inputRow}>
        <Ionicons name="search-outline" size={19} color="#777" />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={query}
          onChangeText={nextQuery => {
            setQuery(nextQuery);
            onQueryChange?.(nextQuery);
          }}
          onFocus={() => setFocused(true)}
          autoFocus={autoFocus}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onSubmitEditing={() => submit(query)}
          returnKeyType="search"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpiar búsqueda">
            <Ionicons name="close-circle" size={19} color="#999" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.addButton} onPress={() => submit(query)} accessibilityLabel="Agregar búsqueda">
          <Ionicons name="arrow-forward" size={19} color="#fff" />
        </TouchableOpacity>
      </View>
      {focused && suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {!query && <Text style={styles.historyTitle}>Búsquedas recientes</Text>}
          {suggestions.map(item => (
            <TouchableOpacity key={`${item.isHistory ? 'history' : 'catalog'}-${item.id}`} style={styles.suggestion} onPress={() => submit(item.name)}>
              <Ionicons
                name={item.isHistory ? 'time-outline' : item.parent == null ? 'folder-outline' : 'git-branch-outline'}
                size={16}
                color="#4dabf7"
              />
              <Text style={styles.suggestionText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 14, zIndex: 10 },
  contextLabel: { marginBottom: 6, color: '#777', fontSize: 12 },
  contextValue: { color: '#333', fontWeight: '700' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, paddingHorizontal: 12, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#d9e2ec', borderRadius: 10 },
  input: { flex: 1, color: '#333', minWidth: 0 },
  addButton: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#4dabf7', alignItems: 'center', justifyContent: 'center' },
  suggestions: { marginTop: 4, borderWidth: 1, borderColor: '#e4e7eb', borderRadius: 10, backgroundColor: '#fff', overflow: 'hidden' },
  historyTitle: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 4, color: '#777', fontSize: 12, fontWeight: '700' },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#f1f3f5' },
  suggestionText: { color: '#333', fontSize: 14 },
});

export default CategorySearchInput;
