/**
 * __tests__/utils/subscriptions.test.js
 */
import {
  amountError,
  formatMoney,
  parseAmount,
  renewalText,
  subscriptionErrorMessage,
} from '../../utils/subscriptions';

describe('parseAmount', () => {
  it('acepta coma o punto y hasta 2 decimales', () => {
    expect(parseAmount('16')).toBe(16);
    expect(parseAmount(' 37,5 ')).toBe(37.5);
    expect(parseAmount('1.25')).toBe(1.25);
    expect(parseAmount('1.255')).toBeNull();
    expect(parseAmount('-3')).toBeNull();
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('amountError', () => {
  it('el mínimo es 10 MXN (lo mínimo que cobra Stripe) o 1 USD', () => {
    expect(amountError('10', 'mxn')).toBeNull();
    expect(amountError('9.99', 'mxn')).toBe('El mínimo es $10.00 MXN al mes.');
    expect(amountError('1', 'mxn')).toBe('El mínimo es $10.00 MXN al mes.');
    expect(amountError('1', 'usd')).toBeNull();
    expect(amountError('0.5', 'usd')).toBe('El mínimo es $1.00 USD al mes.');
    expect(amountError('250', 'usd')).toBeNull();
  });

  it('atrapa montos absurdos y textos', () => {
    expect(amountError('5000', 'usd')).toMatch(/máximo/);
    expect(amountError('mucho', 'mxn')).toMatch(/monto válido/);
  });
});

describe('formatMoney', () => {
  it('muestra la moneda', () => {
    expect(formatMoney(16, 'mxn')).toBe('$16.00 MXN');
    expect(formatMoney('8.5', 'usd')).toBe('$8.50 USD');
  });
});

describe('renewalText', () => {
  const end = '2026-11-26T12:00:00Z';
  it('distingue renovación automática, fin de mes y terminada', () => {
    expect(renewalText({ is_active: true, auto_renew: true, current_period_end: end })).toBe('Se renueva el 26 de noviembre');
    expect(renewalText({ is_active: true, auto_renew: false, current_period_end: end })).toBe('Termina el 26 de noviembre');
    expect(renewalText({ is_active: false, auto_renew: true, current_period_end: end })).toBe('Terminó');
  });
});

describe('subscriptionErrorMessage', () => {
  it('usa el mensaje del backend', () => {
    expect(subscriptionErrorMessage({ response: { data: { amount: ['El mínimo es $16.00 MXN al mes.'] } } }))
      .toBe('El mínimo es $16.00 MXN al mes.');
    expect(subscriptionErrorMessage({ response: { data: { detail: 'Ya pagas una.' } } })).toBe('Ya pagas una.');
    expect(subscriptionErrorMessage(new Error('Network'))).toMatch(/conexión/);
  });
});
