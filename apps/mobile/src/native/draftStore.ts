const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function createDraftStore() {
  let owner: string | null = null;
  let values = new Map<string, string>();
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    switchUser(userId: string | null) {
      const next = userId && uuid.test(userId) ? userId : null;
      if (next === owner) return;
      owner = next; values = new Map(); notify();
    },
    read(userId: string | undefined, key: string) { return userId && userId === owner ? values.get(key) || "" : ""; },
    write(userId: string | undefined, key: string, text: string) {
      if (!userId || userId !== owner || !/^(game:chat|group:post|group:comment|profile:edit):[0-9a-f-]{36}$/i.test(key)) return false;
      if (key.startsWith("profile:edit:") && key !== `profile:edit:${userId}`) return false;
      const value = text.slice(0, key.startsWith("profile:edit:") ? 8000 : 2000);
      if ((values.get(key) || "") === value) return true;
      const next = new Map(values); next.delete(key);
      if (value) next.set(key, value);
      while (next.size > 64) next.delete(next.keys().next().value!);
      values = next; notify(); return true;
    },
  };
}
