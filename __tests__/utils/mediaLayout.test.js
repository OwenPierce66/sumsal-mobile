/**
 * __tests__/utils/mediaLayout.test.js
 *
 * Medidas de fotos y videos: su forma en el feed, cuándo llenan la pantalla en reels y
 * de dónde sale su tamaño (celular o web).
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  feedMediaBox, feedRatio, fillsBox, imageSizeFromLoad, useMediaRatio, videoSizeFromReady,
} from '../../utils/mediaLayout';

it('en el feed cada medio usa su forma, entre 4:5 y 1.91:1', () => {
  expect(feedRatio(16 / 9)).toBeCloseTo(16 / 9);
  expect(feedRatio(9 / 16)).toBe(4 / 5);
  expect(feedRatio(4)).toBe(1.91);
  expect(feedRatio(null)).toBe(1);
});

it('en el feed ocupa el ancho sin pasar de la altura máxima', () => {
  expect(feedMediaBox(9 / 16, 340)).toEqual({ width: 340, height: 425 });
  expect(feedMediaBox(16 / 9, 340)).toEqual({ width: 340, height: 191 });
  // En la web, con todo el ancho de la ventana: una cuadrada no sale gigante.
  expect(feedMediaBox(1, 1200)).toEqual({ width: 520, height: 520 });
});

it('en reels llena la pantalla solo si su forma se parece', () => {
  const phone = 390 / 844;
  expect(fillsBox(9 / 16, phone)).toBe(true);
  expect(fillsBox(16 / 9, phone)).toBe(false);
  expect(fillsBox(1, phone)).toBe(false);
  // En una ventana ancha (web) un video vertical se ve completo y uno horizontal la llena.
  expect(fillsBox(9 / 16, 1600 / 900)).toBe(false);
  expect(fillsBox(16 / 9, 1600 / 900)).toBe(true);
  // Mientras no se sabe su forma, la llena (como antes).
  expect(fillsBox(null, phone)).toBe(true);
});

it('lee el tamaño de fotos y videos en el celular y en la web', () => {
  expect(imageSizeFromLoad({ source: { width: 1080, height: 1350 } })).toEqual({ width: 1080, height: 1350 });
  expect(videoSizeFromReady({ naturalSize: { width: 1920, height: 1080, orientation: 'landscape' } }))
    .toEqual({ width: 1920, height: 1080 });
  expect(videoSizeFromReady({ naturalSize: { width: 1920, height: 1080, orientation: 'portrait' } }))
    .toEqual({ width: 1080, height: 1920 });
  expect(videoSizeFromReady({ target: { videoWidth: 720, videoHeight: 1280 } })).toEqual({ width: 720, height: 1280 });
  expect(videoSizeFromReady({})).toBeNull();
});

it('recuerda la forma por dirección para que no salte al volver a verla', async () => {
  let latest;
  const Probe = ({ uri }) => {
    latest = useMediaRatio(uri);
    return null;
  };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(<Probe uri="http://x/a.jpg" />); });
  expect(latest[0]).toBeNull();
  await act(async () => { latest[1]({ width: 800, height: 1000 }); });
  expect(latest[0]).toBeCloseTo(0.8);
  await act(async () => { renderer.update(<Probe uri="http://x/b.jpg" />); });
  expect(latest[0]).toBeNull();
  act(() => renderer.unmount());

  await act(async () => { renderer = TestRenderer.create(<Probe uri="http://x/a.jpg" />); });
  expect(latest[0]).toBeCloseTo(0.8);
  act(() => renderer.unmount());
});
