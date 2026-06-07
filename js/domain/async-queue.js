export function createAsyncQueue() {
  let tail = Promise.resolve();

  return function enqueue(task) {
    const run = tail.catch(() => undefined).then(task);
    tail = run;
    return run;
  };
}
