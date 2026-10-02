/**
 * utils/validation.js
 *
 * Reglas de validación reutilizables para formularios de auth y perfil.
 * Devuelven un string con el mensaje de error o null si es válido.
 *
 * Uso:
 *   import { validateEmail, validatePassword } from '../utils/validation';
 *   const err = validateEmail(value);
 *   if (err) setErrors(prev => ({ ...prev, email: err }));
 */

/** Regex de email — cubre el 99.9% de emails válidos del mundo real */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Solo letras, números, puntos, guiones y guiones bajos */
const USERNAME_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Valida un email.
 * @param {string} value
 * @returns {string|null} mensaje de error o null
 */
export function validateEmail(value) {
  const v = (value || '').trim();
  if (!v) return 'El email es obligatorio.';
  if (!EMAIL_RE.test(v)) return 'Ingresa un email válido.';
  return null;
}

/**
 * Valida un campo que acepta email o username para el login.
 * @param {string} value
 * @returns {string|null}
 */
export function validateEmailOrUsername(value) {
  const v = (value || '').trim();
  if (!v) return 'El email o usuario es obligatorio.';
  return null;
}

/**
 * Valida una contraseña.
 * @param {string} value
 * @returns {string|null}
 */
export function validatePassword(value) {
  const v = value || '';
  if (!v) return 'La contraseña es obligatoria.';
  if (v.length < 8) return 'Mínimo 8 caracteres.';
  return null;
}

/**
 * Valida que la confirmación coincide con la contraseña.
 * @param {string} password
 * @param {string} confirm
 * @returns {string|null}
 */
export function validatePasswordConfirm(password, confirm) {
  if (!confirm) return 'Confirma tu contraseña.';
  if (password !== confirm) return 'Las contraseñas no coinciden.';
  return null;
}

/**
 * Valida un nombre de usuario.
 * @param {string} value
 * @returns {string|null}
 */
export function validateUsername(value) {
  const v = (value || '').trim();
  if (!v) return 'El nombre de usuario es obligatorio.';
  if (v.length < 3) return 'Mínimo 3 caracteres.';
  if (v.length > 30) return 'Máximo 30 caracteres.';
  if (!USERNAME_RE.test(v)) return 'Solo letras, números, puntos, guiones y _.';
  return null;
}

/**
 * Ejecuta un mapa de { campo: valorActual } con sus validadores
 * y devuelve { campo: mensajeError } — solo los campos con error.
 *
 * @param {{ [field: string]: () => string|null }} rules
 *   Objeto donde cada valor es una función que retorna null o un mensaje.
 * @returns {{ [field: string]: string }}
 */
export function runValidations(rules) {
  const errors = {};
  for (const [field, validator] of Object.entries(rules)) {
    const err = validator();
    if (err) errors[field] = err;
  }
  return errors;
}
