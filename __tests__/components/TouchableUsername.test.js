/**
 * __tests__/components/TouchableUsername.test.js
 *
 * El nombre ya no lleva el corazón de seguir pegado: el corazón va aparte, al otro
 * extremo de la fila (junto al menú de 3 puntos, como en Aportaciones).
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import TouchableUsername from '../../components/TouchableUsername';

jest.mock('../../api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../../components/UserBadges', () => () => null);
jest.mock('../../components/FollowHeart', () => {
  const { Text: MockText } = require('react-native');
  return () => <MockText>corazón</MockText>;
});

it('muestra solo el nombre, sin el corazón de seguir', () => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(<TouchableUsername username="ana" userId="ana-id" navigation={{ navigate: jest.fn() }} />);
  });
  const texts = renderer.root.findAllByType(require('react-native').Text)
    .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));
  expect(texts).toContain('ana');
  expect(texts).not.toContain('corazón');
  act(() => renderer.unmount());
});
