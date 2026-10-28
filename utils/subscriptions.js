/**
 * utils/subscriptions.js
 *
 * Montos, insignias y fechas de las suscripciones mensuales.
 * El backend vuelve a validar todo; aquí solo se avisa antes de abrir Stripe.
 */
import moment from 'moment';
import 'moment/locale/es';

export const CURRENCIES = {
  // 10 MXN es el cobro mínimo que Stripe acepta en pesos.
  mxn: { code: 'mxn', label: 'MXN', min: 10, recommended: 16, max: 20000, presets: [10, 16, 50, 100] },
  usd: { code: 'usd', label: 'USD', min: 1, recommended: 1, max: 1000, presets: [1, 3, 5, 10] },
};

// Mismos colores que TieredLikesModal.
export const SUBSCRIPTION_TIERS = {
  sub_red: { label: 'Suscripción +', color: '#ff6b6b', icon: 'star' },
  sub_green: { label: 'Suscripción', color: '#51cf66', icon: 'star-half' },
};

/** Cuando el backend no tiene Stripe configurado o no responde. */
export const PAYMENTS_UNAVAILABLE = {
  title: 'Pagos no disponibles',
  message: 'Por ahora no se pueden hacer pagos. Intenta de nuevo más tarde.',
};

/** "37,5" / "37.50" → 37.5. Devuelve null si no es un monto con hasta 2 decimales. */
export function parseAmount(text) {
  const clean = String(text ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Number(clean);
}

/** `period`: lo que sigue al monto en el mensaje (" al mes"; vacío para un pago único). */
export function amountError(text, currencyCode, period = ' al mes') {
  const currency = CURRENCIES[currencyCode];
  const amount = parseAmount(text);
  if (amount === null) return 'Escribe un monto válido (hasta 2 decimales).';
  if (amount < currency.min) return `El mínimo es ${formatMoney(currency.min, currencyCode)}${period}.`;
  if (amount > currency.max) return `El máximo es ${formatMoney(currency.max, currencyCode)}${period}.`;
  return null;
}

export function formatMoney(amount, currencyCode) {
  const value = Number(amount || 0).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${value} ${CURRENCIES[currencyCode]?.label ?? String(currencyCode).toUpperCase()}`;
}

/** "Se renueva el 26 de noviembre" / "Termina el ..." / "Terminó". */
export function renewalText(subscription) {
  const end = subscription?.current_period_end
    ? moment(subscription.current_period_end).locale('es').format('D [de] MMMM')
    : null;
  if (!subscription?.is_active || !end) return 'Terminó';
  return subscription.auto_renew ? `Se renueva el ${end}` : `Termina el ${end}`;
}

/** Mensaje legible de un error del backend al suscribirse. */
export function subscriptionErrorMessage(error) {
  const data = error?.response?.data;
  const first = (value) => (Array.isArray(value) ? value[0] : value);
  return (
    first(data?.amount) ||
    first(data?.currency) ||
    first(data?.auto_renew) ||
    data?.detail ||
    'No se pudo completar. Revisa tu conexión e intenta de nuevo.'
  );
}
