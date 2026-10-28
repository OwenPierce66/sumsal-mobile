import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMe } from '@hooks/useApi';
import { usePetitionSupportTotal } from '@hooks/usePetitionSupport';
import { formatSupportTotal, isPetition } from '../utils/petitionSupport';
import PetitionSupportSheet from './PetitionSupportSheet';
import PetitionSupportersModal from './PetitionSupportersModal';

/**
 * Lo recaudado por una petición, en el extremo derecho del pie de la tarjeta
 * (frente a impulsar, likes, comentar y compartir). Como los likes: el ícono
 * abre la hoja para apoyar y el número la lista de quienes apoyaron.
 * Va como último hijo de la fila de estadísticas; `marginLeft: 'auto'` lo empuja a la derecha.
 * Solo se dibuja en peticiones.
 */
const PetitionSupportStat = ({ task, navigation }) => {
  const { data: me } = useMe();
  const total = usePetitionSupportTotal(task);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [listVisible, setListVisible] = useState(false);
  if (!task || !isPetition(task)) return null;

  const supporters = total?.supporters_count || 0;
  const isOwner = Boolean(me?.id) && String(task.user?.id || task.user) === String(me.id);

  return (
    <View style={styles.stat}>
      <TouchableOpacity onPress={() => setSheetVisible(true)} accessibilityLabel="Apoyar monetariamente esta petición">
        <Ionicons name={supporters ? 'cash' : 'cash-outline'} size={18} color="#2f9e44" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setListVisible(true)}
        style={styles.amountButton}
        accessibilityLabel="Ver quién apoyó esta petición"
      >
        <Text style={styles.amount}>{formatSupportTotal(total?.amount_mxn)}</Text>
      </TouchableOpacity>

      {/* Se montan solo al abrirlos: una lista larga de peticiones no carga una hoja por tarjeta. */}
      {sheetVisible ? (
        <PetitionSupportSheet visible onClose={() => setSheetVisible(false)} task={task} isOwner={isOwner} />
      ) : null}
      {listVisible ? (
        <PetitionSupportersModal visible onClose={() => setListVisible(false)} taskId={task.id} navigation={navigation} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  amountButton: { marginLeft: 4, padding: 4 },
  amount: { fontSize: 13, color: '#2f9e44', fontWeight: '800' },
});

export default PetitionSupportStat;
