import {
  getTranslatableText,
  canTranslateMessage,
  translationKey,
  translationEndpoint,
  translationErrorMessage,
  translationFromResponse,
  translationFromSent,
  translationLabel,
  languageName,
  liveTranslateStorageKey,
  needsLivePreview,
  sentTranslationFields,
  livePreviewRequest,
  livePreviewFromResponse,
  livePreviewFromError,
  LIVE_PREVIEW_IDLE,
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

  it('guarda "Hablar traducido" por conversación', () => {
    expect(liveTranslateStorageKey('direct', 8)).toBe('chatLiveTranslate:direct:8');
    expect(liveTranslateStorageKey('group', 8)).toBe('chatLiveTranslate:group:8');
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

describe('estado de la traducción de un mensaje', () => {
  it('convierte la respuesta del backend (se muestra abierta al tocar)', () => {
    expect(
      translationFromResponse({ text: 'Hola', source_lang: 'en', target_lang: 'es', same_language: false }),
    ).toEqual({ status: 'done', text: 'Hola', sourceLang: 'en', targetLang: 'es', sameLanguage: false, open: true });
  });

  it('marca cuando el mensaje ya estaba en tu idioma', () => {
    expect(translationFromResponse({ text: 'Hola', source_lang: 'es', same_language: true }).sameLanguage).toBe(true);
  });

  it('usa la traducción que el autor envió con el mensaje', () => {
    expect(translationFromSent({ text: 'Hello', lang: 'en', source_lang: 'es' })).toEqual({
      status: 'done',
      text: 'Hello',
      sourceLang: 'es',
      targetLang: 'en',
      sameLanguage: false,
      open: true,
    });
  });

  it('etiqueta el recuadro con el idioma o avisa que ya está en tu idioma', () => {
    expect(translationLabel({ targetLang: 'en' })).toBe('Traducción · Inglés');
    expect(translationLabel({ targetLang: '' })).toBe('Traducción');
    expect(translationLabel({ sameLanguage: true, targetLang: 'es' })).toBe('Ya está en tu idioma');
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

describe('traducción en vivo al escribir', () => {
  const done = (forText, text, extra = {}) => ({ status: 'done', forText, text, sameLanguage: false, error: '', ...extra });

  it('pide la vista previa solo cuando hay texto nuevo', () => {
    expect(needsLivePreview('', LIVE_PREVIEW_IDLE)).toBe(false);
    expect(needsLivePreview('   ', LIVE_PREVIEW_IDLE)).toBe(false);
    expect(needsLivePreview('Hola', LIVE_PREVIEW_IDLE)).toBe(true);
    expect(needsLivePreview('Hola', done('Hola', 'Hello'))).toBe(false);
    expect(needsLivePreview('Hola ', done('Hola', 'Hello'))).toBe(false);
    expect(needsLivePreview('Hola amigo', done('Hola', 'Hello'))).toBe(true);
    expect(needsLivePreview('Hola', { status: 'loading', forText: 'Hola', text: '' })).toBe(true);
  });

  it('reintenta tras un error con el mismo texto', () => {
    expect(needsLivePreview('Hola', { status: 'error', forText: 'Hola', text: '', error: 'x' })).toBe(true);
  });

  it('construye el estado de la vista previa desde la respuesta o el error', () => {
    expect(livePreviewFromResponse(' Hola ', { text: 'Hello', same_language: false })).toEqual({
      status: 'done',
      forText: 'Hola',
      text: 'Hello',
      sameLanguage: false,
      error: '',
    });
    expect(livePreviewFromResponse('Hello', { text: 'Hello', same_language: true }).sameLanguage).toBe(true);
    expect(livePreviewFromError('Hola', 'Sin conexión.')).toEqual({
      status: 'error',
      forText: 'Hola',
      text: '',
      sameLanguage: false,
      error: 'Sin conexión.',
    });
    expect(livePreviewFromError('Hola').error).toBe('No se pudo traducir.');
  });

  it('envía la traducción solo si corresponde exactamente al texto enviado', () => {
    expect(sentTranslationFields('Hola amigo', done('Hola amigo', 'Hello friend'))).toEqual({
      translation_text: 'Hello friend',
      translation_lang: 'en',
      translation_source: 'es',
    });
    expect(sentTranslationFields('Hola amigo!', done('Hola amigo', 'Hello friend'))).toBeNull();
    expect(sentTranslationFields('Hola', { status: 'loading', forText: 'Hola', text: '' })).toBeNull();
    expect(sentTranslationFields('', LIVE_PREVIEW_IDLE)).toBeNull();
  });

  it('no envía traducción si el texto ya estaba en inglés', () => {
    expect(sentTranslationFields('Hello', done('Hello', 'Hello', { sameLanguage: true }))).toBeNull();
  });

  it('arma la petición de vista previa de español a inglés', () => {
    expect(livePreviewRequest('  Hola  ')).toEqual({ text: 'Hola', source: 'es', target: 'en' });
  });
});
