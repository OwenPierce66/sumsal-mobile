import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { compressImage, compressImages } from '../../utils/compressImage';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

describe('compressImage', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    jest.clearAllMocks();
    Platform.OS = originalOS;
  });

  it('devuelve asset sin cambios si no tiene uri', async () => {
    const asset = { width: 800, height: 600 };
    expect(await compressImage(asset)).toBe(asset);
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  it('devuelve null si el asset es null', async () => {
    expect(await compressImage(null)).toBeNull();
  });

  it('omite compresión en plataforma web', async () => {
    Platform.OS = 'web';
    const asset = { uri: 'file://photo.jpg', width: 2000 };
    expect(await compressImage(asset)).toBe(asset);
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  it('aplica resize cuando ancho > 1280px', async () => {
    const output = { uri: 'compressed.jpg', width: 1280, height: 720 };
    ImageManipulator.manipulateAsync.mockResolvedValueOnce(output);

    const result = await compressImage({ uri: 'big.jpg', width: 2560, height: 1440 });

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'big.jpg',
      [{ resize: { width: 1280 } }],
      { compress: 0.82, format: 'jpeg' }
    );
    expect(result).toBe(output);
  });

  it('solo re-codifica JPEG cuando ancho <= 1280px', async () => {
    const output = { uri: 'reencoded.jpg', width: 800, height: 600 };
    ImageManipulator.manipulateAsync.mockResolvedValueOnce(output);

    await compressImage({ uri: 'small.jpg', width: 800, height: 600 });

    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'small.jpg',
      [],
      { compress: 0.82, format: 'jpeg' }
    );
  });

  it('usa asset original como fallback si la compresión falla', async () => {
    ImageManipulator.manipulateAsync.mockRejectedValueOnce(new Error('fail'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const asset = { uri: 'photo.jpg', width: 2000 };
    expect(await compressImage(asset)).toBe(asset);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('compressImages', () => {
  afterEach(() => jest.clearAllMocks());

  it('retorna null si no recibe array', async () => {
    expect(await compressImages(null)).toBeNull();
  });

  it('comprime todos los assets del array', async () => {
    const output = { uri: 'compressed.jpg', width: 800 };
    ImageManipulator.manipulateAsync.mockResolvedValue(output);

    const results = await compressImages([
      { uri: 'a.jpg', width: 800 },
      { uri: 'b.jpg', width: 800 },
      { uri: 'c.jpg', width: 800 },
    ]);

    expect(results).toHaveLength(3);
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);
  });
});
