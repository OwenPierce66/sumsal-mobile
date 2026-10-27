/**
 * __tests__/components/LinkifiedText.test.js
 *
 * Enlaces dentro del texto de las descripciones.
 */
import React from 'react';
import { Text, Linking } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import LinkifiedText from '../../components/LinkifiedText';

const linksOf = (renderer) => renderer.root.findAll(
  (node) => node.type === Text && node.props.accessibilityRole === 'link',
);

describe('LinkifiedText', () => {
  it('deja tocables los enlaces dentro del texto y abre la URL normalizada', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    let renderer;
    act(() => {
      renderer = TestRenderer.create(
        <LinkifiedText text="Guía en www.ejemplo.com/guia y https://otro.org." />,
      );
    });

    const links = linksOf(renderer);
    expect(links.map((node) => node.props.children)).toEqual(['www.ejemplo.com/guia', 'https://otro.org']);
    act(() => { links[0].props.onPress(); });
    expect(openURL).toHaveBeenCalledWith('https://www.ejemplo.com/guia');
    openURL.mockRestore();
  });

  it('sin enlaces se ve como un texto normal', () => {
    let renderer;
    act(() => { renderer = TestRenderer.create(<LinkifiedText text="Solo texto" style={{ fontSize: 14 }} />); });

    expect(linksOf(renderer)).toHaveLength(0);
    const outer = renderer.root.findAllByType(Text)[0];
    expect(outer.props.style).toEqual({ fontSize: 14 });
    expect(outer.props.children).toEqual(['Solo texto']);
  });

  it('no convierte en enlace esquemas peligrosos', () => {
    let renderer;
    act(() => { renderer = TestRenderer.create(<LinkifiedText text="javascript:alert(1) y archivo.pdf" />); });
    expect(linksOf(renderer)).toHaveLength(0);
  });
});
