/**
 * __tests__/utils/download.test.js
 *
 * "Descargar" del menú de 3 puntos: imágenes y videos de una aportación.
 */
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import {
  DownloadPermissionError,
  downloadMedia,
  fileNameFor,
  getDownloadableMedia,
} from '../../utils/download';

jest.mock('@api', () => ({
  __esModule: true,
  default: {},
  getImageUrl: (path) => (path ? (String(path).startsWith('http') ? path : `https://api.test${path}`) : null),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(() => Promise.resolve()),
}));

const TASK = {
  id: 't1',
  image: '/media/tasks/portada.jpg',
  video: '/media/tasks/videos/clip.mp4',
  subtasks: [{ id: 1, image: '/media/subtasks/paso.png' }, { id: 2, image: '/media/tasks/portada.jpg' }],
  subfactores: [{ id: 3, video: 'https://cdn.test/factor.mov?token=1' }],
  subfuentes: [{ id: 4, title: 'Sin medios' }],
};

describe('getDownloadableMedia', () => {
  it('junta imágenes y videos de la aportación, consejos, factores y fuentes sin repetir', () => {
    expect(getDownloadableMedia(TASK)).toEqual([
      { url: 'https://api.test/media/tasks/portada.jpg', type: 'image' },
      { url: 'https://api.test/media/tasks/videos/clip.mp4', type: 'video' },
      { url: 'https://api.test/media/subtasks/paso.png', type: 'image' },
      { url: 'https://cdn.test/factor.mov?token=1', type: 'video' },
    ]);
  });

  it('en una compartida descarga la aportación original', () => {
    expect(getDownloadableMedia({ isSharedTask: true, id: 's1', task: { image: '/media/a.jpg' } }))
      .toEqual([{ url: 'https://api.test/media/a.jpg', type: 'image' }]);
  });

  it('sin medios no hay nada que descargar', () => {
    expect(getDownloadableMedia({ id: 't2', subtasks: [{ title: 'texto' }] })).toEqual([]);
    expect(getDownloadableMedia(null)).toEqual([]);
  });
});

describe('fileNameFor', () => {
  it('conserva el nombre del servidor y numera los archivos', () => {
    expect(fileNameFor({ url: 'https://x/media/mi foto.jpg', type: 'image' }, 0)).toBe('1-mi_foto.jpg');
    expect(fileNameFor({ url: 'https://x/v/clip.mp4?token=1', type: 'video' }, 2)).toBe('3-clip.mp4');
  });

  it('si no hay extensión usa una según el tipo', () => {
    expect(fileNameFor({ url: 'https://x/stream', type: 'video' }, 0)).toBe('aportacion-1.mp4');
    expect(fileNameFor({ url: 'https://x/', type: 'image' }, 1)).toBe('aportacion-2.jpg');
  });
});

describe('downloadMedia en el teléfono', () => {
  beforeEach(() => {
    FileSystem.downloadAsync.mockReset();
    MediaLibrary.saveToLibraryAsync.mockClear();
    MediaLibrary.requestPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('guarda cada archivo en la galería y borra la copia temporal', async () => {
    FileSystem.downloadAsync.mockImplementation((url, target) => Promise.resolve({ uri: target, status: 200 }));
    const result = await downloadMedia(getDownloadableMedia(TASK));

    expect(result).toEqual({ saved: 4, failed: 0 });
    expect(MediaLibrary.requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledTimes(4);
    expect(MediaLibrary.saveToLibraryAsync.mock.calls[0][0]).toMatch(/^file:\/\/\/cache\/\d+-1-portada\.jpg$/);
    expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(4);
  });

  it('cuenta los que fallan sin detener los demás', async () => {
    FileSystem.downloadAsync
      .mockResolvedValueOnce({ uri: 'file:///cache/a', status: 404 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ uri: 'file:///cache/b', status: 200 });
    expect(await downloadMedia(getDownloadableMedia(TASK))).toEqual({ saved: 2, failed: 2 });
    expect(MediaLibrary.saveToLibraryAsync).toHaveBeenCalledTimes(2);
  });

  it('sin permiso de galería no descarga nada', async () => {
    MediaLibrary.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await expect(downloadMedia(getDownloadableMedia(TASK))).rejects.toBeInstanceOf(DownloadPermissionError);
    expect(FileSystem.downloadAsync).not.toHaveBeenCalled();
  });
});
