const cleanVal = (v) => (v ? String(v).trim() : null);

const uniq = (arr) => {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const c = cleanVal(v);
    if (!c) continue;
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
};

const getMediaEntry = (value, type) => {
  if (!value) return null;
  if (typeof value === 'object') {
    const src = value.src || value.url || value.uri || value.path;
    if (src) return { src, type: value.type || type };
  }
  return { src: value, type };
};

const extractMedia = (obj) => {
  if (!obj) return [];
  const bag = [];
  const add = (value, type) => {
    const entry = getMediaEntry(value, type);
    if (entry) bag.push(entry);
  };

  add(obj?.image, 'image');
  add(obj?.video, 'video');
  add(obj?.primary_image, 'image');
  add(obj?.primary_video, 'video');
  add(obj?.image_url, 'image');
  add(obj?.video_url, 'video');
  add(obj?.media_url, obj?.media_type);
  add(obj?.file, obj?.media_type || 'video');
  if (Array.isArray(obj?.images)) obj.images.forEach((value) => add(value, 'image'));
  if (Array.isArray(obj?.videos)) obj.videos.forEach((value) => add(value, 'video'));
  if (Array.isArray(obj?.media)) obj.media.forEach((value) => add(value, value?.type));
  if (Array.isArray(obj?.media_list)) obj.media_list.forEach((value) => add(value, value?.type));

  return bag;
};

const dedupeEntries = (entries) => {
  const out = [];
  const idxBySrc = new Map();
  for (const e of entries) {
    const src = cleanVal(e?.src);
    if (!src) continue;
    const next = { ...e, src };
    const existingIndex = idxBySrc.get(src);
    if (existingIndex == null) {
      idxBySrc.set(src, out.length);
      out.push(next);
      continue;
    }
  }
  return out;
};

const addEntries = (target, values, kind, item, groupIndex, groupTotal) => {
  values.forEach((entry, localIndex) => {
    target.push({
      ...entry,
      kind,
      item,
      groupIndex,
      groupTotal,
      localIndex,
      localTotal: values.length,
    });
  });
};

export const buildPlaylists = (task) => {
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
  const factores = Array.isArray(task?.subfactores) ? task.subfactores : [];
  const fuentes = Array.isArray(task?.subfuentes) ? task.subfuentes : [];

  const mainEntriesRaw = [];
  addEntries(mainEntriesRaw, extractMedia(task), 'main', task, null, null);

  subtasks.forEach((st, gi) => {
    addEntries(mainEntriesRaw, extractMedia(st), 'main', st, gi, subtasks.length);
  });

  factores.forEach((factor, gi) => {
    addEntries(mainEntriesRaw, extractMedia(factor), 'factores', factor, gi, factores.length);
  });

  fuentes.forEach((fuente, gi) => {
    addEntries(mainEntriesRaw, extractMedia(fuente), 'fuentes', fuente, gi, fuentes.length);
  });

  const mainMedia = dedupeEntries(mainEntriesRaw);

  const factoresMedia = [];
  factores.forEach((f, gi) => {
    addEntries(factoresMedia, extractMedia(f), 'factores', f, gi, factores.length);
  });

  const fuentesMedia = [];
  fuentes.forEach((fu, gi) => {
    addEntries(fuentesMedia, extractMedia(fu), 'fuentes', fu, gi, fuentes.length);
  });

  return { main: mainMedia, factores: factoresMedia, fuentes: fuentesMedia };
};

export const getFirstMediaAnywhere = (task) => buildPlaylists(task).main[0]?.src || null;

export const getUserIdFromTask = (task) => {
  return task?.user?.profile?.id || task?.user?.profile_id || task?.user?.id || task?.user_id || null;
};

export const arePropsEqual = (prevProps, nextProps) => {
  const getTaskId = (props) => props.item.is_original ? props.item.id : props.item.task?.id;
  const taskId = getTaskId(prevProps);

  if (taskId !== getTaskId(nextProps)) {
    return false; // Es un reel diferente, re-renderizar.
  }

  return (
    prevProps.isActive === nextProps.isActive &&
    prevProps.paused === nextProps.paused &&
    prevProps.enrichedItem === nextProps.enrichedItem &&
    prevProps.viewStateById[taskId] === nextProps.viewStateById[taskId] &&
    prevProps.expandedDescriptions[taskId] === nextProps.expandedDescriptions[taskId] &&
    prevProps.sharedOpenById[taskId] === nextProps.sharedOpenById[taskId]
  );
};