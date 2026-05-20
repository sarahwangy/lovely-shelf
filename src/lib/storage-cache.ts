// 通用 localStorage / sessionStorage 读写工具
// 两个文件里出现了相同的 load/save 模式，提取到这里避免重复

export function loadCache<T>(key: string, storage: "local" | "session" = "local"): T {
  try {
    const store = storage === "session" ? sessionStorage : localStorage;
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}

export function saveCache<T>(key: string, value: T, storage: "local" | "session" = "local"): void {
  try {
    const store = storage === "session" ? sessionStorage : localStorage;
    store.setItem(key, JSON.stringify(value));
  } catch { /* storage full, ignore */ }
}
