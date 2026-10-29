/**
 * __tests__/components/ExpandableText.test.js
 *
 * "Ver más" solo aparece si el texto pasa de 3 renglones, y alterna con "Ver menos".
 */
import React from 'react';
import { Text, View } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import ExpandableText from '../../components/ExpandableText';

const layout = (height) => ({ nativeEvent: { layout: { height } } });
const render = () => {
  let renderer;
  act(() => {
    renderer = TestRenderer.create(
      <ExpandableText lines={3} renderText={(lines) => <Text numberOfLines={lines}>Texto largo</Text>} />,
    );
  });
  // [0] contenedor, [1] texto visible, [2] copia invisible para medir.
  const views = renderer.root.findAllByType(View).filter((v) => v.props.onLayout);
  return { renderer, visible: views[0], measure: views[1] };
};
const toggleOf = (renderer) => renderer.root.findAllByType(Text).find((t) => t.props.accessibilityRole === 'button');

describe('ExpandableText', () => {
  it('texto corto: no hay "Ver más"', () => {
    const { renderer, visible, measure } = render();
    act(() => { visible.props.onLayout(layout(40)); measure.props.onLayout(layout(40)); });
    expect(toggleOf(renderer)).toBeUndefined();
  });

  it('texto de más de 3 renglones: corta, "Ver más" lo abre y "Ver menos" lo cierra', () => {
    const { renderer, visible, measure } = render();
    act(() => { visible.props.onLayout(layout(60)); measure.props.onLayout(layout(140)); });
    expect(toggleOf(renderer).props.children).toBe('Ver más');
    expect(renderer.root.findAllByType(Text)[0].props.numberOfLines).toBe(3);

    act(() => toggleOf(renderer).props.onPress());
    expect(toggleOf(renderer).props.children).toBe('Ver menos');
    expect(renderer.root.findAllByType(Text)[0].props.numberOfLines).toBeUndefined();

    act(() => toggleOf(renderer).props.onPress());
    expect(toggleOf(renderer).props.children).toBe('Ver más');
  });
});
