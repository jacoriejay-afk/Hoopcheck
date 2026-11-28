import type { GroupSend } from "./hoopGroupsSend.ts";

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function createGroupOutbox(storage: Storage) {
  const pending = new Map<string, Promise<unknown>>();

  function scope(owner: string, channel: string) {
    if (!uuid.test(owner) || !uuid.test(channel)) throw Error("Invalid outbox scope.");
    return `hoopgroups.outbox.v1.${owner}.${channel}`;
  }

  async function read(key: string, owner: string, channel: string): Promise<GroupSend | null> {
    const value = await storage.getItem(key);
    if (value === null) return null;
    const row = JSON.parse(value) as GroupSend;
    if (!row || row.owner !== owner || row.channel !== channel || typeof row.id !== "string" ||
      !uuid.test(row.id) || typeof row.body !== "string" || !row.body.trim() || row.body.length > 1200 ||
      (row.replyTo !== undefined && (typeof row.replyTo !== "string" || !uuid.test(row.replyTo) || row.replyTo === row.id))) {
      throw Error("Saved message could not be verified.");
    }
    return { id: row.id, owner, channel, body: row.body, ...(row.replyTo ? { replyTo: row.replyTo } : {}) };
  }

  function serial<T>(key: string, run: () => Promise<T>) {
    const result = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
    pending.set(key, result);
    void result.finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    }).catch(() => {});
    return result;
  }

  return {
    load(owner: string, channel: string) {
      const key = scope(owner, channel);
      return serial(key, () => read(key, owner, channel));
    },
    save(message: GroupSend) {
      const { owner, channel } = message;
      const key = scope(owner, channel);
      return serial(key, async () => {
        if (await read(key, owner, channel)) throw Error("Resolve the saved message before posting another.");
        await storage.setItem(key, JSON.stringify(message));
      });
    },
    remove(message: GroupSend) {
      const { owner, channel, id } = message;
      const key = scope(owner, channel);
      return serial(key, async () => {
        if ((await read(key, owner, channel))?.id === id) await storage.removeItem(key);
      });
    },
  };
}
