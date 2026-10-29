import { getImageUrl } from '@api';

/** Ventana de las historias y cómo sacar su medio: lo comparten el visor, la barra y los aros de los avatares. */
export const STORY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const cleanVal = (value) => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const parseCreatedAtMs = (story) => {
  const raw = story?.created_at || story?.createdAt || null;
  if (!raw) return null;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : null;
};

export const getStoryMedia = (story) => {
  const videoPath =
    cleanVal(story?.video) ||
    cleanVal(story?.primary_video) ||
    cleanVal(story?.video_url) ||
    cleanVal(story?.media_url) ||
    cleanVal(story?.source_item_video) ||
    cleanVal(story?.source_task_video) ||
    cleanVal(story?.subtasks?.[0]?.video) ||
    cleanVal(story?.subfactores?.[0]?.video) ||
    cleanVal(story?.subfuentes?.[0]?.video);

  if (videoPath) {
    return { type: 'video', src: getImageUrl(videoPath) };
  }

  const imagePath =
    cleanVal(story?.image) ||
    cleanVal(story?.image_url) ||
    cleanVal(story?.photo) ||
    cleanVal(story?.picture) ||
    cleanVal(story?.source_item_image) ||
    cleanVal(story?.source_task_image) ||
    cleanVal(story?.subtasks?.[0]?.image) ||
    cleanVal(story?.subfactores?.[0]?.image) ||
    cleanVal(story?.subfuentes?.[0]?.image);

  if (imagePath) {
    return { type: 'image', src: getImageUrl(imagePath) };
  }

  // Un testimonio compartido es solo texto: se ve como una tarjeta con la cita.
  const testimonial = story?.testimonial_story;
  if (testimonial && (cleanVal(testimonial.text) || cleanVal(testimonial.title))) {
    return {
      type: 'text',
      title: cleanVal(testimonial.title),
      text: cleanVal(testimonial.text),
      forUsername: cleanVal(testimonial.for_username),
    };
  }

  return null;
};
