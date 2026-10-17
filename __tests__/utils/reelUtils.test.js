import { hasVideo } from '../../screens/reelUtils';

describe('hasVideo', () => {
  it('detecta videos en una tarea o en sus subtareas', () => {
    expect(hasVideo({ video: 'task.mp4' })).toBe(true);
    expect(hasVideo({ subtasks: [{ video: 'subtask.mp4' }] })).toBe(true);
  });

  it('no cuenta imágenes como videos', () => {
    expect(hasVideo({ image: 'image.jpg', subtasks: [{ image: 'subtask.jpg' }] })).toBe(false);
  });
});
