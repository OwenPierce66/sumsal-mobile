import { buildCommentPayload, getCommentAportacion } from '../../utils/commentAportacion';

describe('buildCommentPayload', () => {
  it('comentario simple solo lleva el texto', () => {
    expect(buildCommentPayload({ text: 'hola' })).toEqual({ text: 'hola' });
  });

  it('comentario principal lleva la aportación elegida', () => {
    expect(buildCommentPayload({ text: 'hola', aportacion: { id: 'abc' } })).toEqual({
      text: 'hola',
      aportacion: 'abc',
    });
  });

  it('una respuesta lleva parent y nunca aportación', () => {
    expect(
      buildCommentPayload({ text: 'r', replyingTo: { id: 7 }, aportacion: { id: 'abc' } })
    ).toEqual({ text: 'r', parent: 7 });
  });

  it('ignora una aportación sin id', () => {
    expect(buildCommentPayload({ text: 'x', aportacion: {} })).toEqual({ text: 'x' });
  });
});

describe('getCommentAportacion', () => {
  it('devuelve null sin aportación o sin comentario', () => {
    expect(getCommentAportacion(null)).toBeNull();
    expect(getCommentAportacion({ aportacion_info: null })).toBeNull();
    expect(getCommentAportacion({})).toBeNull();
  });

  it('normaliza los datos y pone título por defecto', () => {
    expect(
      getCommentAportacion({ aportacion_info: { id: 'a', title: '', image: null, username: 'ana' } })
    ).toEqual({ id: 'a', title: 'Aportación', image: null, username: 'ana' });
  });
});
