/**
 * __tests__/components/StoryRing.test.js
 *
 * Aro de historia en el avatar: azul si hay algo sin ver, gris si ya se vio todo
 * y sin aro si el perfil no ha subido historias.
 */
import React from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import StoryRing from '../../components/StoryRing';
import { markStorySeen } from '../../hooks/useStoryRing';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@api', () => ({ __esModule: true, default: {}, getImageUrl: (path) => path || null }));

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const mockStories = { data: [] };
jest.mock('@hooks/useApi', () => ({ useStories: () => mockStories }));

let mounted;
afterEach(() => { act(() => mounted?.unmount()); mounted = null; });

const render = async (userId, navigation = { navigate: jest.fn() }) => {
  await act(async () => {
    mounted = TestRenderer.create(
      <StoryRing userId={userId} size={45} navigation={navigation}><Text>avatar</Text></StoryRing>,
    );
  });
  return mounted;
};
const ringOf = (renderer) => {
  const ids = renderer.root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('story-ring')
    && typeof n.type === 'string');
  return ids.length ? ids[0].props.testID : null;
};

describe('StoryRing', () => {
  beforeEach(() => {
    mockStories.data = [
      { id: 's1', user: { id: 'ana' }, image: 'a.jpg', created_at: minutesAgo(90), viewed_by_me: true },
      { id: 's2', user: { id: 'ana' }, image: 'b.jpg', created_at: minutesAgo(30), viewed_by_me: false },
      { id: 's3', user: { id: 'luis' }, image: 'c.jpg', created_at: minutesAgo(10), viewed_by_me: true },
      // Vieja (más de 24 h): no cuenta.
      { id: 's4', user: { id: 'caro' }, image: 'd.jpg', created_at: minutesAgo(60 * 25) },
    ];
  });

  it('azul con historias sin ver y abre la primera que falta', async () => {
    const navigation = { navigate: jest.fn() };
    const renderer = await render('ana', navigation);
    expect(ringOf(renderer)).toBe('story-ring');
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Ver historia nueva' }).props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('Stories', { openStoryId: 's2' });
  });

  it('gris si ya se vieron todas (en el servidor o en este dispositivo)', async () => {
    expect(ringOf(await render('luis'))).toBe('story-ring-seen');
    act(() => mounted.unmount());

    const renderer = await render('ana');
    await act(async () => { markStorySeen('s2'); });
    expect(ringOf(renderer)).toBe('story-ring-seen');
  });

  it('sin aro si no tiene historias activas', async () => {
    expect(ringOf(await render('caro'))).toBeNull();
    act(() => mounted.unmount());
    expect(ringOf(await render('nadie'))).toBeNull();
  });
});
