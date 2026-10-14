export function nextRevision(lastRevision = 0, now = Date.now()) {
  return Math.max(Number(now || 0), Number(lastRevision || 0) + 1);
}

export function shouldApplyCloudSnapshot(cloudRevision, pendingRevision = 0, localRevision = 0) {
  const minimumRevision = Math.max(
    Number(pendingRevision || 0),
    Number(localRevision || 0)
  );
  return Number(cloudRevision || 0) >= minimumRevision;
}
