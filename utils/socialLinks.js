/**
 * utils/socialLinks.js
 *
 * Redes sociales del perfil: cada persona escribe su usuario, @usuario, el enlace o (en
 * WhatsApp) su número; aquí se arma el enlace que abre la red.
 */

export const SOCIAL_NETWORKS = [
  { key: 'instagram', label: 'Instagram', placeholder: '@usuario' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@usuario' },
  { key: 'youtube', label: 'YouTube', placeholder: '@canal o enlace' },
  { key: 'x', label: 'X (Twitter)', placeholder: '@usuario' },
  { key: 'facebook', label: 'Facebook', placeholder: 'usuario o enlace' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'usuario o enlace' },
  { key: 'website', label: 'Sitio web', placeholder: 'tusitio.com' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+52 55 1234 5678' },
];

const PROFILE_URLS = {
  instagram: (handle) => `https://instagram.com/${handle}`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${handle}`,
  x: (handle) => `https://x.com/${handle}`,
  facebook: (handle) => `https://facebook.com/${handle}`,
  linkedin: (handle) => `https://www.linkedin.com/in/${handle}`,
};

const isUrl = (text) => /^https?:\/\//i.test(text);

/** El enlace que abre esa red (null si no hay nada que abrir). */
export function socialUrl(network, value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (network === 'whatsapp') {
    const digits = text.replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  }
  if (isUrl(text)) return text;
  if (network === 'website') return `https://${text.replace(/^\/+/, '')}`;
  // Si pegaron el enlace sin "https://" (instagram.com/ana), se respeta.
  if (/^(www\.)?[\w-]+\.[a-z]{2,}\//i.test(text)) return `https://${text}`;
  const handle = text.replace(/^@+/, '');
  const build = PROFILE_URLS[network];
  return build && handle ? build(encodeURIComponent(handle)) : null;
}

/** Las redes con algo escrito, en el orden de SOCIAL_NETWORKS. */
export function filledSocialLinks(links) {
  return SOCIAL_NETWORKS
    .map((network) => ({ ...network, value: links?.[network.key], url: socialUrl(network.key, links?.[network.key]) }))
    .filter((network) => network.url);
}
