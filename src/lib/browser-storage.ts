export type StorageIssue = "unavailable" | "corrupt" | null;
export type StoragePort = Pick<Storage, "getItem" | "setItem">;

export function readStored<T>(
  storage: () => StoragePort,
  key: string,
  parse: (data: unknown) => T,
): { value: T | null; issue: StorageIssue } {
  let raw: string | null;
  try {
    raw = storage().getItem(key);
  } catch {
    return { value: null, issue: "unavailable" };
  }
  if (raw === null) return { value: null, issue: null };
  try {
    return { value: parse(JSON.parse(raw)), issue: null };
  } catch {
    return { value: null, issue: "corrupt" };
  }
}

export function writeStored(
  storage: () => StoragePort,
  key: string,
  value: unknown,
): StorageIssue {
  try {
    storage().setItem(key, JSON.stringify(value));
    return null;
  } catch {
    return "unavailable";
  }
}
