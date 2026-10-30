import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserTagPicker from './UserTagPicker';
import { TagChips } from './MessageExtras';

/** Quién ve un post del foro (ver forum_access.py en el backend). */
export const FORUM_AUDIENCES = [
  { value: 'public', label: 'Todos', icon: 'globe-outline', hint: 'Cualquiera que vea este foro.' },
  { value: 'followers', label: 'Seguidores', icon: 'people-outline', hint: 'Solo quienes te siguen.' },
  { value: 'subscribers', label: 'Suscriptores', icon: 'card-outline', hint: 'Solo quienes pagan tu suscripción (contenido de paga).' },
  { value: 'invited', label: 'Invitados', icon: 'mail-outline', hint: 'Solo las personas que invites.' },
];

export const audienceOf = (value) => FORUM_AUDIENCES.find((item) => item.value === value) || FORUM_AUDIENCES[0];

/**
 * Elegir quién ve el post: todos, seguidores, suscriptores (de paga) o solo invitados.
 * En el foro de un grupo, "Todos" son los que ven ese grupo.
 */
const ForumAudiencePicker = ({ value = 'public', onChange, invited = [], onInvitedChange, currentUserId, inGroup = false }) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const current = audienceOf(value);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>¿Quién lo ve?</Text>
      <View style={styles.options}>
        {FORUM_AUDIENCES.map((item) => {
          const active = item.value === value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => onChange?.(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Visible para ${item.label}`}
            >
              <Ionicons name={item.icon} size={14} color={active ? '#fff' : '#1864ab'} />
              <Text style={[styles.optionText, active && styles.optionTextActive]}>
                {item.value === 'public' && inGroup ? 'Todo el grupo' : item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>{inGroup && value === 'public' ? 'Quienes ven este grupo.' : current.hint}</Text>

      {value === 'invited' ? (
        <View style={styles.invited}>
          <TagChips users={invited} onRemove={(user) => onInvitedChange?.(invited.filter((item) => String(item.id) !== String(user.id)))} />
          <TouchableOpacity style={styles.inviteButton} onPress={() => setPickerOpen(true)} accessibilityLabel="Elegir invitados">
            <Ionicons name="person-add-outline" size={16} color="#845ef7" />
            <Text style={styles.inviteText}>{invited.length ? 'Invitar a alguien más' : 'Elegir invitados'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <UserTagPicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selected={invited}
        onChange={(users) => onInvitedChange?.(users)}
        excludeIds={currentUserId ? [currentUserId] : []}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#e7f5ff' },
  optionActive: { backgroundColor: '#4dabf7' },
  optionText: { color: '#1864ab', fontSize: 13, fontWeight: '700' },
  optionTextActive: { color: '#fff' },
  hint: { color: '#868e96', fontSize: 12, marginTop: 6 },
  invited: { marginTop: 8 },
  inviteButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  inviteText: { color: '#845ef7', fontWeight: '700', fontSize: 13 },
});

export default ForumAudiencePicker;
