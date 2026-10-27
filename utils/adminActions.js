import { Alert } from 'react-native';
import api from '@api';

/**
 * Acciones de moderación de cuentas (solo superadmin; el backend lo valida).
 * Las usan los menús de 3 puntos del perfil y de las publicaciones.
 */
const errorMessage = (error) => {
  const data = error?.response?.data;
  return data?.detail || data?.is_active?.[0] || data?.is_staff?.[0] || 'Inténtalo de nuevo.';
};

const confirmAction = (title, message, onConfirm, destructive = false) => {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Confirmar', style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
};

/** Suspende (`active=false`) o reactiva (`active=true`) una cuenta, con confirmación. */
export const setAccountActive = (userId, name, active, onDone) => {
  const label = name || 'esta cuenta';
  confirmAction(
    active ? 'Reactivar cuenta' : 'Suspender cuenta',
    active
      ? `¿Reactivar la cuenta de ${label}?`
      : `La cuenta de ${label} quedará desactivada; sus datos se conservarán.`,
    async () => {
      try {
        await api.post(`admin/users/${userId}/active/`, { is_active: active });
        onDone?.();
      } catch (error) {
        Alert.alert(active ? 'No se pudo reactivar' : 'No se pudo suspender', errorMessage(error));
      }
    },
    !active,
  );
};

/** Da (`isStaff=true`) o quita el rol de staff, con confirmación. */
export const setAccountStaff = (userId, name, isStaff, onDone) => {
  const label = name || 'esta cuenta';
  confirmAction(
    isStaff ? 'Asignar rol staff' : 'Quitar rol staff',
    `${isStaff ? 'Se otorgarán' : 'Se retirarán'} permisos de moderación a ${label}.`,
    async () => {
      try {
        await api.post(`admin/users/${userId}/role/`, { is_staff: isStaff });
        onDone?.();
      } catch (error) {
        Alert.alert('No se pudo actualizar el rol', errorMessage(error));
      }
    },
  );
};
