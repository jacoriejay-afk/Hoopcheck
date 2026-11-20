// Bound reads only. A timed-out native write can still commit later, so writes
// must keep their existing serialization and must never use this helper.
export function readWithDeadline<T>(read: () => PromiseLike<T>, milliseconds = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Device storage did not respond. Please try again.")), milliseconds);
    Promise.resolve().then(read).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
