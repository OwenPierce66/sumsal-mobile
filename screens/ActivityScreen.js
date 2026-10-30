/**
 * screens/ActivityScreen.js
 *
 * Tu actividad (primera opción del menú de tu perfil): todo lo que haces, junto o por
 * tipo, y quién ve cada tipo en tu perfil (solo tú, tus suscriptores o todos).
 */
import React from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getImageUrl } from '@api';
import { useMe } from '@hooks/useApi';
import ProfileActivity from '@components/ProfileActivity';

const ActivityScreen = ({ navigation }) => {
  const { data: me } = useMe();

  const openProfile = (person) => {
    if (!person?.id) return;
    navigation.push('UserProfile', {
      userId: person.id,
      userName: person.username,
      userAvatar: getImageUrl(person.user_image),
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} accessibilityLabel="Volver">
          <Ionicons name="arrow-back" size={24} color="#212529" />
        </TouchableOpacity>
        <Text style={styles.title}>Tu actividad</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {me?.id ? (
          <ProfileActivity
            userId={me.id}
            username={me.username}
            isCurrentUser
            showTitle={false}
            navigation={navigation}
            onOpenProfile={openProfile}
          />
        ) : (
          <ActivityIndicator color="#4dabf7" style={styles.loading} />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: Platform.OS === 'android' ? 34 : 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#f1f3f5' },
  back: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', color: '#212529' },
  content: { padding: 16, paddingBottom: 40 },
  loading: { marginTop: 32 },
});

export default ActivityScreen;
