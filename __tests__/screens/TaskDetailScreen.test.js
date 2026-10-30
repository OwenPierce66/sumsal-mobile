/**
 * __tests__/screens/TaskDetailScreen.test.js
 *
 * Comentar adjuntando una aportación favorita, con la API simulada.
 */
import React from 'react';
import { Alert, Linking, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import api from '@api';
import TaskDetailScreen from '../../screens/TaskDetailScreen';
import TaskSearchPicker from '../../components/TaskSearchPicker';

// El corazón de seguir junto a cada nombre (useMyRelations) necesita React Query; aquí no aplica.
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('@react-native-community/slider', () => 'Slider');

jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getImageUrl: (path) => path || null,
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect) => require('react').useEffect(effect, [effect]),
}));

const TASK = {
  id: 't1',
  title: 'Aportación principal',
  description: 'Más información en www.fuente.org/estudio.',
  user: { id: 'owner', username: 'owner' },
  username: 'owner',
  categories: '',
  subtasks: [{ id: 1, title: 'Consejo con enlace', description: 'Lee esto', link: 'ejemplo.com/guia' }],
  subfactores: [],
  subfuentes: [],
  likes_count: 0,
  comments_count: 2,
  share_count: 0,
  created_at: '2026-10-20T00:00:00Z',
};

const COMMENTS = [
  {
    id: 10, text: 'Mira esta', parent: null, created_by: { id: 'me', username: 'yo' },
    created_at: '2026-10-25T00:00:00Z', children: [], likes_count: 0,
    aportacion_info: { id: 'fav-1', title: 'Guía de becas', image: null, pch: 'peticiones', username: 'luis' },
  },
  {
    id: 11, text: 'Otro comentario', parent: null, created_by: { id: 'ana', username: 'ana' },
    created_at: '2026-10-25T01:00:00Z', children: [], likes_count: 0, aportacion_info: null,
  },
];

const mockRefetch = jest.fn();
const mockTaskQuery = { data: TASK, isLoading: false, refetch: mockRefetch };
const mockCommentsQuery = {
  data: COMMENTS, refetch: mockRefetch, fetchNextPage: jest.fn(),
  hasNextPage: false, isFetchingNextPage: false, remaining: 0,
};
const mockMe = { data: { id: 'me', username: 'yo' } };
const mockAdmin = { data: { isAdmin: false, isStaff: false } };
const mockFavorites = {
  data: { tasks: [{ id: 'f2', is_pinned: false, task: { id: 'fav-2', title: 'Mi favorita', pch: 'consejos' } }] },
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};

jest.mock('@hooks/useApi', () => ({
  useStories: () => ({ data: [] }),
  useTaskDetail: () => mockTaskQuery,
  useTaskComments: () => mockCommentsQuery,
  useMe: () => mockMe,
  useIsAdmin: () => mockAdmin,
  useFavoritesCollection: () => mockFavorites,
}));

const textsOf = (renderer) => renderer.root
  .findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string').join(''));

const findByLabel = (renderer, label) =>
  renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];

const press = async (renderer, label) => {
  const target = findByLabel(renderer, label);
  if (!target) throw new Error(`No hay botón "${label}"`);
  await act(async () => { await target.props.onPress(); });
};

const typeComment = async (renderer, text) => {
  const input = renderer.root.findAll((node) => node.type === TextInput && node.props.multiline)[0];
  await act(async () => { input.props.onChangeText(text); });
};

let navigation;
let mounted;

async function renderDetail() {
  navigation = { push: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
  await act(async () => {
    mounted = TestRenderer.create(<TaskDetailScreen route={{ params: { taskId: 't1' } }} navigation={navigation} />);
  });
  return mounted;
}

beforeEach(() => {
  // Las animaciones de TouchableOpacity y Modal no deben seguir vivas tras cada test.
  jest.useFakeTimers();
  api.post.mockReset().mockResolvedValue({ data: {} });
  api.patch.mockReset().mockResolvedValue({ data: {} });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  jest.useRealTimers();
  Alert.alert.mockRestore();
});

it('muestra la aportación adjunta en el comentario y la abre', async () => {
  const renderer = await renderDetail();
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Guía de becas', '@luis · Petición']));

  await press(renderer, 'Aportación adjunta: Guía de becas. Abrir aportación');
  expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 'fav-1' });
});

it('los enlaces van dentro del texto de las descripciones y se abren al tocarlos', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const renderer = await renderDetail();
  const links = renderer.root.findAll((node) => node.type === Text && node.props.accessibilityRole === 'link');

  // El de la descripción principal, escrito en el texto.
  expect(links.map((node) => node.props.children)).toContain('www.fuente.org/estudio');
  // El que la web guardaba aparte en el consejo, ahora al final de su descripción.
  const legacy = links.find((node) => node.props.children === 'https://ejemplo.com/guia');
  expect(legacy).toBeDefined();
  expect(textsOf(renderer)).toContain('Lee esto\n');

  await act(async () => { legacy.props.onPress(); });
  expect(openURL).toHaveBeenCalledWith('https://ejemplo.com/guia');
  openURL.mockRestore();
});

it('adjunta una favorita y la envía con el comentario', async () => {
  const renderer = await renderDetail();
  await press(renderer, 'Adjuntar al comentario');
  await press(renderer, 'Comentar con una publicación guardada');
  await press(renderer, 'Adjuntar Mi favorita');
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Vas a adjuntar', 'Mi favorita']));

  await typeComment(renderer, 'Te recomiendo esta');
  await press(renderer, 'Publicar comentario');

  expect(api.post).toHaveBeenCalledWith('tasks/t1/comments/', { text: 'Te recomiendo esta', aportacion: 'fav-2' });
  expect(textsOf(renderer)).not.toContain('Vas a adjuntar');
});

it('las respuestas también pueden llevar una aportación favorita', async () => {
  const renderer = await renderDetail();
  await press(renderer, 'Responder');
  await press(renderer, 'Adjuntar al comentario');
  await press(renderer, 'Comentar con una publicación guardada');
  await press(renderer, 'Adjuntar Mi favorita');
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Vas a adjuntar', 'Mi favorita']));

  await typeComment(renderer, 'Gracias, mira esta');
  await press(renderer, 'Publicar comentario');
  expect(api.post).toHaveBeenCalledWith(
    'tasks/t1/comments/', { text: 'Gracias, mira esta', parent: 10, aportacion: 'fav-2' },
  );
});

it('sin aportación, la respuesta se envía como siempre', async () => {
  const renderer = await renderDetail();
  await press(renderer, 'Responder');
  await typeComment(renderer, 'Gracias');
  await press(renderer, 'Publicar comentario');
  expect(api.post).toHaveBeenCalledWith('tasks/t1/comments/', { text: 'Gracias', parent: 10 });
});

it('muestra el motivo cuando el backend rechaza la aportación', async () => {
  api.post.mockRejectedValueOnce({
    response: { status: 400, data: { aportacion: ['Solo puedes adjuntar una de tus aportaciones favoritas.'] } },
  });
  const renderer = await renderDetail();
  await press(renderer, 'Adjuntar al comentario');
  await press(renderer, 'Comentar con una publicación guardada');
  await press(renderer, 'Adjuntar Mi favorita');
  await typeComment(renderer, 'Hola');
  await press(renderer, 'Publicar comentario');

  expect(Alert.alert).toHaveBeenCalledWith('Error', 'Solo puedes adjuntar una de tus aportaciones favoritas.');
});

it('cada comentario tiene su menú de 3 puntos (el tuyo: editar y eliminar, sin reportarte)', async () => {
  const renderer = await renderDetail();
  await press(renderer, 'Más opciones del comentario');
  const texts = textsOf(renderer);
  expect(texts).toEqual(expect.arrayContaining(['Editar comentario', 'Eliminar comentario']));
  expect(texts).not.toContain('Reportar');
});

it('al editar se puede quitar la aportación y solo se envía si cambió', async () => {
  const renderer = await renderDetail();

  await press(renderer, 'Editar comentario');
  expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Editando comentario', 'Aportación adjunta']));
  await press(renderer, 'Publicar comentario');
  expect(api.patch).toHaveBeenLastCalledWith('comments/10/', { text: 'Mira esta' });

  await press(renderer, 'Editar comentario');
  await press(renderer, 'Quitar aportación adjunta');
  await press(renderer, 'Publicar comentario');
  expect(api.patch).toHaveBeenLastCalledWith('comments/10/', { text: 'Mira esta', aportacion: null });
});

it('los comentarios muestran las insignias de quien comenta, como la suscripción', async () => {
  const { Ionicons } = require('@expo/vector-icons');
  const { invalidateUserBadges } = require('../../hooks/useUserBadges');
  invalidateUserBadges();
  api.get.mockImplementation((path) => Promise.resolve({
    data: path === 'users/badges/' ? { ana: ['sub_red'], me: ['sub_green'] } : {},
  }));
  const renderer = await renderDetail();
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
  }

  const labels = renderer.root.findAll((node) => node.props.accessible && node.props.accessibilityLabel)
    .map((node) => node.props.accessibilityLabel);
  expect(labels).toEqual(expect.arrayContaining(['Suscripción +', 'Suscripción']));
  const icons = renderer.root.findAllByType(Ionicons).map((node) => node.props.name);
  expect(icons).toEqual(expect.arrayContaining(['star', 'star-half']));
  api.get.mockReset();
});

describe('etiquetar personas en comentarios (testimonios)', () => {
  const flushTimers = async () => {
    for (let i = 0; i < 3; i += 1) {
      await act(async () => { jest.runOnlyPendingTimers(); await Promise.resolve(); });
    }
  };

  const tagSomeone = async (renderer, query, username) => {
    await press(renderer, 'Adjuntar al comentario');
    await press(renderer, 'Etiquetar personas');
    const search = renderer.root.findAll((node) => node.type === TextInput && node.props.accessibilityLabel === 'Buscar personas para etiquetar')[0];
    await act(async () => { search.props.onChangeText(query); });
    await flushTimers();
    await press(renderer, `Etiquetar @${username}`);
  };

  beforeEach(() => {
    api.get.mockReset().mockImplementation((path) => Promise.resolve({
      data: path === 'search/directory/' ? { profiles: [{ id: 'luis', username: 'luis' }, { id: 'eva', username: 'eva' }] } : {},
    }));
  });

  it('etiqueta a alguien y lo envía con el comentario', async () => {
    const renderer = await renderDetail();
    await tagSomeone(renderer, 'lu', 'luis');
    expect(api.get).toHaveBeenCalledWith('search/directory/', { params: { q: 'lu', scope: 'profiles' } });
    expect(textsOf(renderer)).toContain('@luis');

    await typeComment(renderer, 'Luis me ayudó');
    await press(renderer, 'Publicar comentario');
    expect(api.post).toHaveBeenCalledWith('tasks/t1/comments/', { text: 'Luis me ayudó', tagged_user_ids: ['luis'] });
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === 'Quitar etiqueta @luis')).toHaveLength(0);
  });

  it('las etiquetas se pueden quitar antes de enviar', async () => {
    const renderer = await renderDetail();
    await tagSomeone(renderer, 'e', 'eva');
    await press(renderer, 'Quitar etiqueta @eva');
    await typeComment(renderer, 'Sin etiquetas');
    await press(renderer, 'Publicar comentario');
    expect(api.post).toHaveBeenCalledWith('tasks/t1/comments/', { text: 'Sin etiquetas' });
  });

  it('al editar solo manda las etiquetas si cambiaron', async () => {
    COMMENTS[0].tagged_users = [{ id: 'eva', username: 'eva', status: 'approved' }];
    const renderer = await renderDetail();
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Con', '@eva']));

    await press(renderer, 'Editar comentario');
    await press(renderer, 'Publicar comentario');
    expect(api.patch).toHaveBeenLastCalledWith('comments/10/', { text: 'Mira esta' });

    await press(renderer, 'Editar comentario');
    await press(renderer, 'Quitar etiqueta @eva');
    await press(renderer, 'Publicar comentario');
    expect(api.patch).toHaveBeenLastCalledWith('comments/10/', { text: 'Mira esta', tagged_user_ids: [] });
    delete COMMENTS[0].tagged_users;
  });
});

it('una aportación oculta muestra el aviso y se publica desde ahí', async () => {
  mockTaskQuery.data = { ...TASK, is_hidden: true };
  api.patch.mockResolvedValueOnce({ data: { ...TASK, is_hidden: false } });
  const renderer = await renderDetail();
  expect(textsOf(renderer)).toContain('Oculta: solo tú la ves en tu perfil. Así se vería publicada.');

  await press(renderer, 'Publicar aportación');
  expect(api.patch).toHaveBeenCalledWith('tasks/t1/', { is_hidden: false });
  expect(Alert.alert).toHaveBeenCalledWith('¡Publicada!', 'Ahora todos pueden ver tu aportación.');
  expect(mockRefetch).toHaveBeenCalled();
  mockTaskQuery.data = TASK;
});

describe('anterior y siguiente recomendado', () => {
  afterEach(() => {
    mockTaskQuery.data = TASK;
    mockMe.data = { id: 'me', username: 'yo' };
  });

  it('el autor elige el siguiente recomendado desde el detalle', async () => {
    mockMe.data = { id: 'owner', username: 'owner' };
    const renderer = await renderDetail();
    expect(findByLabel(renderer, 'Elegir siguiente recomendado')).toBeTruthy();
    await act(async () => {
      await renderer.root.findByType(TaskSearchPicker).props.onSelect({ id: 't2', title: 'Parte 2' });
    });
    expect(api.patch).toHaveBeenCalledWith('tasks/t1/', { next_task: 't2' });
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('el autor elige también el anterior recomendado', async () => {
    mockMe.data = { id: 'owner', username: 'owner' };
    const renderer = await renderDetail();
    await press(renderer, 'Elegir anterior recomendado');
    await act(async () => {
      await renderer.root.findByType(TaskSearchPicker).props.onSelect({ id: 't0', title: 'Parte 0' });
    });
    expect(api.patch).toHaveBeenCalledWith('tasks/t1/', { previous_task: 't0' });
  });

  it('todos ven anterior y siguiente y los abren; solo el autor ve Cambiar y Quitar', async () => {
    mockTaskQuery.data = {
      ...TASK,
      previous_task_info: { id: 't0', title: 'Parte 0', chosen: true },
      next_task_info: { id: 't2', title: 'Parte 2', chosen: true },
    };
    let renderer = await renderDetail();
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Anterior', 'Parte 0', 'Siguiente recomendado', 'Parte 2']));
    expect(findByLabel(renderer, 'Quitar siguiente recomendado')).toBeUndefined();
    await press(renderer, 'Siguiente recomendado: Parte 2');
    expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't2' });
    await press(renderer, 'Anterior: Parte 0');
    expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't0' });
    act(() => mounted.unmount());

    mockMe.data = { id: 'owner', username: 'owner' };
    renderer = await renderDetail();
    await press(renderer, 'Quitar siguiente recomendado');
    expect(api.patch).toHaveBeenCalledWith('tasks/t1/', { next_task: null });
    await press(renderer, 'Quitar anterior recomendado');
    expect(api.patch).toHaveBeenCalledWith('tasks/t1/', { previous_task: null });
  });

  it('muestra la serie completa en orden y abre cualquier parte', async () => {
    mockTaskQuery.data = {
      ...TASK,
      previous_task_info: { id: 't0', title: 'Parte 0', chosen: false },
      next_task_info: { id: 't2', title: 'Parte 2', chosen: true },
      series: [
        { id: 't0', title: 'Parte 0', current: false },
        { id: 't1', title: TASK.title, current: true },
        { id: 't2', title: 'Parte 2', current: false },
      ],
    };
    const renderer = await renderDetail();
    expect(textsOf(renderer)).toContain('Serie · Parte 2 de 3');
    await press(renderer, 'Parte 3: Parte 2');
    expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't2' });
    await press(renderer, 'Parte 1: Parte 0');
    expect(navigation.push).toHaveBeenCalledWith('TaskDetail', { taskId: 't0' });
  });

  it('sin serie no muestra el panel', async () => {
    mockTaskQuery.data = { ...TASK, next_task_info: { id: 't2', title: 'Parte 2', chosen: true }, series: null };
    const renderer = await renderDetail();
    expect(textsOf(renderer).some((text) => text.startsWith('Serie ·'))).toBe(false);
  });

  it('el autor solo puede quitar lo que eligió él', async () => {
    mockMe.data = { id: 'owner', username: 'owner' };
    mockTaskQuery.data = {
      ...TASK,
      previous_task_info: { id: 't0', title: 'Parte 0', chosen: false },
      next_task_info: { id: 't2', title: 'Parte 2', chosen: false },
    };
    const renderer = await renderDetail();
    expect(findByLabel(renderer, 'Quitar siguiente recomendado')).toBeUndefined();
    expect(findByLabel(renderer, 'Quitar anterior recomendado')).toBeUndefined();
  });
});
