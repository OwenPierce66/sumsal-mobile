/**
 * __tests__/components/TestimonialPost.test.js
 *
 * Un testimonio escrito en un perfil (una publicación "testimonios") con el estilo de los
 * testimonios: su cita, like, comentarios y compartir en mi historia; sin factores ni impulsar.
 */
import React from 'react';
import { Alert, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import TestimonialPost from '../../components/TestimonialPost';
import { getStoryMedia } from '../../utils/storyWindow';

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: [] })), post: jest.fn() },
  getImageUrl: (path) => path || null,
}));
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));
jest.mock('../../screens/TieredLikesModal', () => () => null);

const TESTIMONIAL = {
  id: 't1',
  kind: 'task',
  status: 'pending',
  title: 'Gran maestro',
  description: 'Luis siempre ayuda',
  pch: 'testimonios',
  created_at: '2026-10-28T12:00:00Z',
  user: { id: 'ana', username: 'ana' },
  testimonial_for_info: { id: 'luis', username: 'luis' },
  likes_count: 0,
  comments_count: 2,
};

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((p) => typeof p === 'string' || typeof p === 'number').join(''));
const press = async (renderer, label) => {
  const target = renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((c) => c.type === Text && [].concat(c.props.children).join('') === label).length > 0
  )).pop();
  await act(async () => { await target.props.onPress(); });
};

let mounted;
let navigation;
beforeEach(() => {
  navigation = { push: jest.fn(), navigate: jest.fn() };
  api.post.mockReset();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  Alert.alert.mockRestore();
});
const render = async (props) => {
  await act(async () => {
    mounted = TestRenderer.create(<TestimonialPost testimonial={TESTIMONIAL} navigation={navigation} {...props} />);
  });
  return mounted;
};

it('la persona del perfil ve la cita pendiente y decide si la muestra', async () => {
  const onAnswer = jest.fn();
  const renderer = await render({ isOwner: true, onAnswer });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining([
    'Pendiente: solo tú lo ves hasta que lo apruebes', 'Gran maestro', '“Luis siempre ayuda”',
  ]));
  // Sin aprobar todavía no tiene like, comentarios ni historia.
  expect(renderer.root.findAll((n) => n.props.accessibilityLabel === 'Compartir en mi historia')).toHaveLength(0);
  await pressText(renderer, 'Mostrar en mi perfil');
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }), 'approved');
});

it('quien lo escribió ve que espera aprobación y puede abrir su menú de 3 puntos', async () => {
  const onOpenActions = jest.fn();
  const renderer = await render({ isMine: true, onOpenActions });
  expect(textsOf(renderer)).toContain('Esperando a que lo apruebe para mostrarlo en su perfil');
  await press(renderer, 'Más opciones del testimonio');
  expect(onOpenActions).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
});

it('aprobado: like, comentarios y compartir en mi historia (sin factores ni impulsar)', async () => {
  api.post
    .mockResolvedValueOnce({ data: { liked: true, likes_count: 1 } })
    .mockResolvedValueOnce({ data: { id: 'story-1' } });
  const renderer = await render({ testimonial: { ...TESTIMONIAL, status: 'approved' } });
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining(['2', 'Mi historia']));
  expect(texts).not.toContain('Factores');
  const { Ionicons } = require('@expo/vector-icons');
  expect(renderer.root.findAllByType(Ionicons).map((icon) => icon.props.name)).not.toContain('trending-up-outline');

  await press(renderer, 'Me gusta');
  expect(api.post).toHaveBeenCalledWith('tasks/t1/like/');
  expect(textsOf(renderer)).toContain('1');

  await press(renderer, 'Comentarios');
  expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't1' });

  await press(renderer, 'Compartir en mi historia');
  expect(api.post).toHaveBeenLastCalledWith('stories/share-task/', { task_id: 't1' });
  expect(Alert.alert).toHaveBeenCalledWith('Listo', 'Se compartió en tu historia de 24 horas.');
});

it('en historias, un testimonio compartido se ve como texto', () => {
  expect(getStoryMedia({ testimonial_story: { title: 'Gran maestro', text: 'Luis siempre ayuda', for_username: 'luis' } }))
    .toEqual({ type: 'text', title: 'Gran maestro', text: 'Luis siempre ayuda', forUsername: 'luis' });
  expect(getStoryMedia({ image: 'foto.jpg', testimonial_story: { text: 'x' } }).type).toBe('image');
});
