/**
 * __tests__/components/TopCommentPreview.test.js
 *
 * Bajo cada publicación: el comentario con más interacción y su mejor respuesta, con
 * me gusta, responder y comentar ahí mismo.
 */
import React from 'react';
import { Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import TopCommentPreview from '../../components/TopCommentPreview';
import { pickTopComment, interactionOf } from '../../utils/topComment';

jest.mock('@api', () => ({
  __esModule: true,
  default: { post: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
  UPLOAD_TIMEOUT_MS: 120000,
}));
jest.mock('@hooks/useApi', () => ({ useMe: () => ({ data: { id: 'me', username: 'yo' } }) }));
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));
jest.mock('../../components/UserBadges', () => () => null);
// Los selectores de publicación guardada y de etiquetas tienen sus propias pruebas.
jest.mock('../../components/FavoriteAportacionPicker', () => () => null);
jest.mock('../../components/UserTagPicker', () => () => null);
jest.mock('../../utils/mediaUpload', () => ({
  pickPhotoOrVideo: jest.fn(() => Promise.resolve({ uri: 'file://foto.jpg', type: 'image' })),
  appendMediaFile: jest.fn((formData, field) => Promise.resolve(formData.append(field, 'FOTO'))),
  isVideoAsset: () => false,
}));

const comment = (id, { likes = 0, children = [], parent = null, at = '2026-10-01T10:00:00Z', author = 'ana', text } = {}) => ({
  id, parent, likes_count: likes, user_has_liked: false, children, created_at: at,
  created_by: { id: author, username: author }, text: text || `comentario ${id}`,
});

describe('pickTopComment', () => {
  it('elige por likes más respuestas, y su mejor respuesta', () => {
    const replyA = comment(11, { likes: 1, parent: 1 });
    const replyB = comment(12, { likes: 4, parent: 1 });
    const comments = [
      comment(1, { likes: 1, children: [replyA, replyB] }), // 1 + 2 respuestas = 3
      comment(2, { likes: 2 }),
      replyA, replyB, // las respuestas también vienen sueltas en la lista
    ];
    expect(interactionOf(comments[0])).toBe(3);
    const { comment: top, reply } = pickTopComment(comments);
    expect(top.id).toBe(1);
    expect(reply.id).toBe(12);
  });

  it('si empatan gana el más reciente; sin comentarios no hay nada', () => {
    const top = pickTopComment([comment(1, { at: '2026-10-01T10:00:00Z' }), comment(2, { at: '2026-10-02T10:00:00Z' })]);
    expect(top.comment.id).toBe(2);
    expect(top.reply).toBeNull();
    expect(pickTopComment([])).toEqual({ comment: null, reply: null });
  });
});

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const byLabel = (renderer, label) => renderer.root.findAll((n) => n.props.accessibilityLabel === label && n.props.onPress)[0];
const press = async (renderer, label) => {
  const target = byLabel(renderer, label);
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const input = (renderer) => renderer.root.findAll((n) => n.type === TextInput)[0];

describe('TopCommentPreview', () => {
  const TASK = {
    id: 't1',
    comments_count: 5,
    comments: [comment(1, { likes: 3, children: [comment(11, { likes: 2, parent: 1, author: 'luis' })] }), comment(2)],
  };
  let mounted;
  let onCountChange;
  let onOpenComments;
  beforeEach(async () => {
    api.post.mockReset();
    onCountChange = jest.fn();
    onOpenComments = jest.fn();
    await act(async () => {
      mounted = TestRenderer.create(
        <TopCommentPreview task={TASK} navigation={{ navigate: jest.fn() }} onOpenComments={onOpenComments} onCountChange={onCountChange} />,
      );
    });
  });
  afterEach(() => { act(() => mounted.unmount()); });

  it('muestra el destacado, su mejor respuesta y el enlace a todos', async () => {
    const texts = textsOf(mounted);
    expect(texts).toEqual(expect.arrayContaining(['comentario 1', 'comentario 11', 'Ver los 5 comentarios']));
    expect(texts).not.toContain('comentario 2');
    await act(async () => { mounted.root.findAll((n) => n.props.onPress && n.findAll((c) => c.type === Text && c.props.children?.join?.('') === 'Ver los 5 comentarios').length)[0].props.onPress(); });
    expect(onOpenComments).toHaveBeenCalled();
  });

  it('me gusta al comentario: cambia al instante y toma el total del servidor', async () => {
    api.post.mockResolvedValue({ data: { liked: true, likes_count: 9 } });
    await press(mounted, 'Me gusta el comentario');
    expect(api.post).toHaveBeenCalledWith('comments/1/like/');
    expect(textsOf(mounted)).toContain('9');
    expect(byLabel(mounted, 'Quitar me gusta del comentario')).toBeDefined();
  });

  it('el campo para escribir solo aparece al tocar "Responder"', async () => {
    expect(mounted.root.findAll((n) => n.type === TextInput)).toHaveLength(0);
    expect(byLabel(mounted, 'Adjuntar al comentario')).toBeUndefined();

    api.post.mockResolvedValue({ data: { id: 50, text: 'gracias', created_by: { id: 'me', username: 'yo' } } });
    await press(mounted, 'Responder a ana');
    expect(textsOf(mounted)).toContain('Respondiendo a @ana');
    await act(async () => { input(mounted).props.onChangeText('gracias'); });
    await press(mounted, 'Enviar respuesta');
    expect(api.post).toHaveBeenCalledWith('tasks/t1/comments/', { text: 'gracias', parent: 1 });
    expect(textsOf(mounted)).toContain('gracias');
    expect(onCountChange).toHaveBeenCalledWith(1);
    // Al enviar se cierra el campo.
    expect(mounted.root.findAll((n) => n.type === TextInput)).toHaveLength(0);
  });

  it('el clip ofrece publicación guardada, etiquetar y foto o video; la foto viaja en el formulario', async () => {
    api.post.mockResolvedValue({ data: { id: 52, text: '', attachment_url: 'f.jpg', attachment_type: 'image', created_by: { id: 'me' } } });
    await press(mounted, 'Responder a ana');
    await press(mounted, 'Adjuntar al comentario');
    expect(textsOf(mounted)).toEqual(expect.arrayContaining([
      'Comentar con una publicación guardada', 'Etiquetar personas', 'Adjuntar foto o video',
    ]));
    await press(mounted, 'Adjuntar foto o video');
    expect(textsOf(mounted)).toContain('Foto adjunta');

    await press(mounted, 'Enviar respuesta');
    const [path, body, config] = api.post.mock.calls[0];
    expect(path).toBe('tasks/t1/comments/');
    expect(body).toBeInstanceOf(FormData);
    expect(config).toEqual(expect.objectContaining({ timeout: expect.any(Number) }));
    expect(mounted.root.findAll((n) => n.props.accessibilityLabel === 'Foto del comentario').length).toBeGreaterThan(0);
  });
});
