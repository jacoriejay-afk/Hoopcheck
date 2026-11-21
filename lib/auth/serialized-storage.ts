type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void>; removeItem: (key: string) => Promise<void> };
// Never abandon native credential writes: a timed-out bridge write may still
// commit later. Serialize per key so logout/new sign-in always follows old writes.
export function serializeAuthStorage(storage: Storage): Storage {
  const pending = new Map<string, Promise<unknown>>();
  function write(key: string, task: () => Promise<void>) {
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
    pending.set(key, result);
    void result.finally(() => { if (pending.get(key) === result) pending.delete(key); }).catch(() => {});
    return result;
  }
  return {
    async getItem(key) { await pending.get(key)?.catch(() => {}); return storage.getItem(key); },
    setItem: (key, value) => write(key, () => storage.setItem(key, value)),
    removeItem: key => write(key, () => storage.removeItem(key)),
  };
}
