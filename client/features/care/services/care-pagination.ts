import type { PaginatedResponse } from "../api-types";

// Fetch through the authenticated API helper, never an absolute `next` URL.
export async function collectCarePages<T extends { id: number }>(
  loadPage: (page: number) => Promise<PaginatedResponse<T>>,
): Promise<PaginatedResponse<T>> {
  const items = new Map<number, T>();
  let page = 1;
  let response: PaginatedResponse<T>;
  do {
    response = await loadPage(page++);
    for (const item of response.results) items.set(item.id, item);
  } while (response.next);
  return { count: items.size, next: null, previous: null, results: [...items.values()] };
}
