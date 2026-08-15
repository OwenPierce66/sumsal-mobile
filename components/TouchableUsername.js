import React, { useState } from 'react';
import { Text, Pressable, Modal, View, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../api';

const TouchableUsername = ({
  username,
  userId,
  userImage,
  navigation,
  style,
  textStyle,
  onNavigate,
  disabled = false,
  numberOfLines = 1,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isLikedProfile, setIsLikedProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = () => {
   console.log('[TouchableUsername] handlePress', { userId, username, userImage, hasOnNavigate: !!onNavigate, hasNavigation: !!navigation });
   if (onNavigate) {
     onNavigate(userId, username, userImage);
     return;
   }

   if (!userId) return;

   navigation?.navigate('UserProfile', {
     userId,
     userName: username || 'Usuario',
     userAvatar: userImage,
   });
  };

  const handleLongPress = () => {
   console.log('[TouchableUsername] handleLongPress', { userId, username });
   if (!userId) return;
   setMenuVisible(true);
  };

  const handleProfileLikeToggle = async () => {
   if (!userId) return;

   try {
     setIsLoading(true);
     const response = await api.post(`profiles/${userId}/like/`);
     const liked = response?.data?.liked ?? !isLikedProfile;
     setIsLikedProfile(liked);
     Alert.alert('Listo', liked ? `Le diste like a ${username}` : `Quitaste el like a ${username}`);
   } catch (error) {
     Alert.alert('Error', error.response?.data?.detail || error.response?.data?.error || 'No se pudo procesar el like');
   } finally {
     setIsLoading(false);
     setMenuVisible(false);
   }
  };

  const handleSendMessage = () => {
   if (!userId) return;
   setMenuVisible(false);
   navigation?.navigate('ChatDetail', {
     chatId: userId,
     type: 'direct',
     title: username || 'Usuario',
     avatar: userImage,
   });
  };

  const handleBlock = async () => {
   if (!userId) return;

   Alert.alert(
     'Bloquear usuario',
     `¿Estás seguro de que quieres bloquear a ${username}?`,
     [
       { text: 'Cancelar', style: 'cancel' },
       {
         text: 'Bloquear',
         style: 'destructive',
         onPress: async () => {
           try {
             setIsLoading(true);
             await api.post(`users/${userId}/block/`);
             Alert.alert('Listo', `Bloqueaste a ${username}`);
           } catch (error) {
             Alert.alert('Error', error.response?.data?.detail || 'No se pudo bloquear');
           } finally {
             setIsLoading(false);
             setMenuVisible(false);
           }
         },
       },
     ]
   );
  };

  return (
   <>
     <Pressable
       disabled={disabled}
       onPress={handlePress}
       onLongPress={handleLongPress}
       delayLongPress={500}
       style={({ pressed }) => [style, pressed && { opacity: 0.7 }]}
     >
       <Text style={[styles.username, textStyle]} numberOfLines={numberOfLines}>
         {username || 'Usuario'}
       </Text>
     </Pressable>

     <Modal
       visible={menuVisible}
       transparent
       animationType="slide"
       onRequestClose={() => setMenuVisible(false)}
     >
       <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
         <View style={styles.menuContainer}>
           <View style={styles.menuHeader}>
             <Text style={styles.menuUsername}>{username || 'Usuario'}</Text>
             <TouchableOpacity onPress={() => setMenuVisible(false)}>
               <Ionicons name="close" size={24} color="#333" />
             </TouchableOpacity>
           </View>

           <TouchableOpacity style={styles.menuOption} onPress={() => { handlePress(); setMenuVisible(false); }} disabled={isLoading}>
             <Ionicons name="person-outline" size={20} color="#333" />
             <Text style={styles.menuOptionText}>Ver perfil</Text>
           </TouchableOpacity>

           <TouchableOpacity style={styles.menuOption} onPress={handleSendMessage} disabled={isLoading || !userId}>
             <Ionicons name="chatbubble-outline" size={20} color="#333" />
             <Text style={styles.menuOptionText}>Enviar mensaje</Text>
           </TouchableOpacity>

           <TouchableOpacity style={styles.menuOption} onPress={handleProfileLikeToggle} disabled={isLoading || !userId}>
             <Ionicons name={isLikedProfile ? 'heart' : 'heart-outline'} size={20} color={isLikedProfile ? '#ff004f' : '#333'} />
             <Text style={styles.menuOptionText}>{isLikedProfile ? 'Quitar like al perfil' : 'Dar like al perfil'}</Text>
           </TouchableOpacity>

           <TouchableOpacity style={[styles.menuOption, styles.menuOptionDanger]} onPress={handleBlock} disabled={isLoading || !userId}>
             <Ionicons name="ban" size={20} color="#d32f2f" />
             <Text style={[styles.menuOptionText, styles.menuOptionTextDanger]}>Bloquear</Text>
           </TouchableOpacity>

           <TouchableOpacity style={styles.menuCancel} onPress={() => setMenuVisible(false)} disabled={isLoading}>
             <Text style={styles.menuCancelText}>Cancelar</Text>
           </TouchableOpacity>
         </View>
       </TouchableOpacity>
     </Modal>
   </>
  );
};

const styles = StyleSheet.create({
  username: {
   color: '#297fce',
   fontWeight: '600',
   fontSize: 14,
  },
  overlay: {
   flex: 1,
   backgroundColor: 'rgba(0, 0, 0, 0.5)',
   justifyContent: 'flex-end',
  },
  menuContainer: {
   backgroundColor: '#fff',
   borderTopLeftRadius: 20,
   borderTopRightRadius: 20,
   padding: 16,
   paddingBottom: 30,
  },
  menuHeader: {
   flexDirection: 'row',
   justifyContent: 'space-between',
   alignItems: 'center',
   marginBottom: 16,
   paddingBottom: 12,
   borderBottomWidth: 1,
   borderBottomColor: '#f0f0f0',
  },
  menuUsername: {
   fontSize: 16,
   fontWeight: 'bold',
   color: '#333',
  },
  menuOption: {
   flexDirection: 'row',
   alignItems: 'center',
   paddingVertical: 12,
   paddingHorizontal: 12,
   borderBottomWidth: 1,
   borderBottomColor: '#f0f0f0',
  },
  menuOptionText: {
   marginLeft: 12,
   fontSize: 14,
   color: '#333',
   fontWeight: '500',
  },
  menuOptionDanger: {
   backgroundColor: '#ffebee',
  },
  menuOptionTextDanger: {
   color: '#d32f2f',
  },
  menuCancel: {
   marginTop: 8,
   paddingVertical: 12,
   alignItems: 'center',
  },
  menuCancelText: {
   fontSize: 14,
   color: 'red',
   fontWeight: '600',
  },
});

export default TouchableUsername;
