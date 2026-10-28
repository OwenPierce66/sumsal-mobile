/**
 * utils/petitionSupport.js
 *
 * Qué tareas se pueden apoyar monetariamente y cómo se muestra lo recaudado.
 */

const PETITION_PCH = ['peticion', 'peticiones'];

export function isPetition(task) {
  return PETITION_PCH.includes(String(task?.pch || '').trim().toLowerCase());
}

/** Total corto para el pie de la tarjeta: "$0", "$92", "$92.50", "$1.2k", "$3.4M". */
export function formatSupportTotal(amountMxn) {
  const value = Number(amountMxn || 0);
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1).replace(/\.0$/, '')}k`;
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}
