import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import api from '../api';

const getImageUrl = (path) => {
  if (!path) return 'https://ui-avatars.com/api/?name=User';
  let cleanPath = path.replace('localhost', '192.168.0.115').replace('127.0.0.1', '192.168.0.115');
  if (cleanPath.startsWith('http')) return cleanPath;
  return `http://192.168.0.115:8001${cleanPath}`;
};

const LikesListModal = ({ visible, onClose, apiUrl, title = "Le gusta a" }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && apiUrl) {
      setLoading(true);
      api.get(apiUrl)
        .then(response => {
          setUsers(response.data || []);
        })
        .catch(error => {
          console.error("Error fetching likes:", error);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setUsers([]);
    }
  }, [visible, apiUrl]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <ActivityIndicator size="large" color="#4dabf7" style={{ marginTop: 20 }} />
          ) : users.length === 0 ? (
            <Text style={styles.noDataText}>Nadie ha dado me gusta aún.</Text>
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.userItem}>
                  <Image source={{ uri: getImageUrl(item.user_image || item.profile?.image) }} style={styles.userAvatar} />
                  <Text style={styles.userName}>{item.first_name ? `${item.first_name} ${item.last_name || ''}` : item.username}</Text>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: '50%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    fontSize: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 15,
    backgroundColor: '#eee',
  },
  userName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

export default LikesListModal;