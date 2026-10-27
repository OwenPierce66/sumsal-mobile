/**
 * __tests__/utils/links.test.js
 *
 * Enlaces dentro del texto de las descripciones.
 */
import { normalizeLink, getSafeLink, splitTextWithLinks, withLegacyLink } from '../../utils/links';

describe('normalizeLink', () => {
  it('agrega https:// cuando falta el esquema', () => {
    expect(normalizeLink('ejemplo.com/articulo')).toBe('https://ejemplo.com/articulo');
    expect(normalizeLink('www.ejemplo.com:8080/x')).toBe('https://www.ejemplo.com:8080/x');
  });

  it('respeta el esquema existente y quita espacios', () => {
    expect(normalizeLink('  http://ejemplo.com  ')).toBe('http://ejemplo.com');
  });

  it('trata los valores vacíos que dejaba la web antigua como vacío', () => {
    expect(normalizeLink(undefined)).toBe('');
    expect(normalizeLink('undefined')).toBe('');
    expect(normalizeLink(' null ')).toBe('');
  });
});

describe('getSafeLink', () => {
  it('acepta enlaces web', () => {
    expect(getSafeLink('ejemplo.com')).toBe('https://ejemplo.com');
    expect(getSafeLink('https://sub.ejemplo.com/a?b=1')).toBe('https://sub.ejemplo.com/a?b=1');
  });

  it('rechaza esquemas peligrosos o enlaces sin dominio', () => {
    expect(getSafeLink('javascript:alert(1)')).toBeNull();
    expect(getSafeLink('mailto:a@b.com')).toBeNull();
    expect(getSafeLink('hola')).toBeNull();
    expect(getSafeLink('https://ejemplo .com')).toBeNull();
    expect(getSafeLink('')).toBeNull();
  });
});

describe('splitTextWithLinks', () => {
  it('separa texto y enlaces conservando lo escrito', () => {
    expect(splitTextWithLinks('Lee https://ejemplo.com/guia y www.otro.org/x para más')).toEqual([
      { text: 'Lee ' },
      { text: 'https://ejemplo.com/guia', url: 'https://ejemplo.com/guia' },
      { text: ' y ' },
      { text: 'www.otro.org/x', url: 'https://www.otro.org/x' },
      { text: ' para más' },
    ]);
  });

  it('no se lleva la puntuación pegada al enlace', () => {
    expect(splitTextWithLinks('Mira https://x.com.')).toEqual([
      { text: 'Mira ' },
      { text: 'https://x.com', url: 'https://x.com' },
      { text: '.' },
    ]);
    expect(splitTextWithLinks('(ver https://x.com/a)')[1]).toEqual({ text: 'https://x.com/a', url: 'https://x.com/a' });
    expect(splitTextWithLinks('https://es.wikipedia.org/wiki/Ley_(derecho)')[0].url)
      .toBe('https://es.wikipedia.org/wiki/Ley_(derecho)');
  });

  it('deja el texto sin enlaces tal cual', () => {
    expect(splitTextWithLinks('archivo.pdf sin enlaces')).toEqual([{ text: 'archivo.pdf sin enlaces' }]);
    expect(splitTextWithLinks('')).toEqual([]);
    expect(splitTextWithLinks(null)).toEqual([]);
  });
});

describe('withLegacyLink', () => {
  it('agrega al final el enlace que la web guardaba aparte', () => {
    expect(withLegacyLink('Guía completa', 'ejemplo.com/guia')).toBe('Guía completa\nhttps://ejemplo.com/guia');
    expect(withLegacyLink('', 'https://x.com')).toBe('https://x.com');
  });

  it('no lo repite si ya está escrito en la descripción', () => {
    expect(withLegacyLink('Ver https://x.com', 'https://x.com')).toBe('Ver https://x.com');
    expect(withLegacyLink('Ver ejemplo.com/guia', 'ejemplo.com/guia')).toBe('Ver ejemplo.com/guia');
  });

  it('ignora enlaces vacíos o basura de la web antigua', () => {
    expect(withLegacyLink('Texto', 'undefined')).toBe('Texto');
    expect(withLegacyLink('Texto', '')).toBe('Texto');
    expect(withLegacyLink(null, null)).toBe('');
  });
});
