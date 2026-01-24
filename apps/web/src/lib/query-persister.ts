import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

function mapReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __type: "Map",
      entries: Array.from(value.entries()),
    };
  }
  return value;
}

function mapReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && (value as Record<string, unknown>).__type === "Map") {
    return new Map((value as { entries: [unknown, unknown][] }).entries);
  }
  return value;
}

export const queryPersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "lyon-query-cache",
  throttleTime: 1000,
  serialize: (data) => JSON.stringify(data, mapReplacer),
  deserialize: (data) => JSON.parse(data, mapReviver),
});

const TWENTY_FOUR_HOURS = 1000 * 60 * 60 * 24;

export const persistOptions = {
  persister: queryPersister,
  maxAge: TWENTY_FOUR_HOURS,
  buster: "v1",
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { state: { status: string } }) => {
      return query.state.status === "success";
    },
  },
};
