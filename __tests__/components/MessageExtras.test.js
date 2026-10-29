/**
 * __tests__/components/MessageExtras.test.js
 *
 * El clip en el foro y en los comentarios de compartidas: publicación guardada, etiquetas y
 * foto o video, el cuerpo que se envía y cómo se ve lo que trae cada mensaje.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { useMessageExtras, MessageExtrasView } from '../../components/MessageExtras';
import { buildMessageBody } from '../../utils/commentAportacion';

jest.mock('@api', () => ({ __esModule: true, default: {}, getImageUrl: (path) => path || null }));
jest.mock('../../components/FavoriteAportacionPicker', () => () => null);
jest.mock('../../components/UserTagPicker', () => () => null);
jest.mock('../../components/UserBadges', () => () => null);
jest.mock('../../utils/mediaUpload', () => ({
  pickPhotoOrVideo: jest.fn(() => Promise.resolve({ uri: 'file://foto.jpg', type: 'image' })),
  appendMediaFile: jest.fn((formData, field) => Promise.resolve(formData.append(field, 'FOTO'))),
  isVideoAsset: () => false,
}));

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string').join(''));
const press = async (renderer, label) => {
  const target = renderer.root.findAll((n) => n.props.accessibilityLabel === label && n.props.onPress)[0];
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

describe('buildMessageBody', () => {
  it('sin foto: JSON con la publicación guardada y las etiquetas', async () => {
    const body = await buildMessageBody({ content: 'hola', parent: null }, { aportacion: { id: 't1' }, tagIds: ['u1'] });
    expect(body).toEqual({ content: 'hola', parent: null, aportacion: 't1', tagged_user_ids: ['u1'] });
  });

  it('con foto: formulario sin los campos vacíos', async () => {
    const body = await buildMessageBody({ text: 'mira', parent: null }, { tagIds: ['u1', 'u2'], media: { uri: 'x' } });
    expect(body).toBeInstanceOf(FormData);
    // FormData del navegador (entries) o el de React Native (getParts), según el entorno.
    const parts = typeof body.entries === 'function'
      ? [...body.entries()].map(([key, value]) => [key, String(value)])
      : body.getParts().map((part) => [part.fieldName, part.string]);
    expect(parts).toEqual([['text', 'mira'], ['tagged_user_ids', 'u1'], ['tagged_user_ids', 'u2'], ['attachment', 'FOTO']]);
  });
});

describe('useMessageExtras', () => {
  let extras;
  const Harness = ({ allowMedia = true }) => {
    extras = useMessageExtras({ allowMedia });
    return <>{extras.clip}{extras.preview}{extras.pickers}</>;
  };

  it('el clip ofrece las tres opciones y la foto elegida viaja en el formulario', async () => {
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<Harness />); });
    await press(renderer, 'Adjuntar al comentario');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining([
      'Comentar con una publicación guardada', 'Etiquetar personas', 'Adjuntar foto o video',
    ]));
    await press(renderer, 'Adjuntar foto o video');
    expect(textsOf(renderer)).toContain('Foto adjunta');
    expect(extras.hasMedia).toBe(true);
    expect(await extras.buildBody({ content: 'hola' })).toBeInstanceOf(FormData);

    await act(async () => { extras.reset(); });
    expect(extras.hasMedia).toBe(false);
    act(() => renderer.unmount());
  });

  it('al editar no ofrece foto o video', async () => {
    let renderer;
    await act(async () => { renderer = TestRenderer.create(<Harness allowMedia={false} />); });
    await press(renderer, 'Adjuntar al comentario');
    expect(textsOf(renderer)).not.toContain('Adjuntar foto o video');
    act(() => renderer.unmount());
  });
});

describe('MessageExtrasView', () => {
  it('muestra la foto, la publicación guardada (abre la tarea) y con quién está etiquetado', async () => {
    const navigation = { navigate: jest.fn() };
    let renderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <MessageExtrasView
          navigation={navigation}
          item={{
            attachment_url: 'f.jpg',
            attachment_type: 'image',
            aportacion_info: { id: 't1', title: 'Guía de becas', username: 'ana' },
            tagged_users: [{ id: 'u1', username: 'luis' }],
          }}
        />,
      );
    });
    const texts = textsOf(renderer);
    expect(texts).toEqual(expect.arrayContaining(['Guía de becas', 'Con:', '@luis']));
    expect(renderer.root.findAll((n) => n.props.accessibilityLabel === 'Foto del comentario').length).toBeGreaterThan(0);
    await press(renderer, 'Publicación guardada: Guía de becas. Abrir aportación');
    expect(navigation.navigate).toHaveBeenCalledWith('TaskDetail', { taskId: 't1' });
    act(() => renderer.unmount());
  });

  it('un mensaje sin nada adjunto no dibuja nada', () => {
    let renderer;
    act(() => { renderer = TestRenderer.create(<MessageExtrasView item={{ content: 'hola' }} />); });
    expect(renderer.toJSON()).toBeNull();
  });
});
