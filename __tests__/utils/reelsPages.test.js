import { buildReelsFromPages } from '../../utils/reelsPages';

const media = (content) => content.media || null;

describe('buildReelsFromPages', () => {
  it('devuelve [] sin datos', () => {
    expect(buildReelsFromPages(undefined, media)).toEqual([]);
    expect(buildReelsFromPages({}, media)).toEqual([]);
  });

  it('aplana páginas conservando el orden y adjunta _anyMedia', () => {
    const data = {
      pages: [
        { results: [{ id: 1, is_original: true, media: 'a.mp4' }] },
        { results: [{ id: 2, is_original: true, media: 'b.jpg' }] },
      ],
    };
    const reels = buildReelsFromPages(data, media);
    expect(reels.map((r) => r.id)).toEqual([1, 2]);
    expect(reels[0]._anyMedia).toBe('a.mp4');
  });

  it('descarta items sin medio y sin contenido', () => {
    const data = {
      pages: [{
        results: [
          { id: 1, is_original: true },                       // sin medio
          { id: 2, is_original: false },                      // compartido sin task
          { id: 3, is_original: false, task: { media: 'c' } }, // compartido válido
        ],
      }],
    };
    expect(buildReelsFromPages(data, media).map((r) => r.id)).toEqual([3]);
  });

  it('elimina duplicados entre páginas', () => {
    const item = { id: 5, is_original: true, media: 'x' };
    const data = { pages: [{ results: [item] }, { results: [item, { id: 6, is_original: true, media: 'y' }] }] };
    expect(buildReelsFromPages(data, media).map((r) => r.id)).toEqual([5, 6]);
  });

  it('acepta páginas que son arrays directos', () => {
    const data = { pages: [[{ id: 9, is_original: true, media: 'z' }]] };
    expect(buildReelsFromPages(data, media)).toHaveLength(1);
  });

  it('permite limitar el feed a publicaciones con videos, incluidas las compartidas', () => {
    const data = {
      pages: [{
        results: [
          { id: 1, is_original: true, media: [{ type: 'image' }] },
          { id: 2, is_original: true, media: [{ type: 'image' }, { type: 'video' }] },
          { id: 3, is_original: false, task: { media: [{ type: 'video' }] } },
        ],
      }],
    };
    const hasVideo = (content) => content.media?.some((entry) => entry.type === 'video');

    expect(buildReelsFromPages(data, media, hasVideo).map((reel) => reel.id)).toEqual([2, 3]);
  });
});
