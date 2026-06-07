export function moveItemByDirection(items, id, direction) {
  const currentIndex = items.findIndex(item => item.id === id);
  const nextIndex = currentIndex + Number(direction || 0);
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= items.length) return null;

  const reordered = [...items];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, moved);
  return reordered;
}

export function moveItemToTargetPosition(items, sourceId, targetId) {
  if (!sourceId || sourceId === targetId) return null;
  const from = items.findIndex(item => item.id === sourceId);
  const to = items.findIndex(item => item.id === targetId);
  if (from < 0 || to < 0) return null;

  const reordered = [...items];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);
  return reordered;
}
