export function nextRevision(lastRevision = 0, now = Date.now()) {
  return Math.max(Number(now || 0), Number(lastRevision || 0) + 1);
}

export function shouldApplyCloudSnapshot(cloudRevision, pendingRevision) {
  if (!pendingRevision) return true;
  return Number(cloudRevision || 0) >= Number(pendingRevision || 0);
}
