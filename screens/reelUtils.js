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

const extractVideos = (obj) => {
  if (!obj) return [];
  const bag = [];
  bag.push(obj?.primary_video);
  bag.push(obj?.video);
  bag.push(obj?.task?.video);
  bag.push(obj?.video_url);
  bag.push(obj?.media_url);
  bag.push(obj?.file);
  bag.push(obj?.video2);
  bag.push(obj?.video_2);
  bag.push(obj?.video3);
  bag.push(obj?.video_3);
  if (Array.isArray(obj?.videos)) bag.push(...obj.videos);
  if (Array.isArray(obj?.video_list)) bag.push(...obj.video_list);
  if (Array.isArray(obj?.media_videos)) bag.push(...obj.media_videos);
  return uniq(bag);
};

const dedupeMainPreferContribution = (entries) => {
  const out = [];
  const idxBySrc = new Map();
  const isSub = (e) => e?.groupIndex != null;
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
    const prev = out[existingIndex];
    if (!isSub(prev) && isSub(next)) {
      out[existingIndex] = next;
    }
  }
  return out;
};

export const buildPlaylists = (task) => {
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
  const factores = Array.isArray(task?.subfactores) ? task.subfactores : [];
  const fuentes = Array.isArray(task?.subfuentes) ? task.subfuentes : [];

  const mainEntriesRaw = [];
  const taskVids = extractVideos(task);
  taskVids.forEach((src, li) => {
    mainEntriesRaw.push({ src, kind: "main", item: task, groupIndex: null, groupTotal: null, localIndex: li, localTotal: taskVids.length });
  });

  subtasks.forEach((st, gi) => {
    const vids = extractVideos(st);
    vids.forEach((src, li) => {
      mainEntriesRaw.push({ src, kind: "main", item: st, groupIndex: gi, groupTotal: subtasks.length, localIndex: li, localTotal: vids.length });
    });
  });

  const mainVideos = dedupeMainPreferContribution(mainEntriesRaw);

  const factoresVideos = [];
  factores.forEach((f, gi) => {
    const vids = extractVideos(f);
    vids.forEach((src, li) => {
      factoresVideos.push({ src, kind: "factores", item: f, groupIndex: gi, groupTotal: factores.length, localIndex: li, localTotal: vids.length });
    });
  });

  const fuentesVideos = [];
  fuentes.forEach((fu, gi) => {
    const vids = extractVideos(fu);
    vids.forEach((src, li) => {
      fuentesVideos.push({ src, kind: "fuentes", item: fu, groupIndex: gi, groupTotal: fuentes.length, localIndex: li, localTotal: vids.length });
    });
  });

  return { main: mainVideos, factores: factoresVideos, fuentes: fuentesVideos };
};

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