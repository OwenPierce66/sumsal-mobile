/**
 * __tests__/components/feedMedia.test.js
 *
 * Fotos y videos con su propia forma: en el feed (sin el recorte fijo de antes) y en
 * reels (llenan la pantalla o se ven completos).
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { Image } from 'expo-image';
import { Video } from 'expo-av';
import { FeedImage, TaskVideoPreview } from '../../components/TaskPostCard';
import ReelClipMedia from '../../components/ReelClipMedia';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => false }));
jest.mock('@api', () => ({ __esModule: true, default: {}, getImageUrl: (path) => path || null }));
jest.mock('../../hooks/useMyRelations', () => ({ useMyRelations: () => ({}) }));

const sizeOf = (node) => {
  const { width, height } = StyleSheet.flatten(node.props.style);
  return { width, height };
};

let renderer;
afterEach(() => act(() => renderer?.unmount()));

it('la foto del feed toma su forma al cargar (vertical: 4:5)', async () => {
  await act(async () => { renderer = TestRenderer.create(<FeedImage uri="http://x/vertical.jpg" width={340} />); });
  const image = () => renderer.root.findByType(Image);
  expect(sizeOf(image())).toEqual({ width: 340, height: 340 });
  await act(async () => { image().props.onLoad({ source: { width: 1080, height: 1920 } }); });
  expect(sizeOf(image())).toEqual({ width: 340, height: 425 });
});

it('el video del feed toma su forma y va sobre negro', async () => {
  await act(async () => { renderer = TestRenderer.create(<TaskVideoPreview uri="http://x/horizontal.mp4" width={340} />); });
  const video = renderer.root.findByType(Video);
  await act(async () => { video.props.onReadyForDisplay({ naturalSize: { width: 1920, height: 1080, orientation: 'landscape' } }); });
  const wrapper = renderer.root.findAll((node) => node.props.collapsable === false)[0];
  const style = StyleSheet.flatten(wrapper.props.style);
  expect({ width: style.width, height: style.height }).toEqual({ width: 340, height: 191 });
  expect(style.backgroundColor).toBe('#000');
});

it('en reels una foto horizontal se ve completa con fondo desenfocado', async () => {
  await act(async () => {
    renderer = TestRenderer.create(<ReelClipMedia type="image" uri="http://x/paisaje.jpg" boxRatio={390 / 844} />);
  });
  let images = renderer.root.findAllByType(Image);
  expect(images).toHaveLength(1);
  expect(images[0].props.contentFit).toBe('cover');
  await act(async () => { images[0].props.onLoad({ source: { width: 1600, height: 900 } }); });
  images = renderer.root.findAllByType(Image);
  expect(images).toHaveLength(2);
  expect(images[0].props.blurRadius).toBe(40);
  expect(images[1].props.contentFit).toBe('contain');
});

it('en reels un video vertical llena la pantalla y uno horizontal se ve completo', async () => {
  const videoRef = React.createRef();
  await act(async () => {
    renderer = TestRenderer.create(
      <ReelClipMedia type="video" uri="http://x/vertical.mp4" boxRatio={390 / 844} videoRef={videoRef} videoProps={{ isLooping: true }} />,
    );
  });
  let video = renderer.root.findByType(Video);
  await act(async () => { video.props.onReadyForDisplay({ naturalSize: { width: 1080, height: 1920, orientation: 'portrait' } }); });
  video = renderer.root.findByType(Video);
  expect(video.props.resizeMode).toBe('cover');
  expect(video.props.isLooping).toBe(true);

  await act(async () => {
    renderer.update(<ReelClipMedia type="video" uri="http://x/horizontal-2.mp4" boxRatio={390 / 844} videoRef={videoRef} />);
  });
  video = renderer.root.findByType(Video);
  await act(async () => { video.props.onReadyForDisplay({ target: { videoWidth: 1280, videoHeight: 720 } }); });
  expect(renderer.root.findByType(Video).props.resizeMode).toBe('contain');
});
