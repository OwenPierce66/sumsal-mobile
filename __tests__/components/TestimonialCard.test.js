/**
 * __tests__/components/TestimonialCard.test.js
 *
 * Testimonios en el perfil: comentarios donde etiquetaron a la persona.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import TestimonialCard from '../../components/TestimonialCard';

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: {} })) },
  getImageUrl: (path) => path || null,
}));

const TESTIMONIAL = {
  id: 'tag-1',
  status: 'approved',
  created_at: '2026-10-26T12:00:00Z',
  comment: { id: 10, text: 'Luis me ayudó muchísimo' },
  author: { id: 'ana', username: 'ana' },
  task: { id: 't1', title: 'Guía de becas' },
};

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));

const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && child.props.children === label).length > 0
  )).pop();
  await act(async () => { await target.props.onPress(); });
};

let mounted;
afterEach(() => { act(() => mounted?.unmount()); mounted = null; });

const render = (props) => {
  act(() => { mounted = TestRenderer.create(<TestimonialCard testimonial={TESTIMONIAL} {...props} />); });
  return mounted;
};

it('muestra quién lo escribió, el texto y en qué aportación, y abre la aportación', async () => {
  const navigation = { push: jest.fn(), navigate: jest.fn() };
  const renderer = render({ navigation });
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['“Luis me ayudó muchísimo”', 'Guía de becas']));
  expect(textsOf(renderer)).not.toContain('Quitar de mi perfil');

  const link = renderer.root.findAll((node) => node.props.accessibilityLabel === 'Abrir aportación Guía de becas' && node.props.onPress)[0];
  await act(async () => { link.props.onPress(); });
  expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't1' });
});

it('el dueño aprueba o rechaza los pendientes', async () => {
  const onAnswer = jest.fn();
  const renderer = render({ testimonial: { ...TESTIMONIAL, status: 'pending' }, isOwner: true, onAnswer });
  expect(textsOf(renderer)).toContain('Pendiente: solo tú lo ves hasta que lo apruebes');

  await pressText(renderer, 'Mostrar en mi perfil');
  expect(onAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'tag-1' }), 'approved');
  await pressText(renderer, 'No mostrar');
  expect(onAnswer).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'tag-1' }), 'rejected');
});

it('el dueño puede quitar un testimonio ya aprobado', async () => {
  const onAnswer = jest.fn();
  const renderer = render({ isOwner: true, onAnswer });
  await pressText(renderer, 'Quitar de mi perfil');
  expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ id: 'tag-1' }), 'rejected');
});
