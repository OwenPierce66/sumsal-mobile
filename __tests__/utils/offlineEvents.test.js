/**
 * __tests__/utils/offlineEvents.test.js
 */
import { onOfflineWrite, emitOfflineWrite } from '../../utils/offlineEvents';

describe('offlineEvents', () => {
  it('notifica a los listeners suscritos', () => {
    const listener = jest.fn();
    const unsubscribe = onOfflineWrite(listener);
    emitOfflineWrite();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('deja de notificar tras cancelar la suscripción', () => {
    const listener = jest.fn();
    const unsubscribe = onOfflineWrite(listener);
    unsubscribe();
    emitOfflineWrite();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifica a varios listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = onOfflineWrite(a);
    const unsubB = onOfflineWrite(b);
    emitOfflineWrite();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });

  it('un listener que lanza error no impide notificar a los demás ni propaga la excepción', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = jest.fn(() => {
      throw new Error('boom');
    });
    const good = jest.fn();
    const unsubBad = onOfflineWrite(bad);
    const unsubGood = onOfflineWrite(good);

    expect(() => emitOfflineWrite()).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);

    unsubBad();
    unsubGood();
    warn.mockRestore();
  });

  it('emitir sin listeners no falla', () => {
    expect(() => emitOfflineWrite()).not.toThrow();
  });
});
