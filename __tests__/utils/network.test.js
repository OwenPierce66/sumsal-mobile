/**
 * __tests__/utils/network.test.js
 */
import { isNetOnline, isNetworkError } from '../../utils/network';

describe('isNetOnline', () => {
  it('true cuando está conectado y con internet', () => {
    expect(isNetOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
  });

  it('false cuando no hay conexión', () => {
    expect(isNetOnline({ isConnected: false, isInternetReachable: false })).toBe(false);
    expect(isNetOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
  });

  it('false cuando hay red pero sin internet (wifi sin salida)', () => {
    expect(isNetOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });

  it('true cuando el estado aún es desconocido (arranque de la app)', () => {
    expect(isNetOnline({ isConnected: null, isInternetReachable: null })).toBe(true);
    expect(isNetOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isNetOnline(undefined)).toBe(true);
    expect(isNetOnline(null)).toBe(true);
  });
});

describe('isNetworkError', () => {
  it('detecta ERR_NETWORK sin respuesta del servidor', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(true);
  });

  it('detecta el mensaje clásico de axios antiguo', () => {
    expect(isNetworkError({ message: 'Network Error' })).toBe(true);
  });

  it('false si el servidor respondió (400, 401, 500…)', () => {
    expect(isNetworkError({ code: 'ERR_BAD_REQUEST', response: { status: 400 } })).toBe(false);
    expect(isNetworkError({ message: 'Network Error', response: { status: 502 } })).toBe(false);
  });

  it('false para timeouts: el servidor pudo estar lento, no offline', () => {
    expect(isNetworkError({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' })).toBe(false);
  });

  it('false para valores vacíos', () => {
    expect(isNetworkError(undefined)).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
