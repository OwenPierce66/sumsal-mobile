import {
  getTranslatableText,
  canTranslateMessage,
  translationKey,
  translationEndpoint,
  translationErrorMessage,
  translationFromResponse,
  languageName,
} from '../../utils/translation';

describe('getTranslatableText', () => {
  it('devuelve el texto tal cual en un mensaje normal', () => {
    expect(getTranslatableText('  Hello world ')).toBe('Hello world');
  });

  it('ignora la línea automática de publicación compartida', () => {
    expect(getTranslatableText('↪ Publicación compartida: Mi tarea [task:7]\nHello friend')).toBe('Hello friend');
  });

  it('ignora la línea automática de respuesta a historia', () => {
    expect(getTranslatableText('↪ Respuesta a tu historia: Viaje [story:3]\nNice photo\nSecond line')).toBe(
      'Nice photo\nSecond line',
    );
  });

  it('no hay nada que traducir si solo viene la línea automática o está vacío', () => {
    expect(getTranslatableText('↪ Respuesta a tu historia: Viaje [story:3]')).toBe('');
    expect(getTranslatableText('   ')).toBe('');
    expect(getTranslatableText(null)).toBe('');
  });
});

describe('canTranslateMessage', () => {
  it('solo es traducible cuando hay texto', () => {
    expect(canTranslateMessage({ content: 'Hola' })).toBe(true);
    expect(canTranslateMessage({ content: '', image: 'x.jpg' })).toBe(false);
    expect(canTranslateMessage(undefined)).toBe(false);
  });
});

describe('claves y rutas', () => {
  it('distingue directos de grupos aunque el id coincida', () => {
    expect(translationKey('direct', 5)).toBe('direct:5');
    expect(translationKey('group', 5)).toBe('group:5');
  });

  it('usa el endpoint correcto según el tipo', () => {
    expect(translationEndpoint('direct', 5)).toBe('massaging/messages/5/translate/');
    expect(translationEndpoint('group', 5)).toBe('massaging/group_messages/5/translate/');
  });
});

describe('translationErrorMessage', () => {
  const withStatus = (status, detail) => ({ response: { status, data: detail ? { detail } : {} } });

  it('explica cada tipo de fallo', () => {
    expect(translationErrorMessage(withStatus(503))).toMatch(/todavía no está disponible/);
    expect(translationErrorMessage(withStatus(429))).toMatch(/límite/);
    expect(translationErrorMessage(withStatus(502))).toMatch(/Inténtalo de nuevo/);
    expect(translationErrorMessage(withStatus(404))).toMatch(/No se encontró/);
  });

  it('muestra el detalle del backend en un 400', () => {
    expect(translationErrorMessage(withStatus(400, 'El mensaje es demasiado largo para traducirlo.'))).toBe(
      'El mensaje es demasiado largo para traducirlo.',
    );
  });

  it('distingue la falta de conexión', () => {
    expect(translationErrorMessage(new Error('Network Error'))).toMatch(/Sin conexión/);
  });
});

describe('translationFromResponse', () => {
  it('convierte la respuesta del backend al estado de la pantalla', () => {
    expect(
      translationFromResponse({ text: 'Hola', source_lang: 'en', target_lang: 'es', same_language: false }),
    ).toEqual({ status: 'done', text: 'Hola', sourceLang: 'en', sameLanguage: false, showOriginal: false });
  });

  it('marca cuando el mensaje ya estaba en tu idioma', () => {
    expect(translationFromResponse({ text: 'Hola', source_lang: 'es', same_language: true }).sameLanguage).toBe(true);
  });
});

describe('languageName', () => {
  it('traduce códigos, incluso regionales, y devuelve vacío si no los conoce', () => {
    expect(languageName('en')).toBe('Inglés');
    expect(languageName('PT-BR')).toBe('Portugués');
    expect(languageName('xx')).toBe('');
    expect(languageName(undefined)).toBe('');
  });
});
