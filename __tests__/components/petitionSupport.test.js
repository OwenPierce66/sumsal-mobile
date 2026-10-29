/**
 * __tests__/components/petitionSupport.test.js
 *
 * Apoyo monetario a peticiones: total en el pie de la tarjeta, opción en el
 * menú de 3 puntos y pago único en Stripe Checkout.
 */
import React from 'react';
import { Alert, AppState, Linking, Text, TextInput } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@api';
import PetitionSupportStat from '../../components/PetitionSupportStat';
import TaskActionsModal from '../../components/TaskActionsModal';
import { formatSupportTotal, isPetition } from '../../utils/petitionSupport';

let mockMe = { id: 'owner' };
const mockNoCategories = { data: [], isLoading: false };
jest.mock('@hooks/useApi', () => ({ useMe: () => ({ data: mockMe }), useCategories: () => mockNoCategories }));
jest.mock('@hooks/useDownloadTask', () => ({ useDownloadTask: () => ({ downloadTask: jest.fn(), isDownloading: false }) }));
jest.mock('../../hooks/useMyRelations', () => ({
  useMyRelations: () => ({ ready: false, getState: () => null, setStateLocally: () => {}, refresh: () => {} }),
}));
jest.mock('../../utils/adminActions', () => ({ setAccountActive: jest.fn() }));
jest.mock('@api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
  getImageUrl: (path) => path || null,
}));

const PETITION = {
  id: 'p1',
  title: 'Más parques',
  pch: 'peticiones',
  user: { id: 'owner', username: 'owner' },
  support_total: { amount_mxn: '92.00', supporters_count: 2 },
};

const textsOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).filter((part) => typeof part === 'string' || typeof part === 'number').join(''));
const byLabel = (renderer, label) => renderer.root.findAll((node) => node.props.accessibilityLabel === label && node.props.onPress)[0];
const pressText = async (renderer, label) => {
  const target = renderer.root.findAll((node) => (
    node.props.onPress && node.findAll((child) => child.type === Text && child.props.children === label).length > 0
  )).pop();
  await act(async () => { await target.props.onPress(); });
};

let mounted;
let queryClient;
afterEach(() => {
  act(() => mounted?.unmount());
  mounted = null;
  queryClient?.clear();
  jest.clearAllMocks();
  mockMe = { id: 'owner' };
});

const render = (element) => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => { mounted = TestRenderer.create(<QueryClientProvider client={queryClient}>{element}</QueryClientProvider>); });
  return mounted;
};

describe('utils', () => {
  it('solo las peticiones se apoyan', () => {
    expect(isPetition({ pch: 'Peticiones' })).toBe(true);
    expect(isPetition({ pch: 'peticion' })).toBe(true);
    expect(isPetition({ pch: 'consejos' })).toBe(false);
  });

  it('el total corto cabe en el pie', () => {
    expect(formatSupportTotal('0.00')).toBe('$0');
    expect(formatSupportTotal('92.00')).toBe('$92');
    expect(formatSupportTotal('92.5')).toBe('$92.50');
    expect(formatSupportTotal('1250')).toBe('$1.3k');
    expect(formatSupportTotal('3000000')).toBe('$3M');
  });
});

describe('PetitionSupportStat', () => {
  it('no aparece en tareas que no son peticiones', () => {
    const renderer = render(<PetitionSupportStat task={{ id: 't1', pch: 'consejos' }} />);
    expect(renderer.root.findAllByType(Text)).toHaveLength(0);
  });

  it('muestra lo recaudado y abre la lista de quienes apoyaron', async () => {
    api.get.mockResolvedValue({ data: {
      supporters: [{ id: 'fan', username: 'fan', amount_mxn: '72.00' }],
      support_total: { amount_mxn: '92.00', supporters_count: 2 },
    } });
    const renderer = render(<PetitionSupportStat task={PETITION} />);
    expect(textsOf(renderer)).toContain('$92');

    await act(async () => { byLabel(renderer, 'Ver quién apoyó esta petición').props.onPress(); });
    expect(api.get).toHaveBeenCalledWith('tasks/p1/supporters/');
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['$72.00 MXN', 'Apoyo recaudado']));
  });

  it('el creador también apoya: paga en Stripe y al volver se ve el total nuevo', async () => {
    const appStateHandlers = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
      appStateHandlers.push(handler);
      return { remove: jest.fn() };
    });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    api.post.mockImplementation((url) => Promise.resolve(url === 'tasks/p1/support/'
      ? { data: { support: { id: 's1', status: 'pending' }, checkout_url: 'https://checkout.stripe.com/c/cs_1' } }
      : { data: { support: { id: 's1', status: 'paid' }, support_total: { amount_mxn: '142.00', supporters_count: 2 } } }));

    const renderer = render(<PetitionSupportStat task={PETITION} />);
    await act(async () => { byLabel(renderer, 'Apoyar monetariamente esta petición').props.onPress(); });
    expect(textsOf(renderer).join(' ')).toContain('Es tu petición');

    await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('50'); });
    await pressText(renderer, 'Apoyar con $50.00 MXN');
    expect(api.post).toHaveBeenCalledWith('tasks/p1/support/', { amount: '50', currency: 'mxn' });
    expect(Linking.openURL).toHaveBeenCalledWith('https://checkout.stripe.com/c/cs_1');

    await act(async () => { await appStateHandlers.at(-1)('active'); });
    expect(api.post).toHaveBeenCalledWith('petition-supports/s1/sync/');
    expect(textsOf(renderer)).toContain('$142');
  });

  it('avisa del mínimo antes de abrir Stripe', async () => {
    const renderer = render(<PetitionSupportStat task={{ ...PETITION, id: 'p2' }} />);
    await act(async () => { byLabel(renderer, 'Apoyar monetariamente esta petición').props.onPress(); });
    await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('5'); });
    expect(textsOf(renderer)).toContain('El mínimo es $10.00 MXN.');
    expect(byLabel(renderer, 'Ir a pagar el apoyo').props.disabled).toBe(true);
  });
});

describe('menú de 3 puntos', () => {
  const renderMenu = (task, currentUserId) => render(
    <TaskActionsModal visible onClose={jest.fn()} actionTask={task} currentUserId={currentUserId} handlers={{}} />,
  );

  it('en una petición ajena ofrece apoyarla y abre la hoja de pago', async () => {
    mockMe = { id: 'fan' };
    const renderer = renderMenu(PETITION, 'fan');
    await pressText(renderer, 'Apoyar monetariamente');
    expect(textsOf(renderer)).toContain('Apoyar petición');
    expect(textsOf(renderer).join(' ')).toContain('Tu aporte se suma');
  });

  it('quien creó la petición también la puede apoyar', () => {
    expect(textsOf(renderMenu(PETITION, 'owner'))).toContain('Apoyar monetariamente');
  });

  it('no aparece en tareas que no son peticiones', () => {
    expect(textsOf(renderMenu({ ...PETITION, pch: 'consejos' }, 'fan'))).not.toContain('Apoyar monetariamente');
  });
});

describe('ir al foro desde el menú de 3 puntos', () => {
  const renderMenu = (currentUserId, goToForum = jest.fn()) => ({
    goToForum,
    renderer: render(
      <TaskActionsModal visible onClose={jest.fn()} actionTask={PETITION} currentUserId={currentUserId} handlers={{ goToForum }} />,
    ),
  });

  it('en una tarea ajena lleva al foro de quien la publicó', async () => {
    mockMe = { id: 'fan' };
    const { renderer, goToForum } = renderMenu('fan');
    await pressText(renderer, 'Ir al foro de @owner');
    expect(goToForum).toHaveBeenCalled();
  });

  it('en una tarea propia lleva a mi foro', () => {
    expect(textsOf(renderMenu('owner').renderer)).toContain('Ir a mi foro');
  });
});

describe('compartir en mi historia desde el menú de 3 puntos', () => {
  it('comparte toda la aportación o solo una de sus publicaciones', async () => {
    const api = require('@api').default;
    api.post.mockResolvedValue({ data: {} });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const task = { ...PETITION, subtasks: [{ id: 's1', title: 'Parque norte' }, { id: 's2', title: 'Elemento 2' }], subfactores: [{ id: 'f1', title: '' }] };
    const renderer = render(
      <TaskActionsModal visible onClose={jest.fn()} actionTask={task} currentUserId="fan" handlers={{}} />,
    );

    await act(async () => { byLabel(renderer, 'Compartir en mi historia').props.onPress(); });
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Toda la aportación', 'Parque norte', 'Publicación 2', 'Factor 1']));

    await pressText(renderer, 'Parque norte');
    expect(api.post).toHaveBeenLastCalledWith('stories/share-task/', {
      task_id: 'p1', source_item_type: 'subtasks', source_item_id: 's1',
    });
    await pressText(renderer, 'Toda la aportación');
    expect(api.post).toHaveBeenLastCalledWith('stories/share-task/', { task_id: 'p1' });
    expect(Alert.alert).toHaveBeenCalledWith('Listo', expect.any(String));
    Alert.alert.mockRestore();
  });
});

describe('menú de 3 puntos en un reel compartido', () => {
  it('seguir, favoritos y top 5 apuntan a quien se ve en el reel', async () => {
    const api = require('@api').default;
    api.post.mockResolvedValue({ data: {} });
    const reel = { id: 'r1', isSharedTask: true, task: PETITION, menuProfileUser: PETITION.user };
    const renderer = render(
      <TaskActionsModal visible onClose={jest.fn()} actionTask={reel} currentUserId="fan" handlers={{}} />,
    );
    expect(textsOf(renderer)).toEqual(expect.arrayContaining(['Seguir', 'Agregar perfil a favoritos', 'Anclar perfil en top 5']));

    await pressText(renderer, 'Anclar perfil en top 5');
    expect(api.post).toHaveBeenLastCalledWith('favorites/pin/', { type: 'profile', target_id: 'owner', is_pinned: true });
  });
});
