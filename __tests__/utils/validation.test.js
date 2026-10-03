import {
  validateEmail,
  validateEmailOrUsername,
  validatePassword,
  validatePasswordConfirm,
  validateUsername,
  runValidations,
} from '../../utils/validation';

describe('validateEmail', () => {
  it('error cuando está vacío', () => {
    expect(validateEmail('')).toBe('El email es obligatorio.');
    expect(validateEmail(null)).toBe('El email es obligatorio.');
    expect(validateEmail(undefined)).toBe('El email es obligatorio.');
  });
  it('error con formato inválido', () => {
    expect(validateEmail('notanemail')).toBe('Ingresa un email válido.');
    expect(validateEmail('test@')).toBe('Ingresa un email válido.');
    expect(validateEmail('@domain.com')).toBe('Ingresa un email válido.');
  });
  it('null para emails válidos', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('user.name@domain.co.uk')).toBeNull();
    expect(validateEmail('test+filter@gmail.com')).toBeNull();
  });
  it('ignora espacios en blanco', () => {
    expect(validateEmail('  user@example.com  ')).toBeNull();
  });
});

describe('validateEmailOrUsername', () => {
  it('error cuando está vacío', () => {
    expect(validateEmailOrUsername('')).toBe('El email o usuario es obligatorio.');
    expect(validateEmailOrUsername(null)).toBe('El email o usuario es obligatorio.');
  });
  it('null para cualquier valor no vacío', () => {
    expect(validateEmailOrUsername('john')).toBeNull();
    expect(validateEmailOrUsername('john@example.com')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('error cuando está vacía', () => {
    expect(validatePassword('')).toBe('La contraseña es obligatoria.');
    expect(validatePassword(null)).toBe('La contraseña es obligatoria.');
  });
  it('error con menos de 8 caracteres', () => {
    expect(validatePassword('1234567')).toBe('Mínimo 8 caracteres.');
    expect(validatePassword('abc')).toBe('Mínimo 8 caracteres.');
  });
  it('null para contraseñas válidas', () => {
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('SecurePass123!')).toBeNull();
  });
});

describe('validatePasswordConfirm', () => {
  it('error cuando la confirmación está vacía', () => {
    expect(validatePasswordConfirm('password123', '')).toBe('Confirma tu contraseña.');
    expect(validatePasswordConfirm('password123', null)).toBe('Confirma tu contraseña.');
  });
  it('error cuando no coinciden', () => {
    expect(validatePasswordConfirm('pass123', 'pass456')).toBe('Las contraseñas no coinciden.');
  });
  it('null cuando coinciden', () => {
    expect(validatePasswordConfirm('password123', 'password123')).toBeNull();
  });
});

describe('validateUsername', () => {
  it('error cuando está vacío', () => {
    expect(validateUsername('')).toBe('El nombre de usuario es obligatorio.');
    expect(validateUsername(null)).toBe('El nombre de usuario es obligatorio.');
  });
  it('error con menos de 3 caracteres', () => {
    expect(validateUsername('ab')).toBe('Mínimo 3 caracteres.');
  });
  it('error con más de 30 caracteres', () => {
    expect(validateUsername('a'.repeat(31))).toBe('Máximo 30 caracteres.');
  });
  it('error con caracteres no permitidos', () => {
    expect(validateUsername('user name')).toBe('Solo letras, números, puntos, guiones y _.');
    expect(validateUsername('user@name')).toBe('Solo letras, números, puntos, guiones y _.');
  });
  it('null para usernames válidos', () => {
    expect(validateUsername('john_doe')).toBeNull();
    expect(validateUsername('john.doe-123')).toBeNull();
    expect(validateUsername('abc')).toBeNull();
    expect(validateUsername('a'.repeat(30))).toBeNull();
  });
});

describe('runValidations', () => {
  it('objeto vacío cuando todos pasan', () => {
    expect(runValidations({ email: () => null, password: () => null })).toEqual({});
  });
  it('incluye solo campos con error', () => {
    const errors = runValidations({
      email: () => 'El email es obligatorio.',
      password: () => null,
      username: () => 'Mínimo 3 caracteres.',
    });
    expect(errors).toEqual({
      email: 'El email es obligatorio.',
      username: 'Mínimo 3 caracteres.',
    });
  });
  it('no incluye campos que pasaron', () => {
    const errors = runValidations({ email: () => 'error', password: () => null });
    expect(errors).not.toHaveProperty('password');
  });
});
