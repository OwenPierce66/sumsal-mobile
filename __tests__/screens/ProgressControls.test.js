/**
 * __tests__/screens/ProgressControls.test.js
 *
 * Barra de progreso de los reels: delgada mientras se reproduce, con tiempo en pausa
 * y al arrastrar adelanta o regresa el video al punto que se suelta.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import ProgressControls from '../../screens/ProgressControls';

const status = { positionMillis: 15000, durationMillis: 60000 };
const strip = (renderer) => renderer.root.findByProps({ accessibilityLabel: 'Progreso del video' });
const touch = (x) => ({ nativeEvent: { locationX: x } });

describe('ProgressControls', () => {
  it('reproduciendo solo se ve la línea; en pausa también el tiempo', () => {
    let renderer;
    act(() => { renderer = TestRenderer.create(<ProgressControls status={status} paused={false} />); });
    expect(renderer.root.findAllByType(Text)).toHaveLength(0);

    act(() => renderer.update(<ProgressControls status={status} paused />));
    expect(renderer.root.findByType(Text).props.children.join('')).toBe('0:15 / 1:00');
  });

  it('arrastrar muestra el tiempo del punto y al soltar adelanta ahí', () => {
    const onSeek = jest.fn();
    let renderer;
    act(() => { renderer = TestRenderer.create(<ProgressControls status={status} paused={false} onSeek={onSeek} />); });
    act(() => strip(renderer).props.onLayout({ nativeEvent: { layout: { width: 400 } } }));

    act(() => strip(renderer).props.onResponderGrant(touch(100)));
    act(() => strip(renderer).props.onResponderMove(touch(300)));
    expect(renderer.root.findByType(Text).props.children.join('')).toBe('0:45 / 1:00');

    act(() => strip(renderer).props.onResponderRelease(touch(300)));
    expect(onSeek).toHaveBeenCalledWith(45000);
    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
  });
});
