import localforage from 'localforage'

export const db = localforage.createInstance({ name: 'famtresor', storeName: 'data' })

export async function load<T>(key: string, fallback: T): Promise<T> {
  return (await db.getItem<T>(key)) ?? fallback
}

export function save(key: string, value: unknown): void {
  void db.setItem(key, value)
}
