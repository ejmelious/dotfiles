export interface Page<T> { items: T[]; nextToken?: string }
export type FetchPage<T> = (token?: string) => Promise<Page<T>>;

// Fetches every page from a token-paginated vendor API.
export async function fetchAll<T>(fetchPage: FetchPage<T>): Promise<T[]> {
  const all: T[] = [];
  let token: string | undefined;
  do {
    const page = await fetchPage(token);
    all.push(...page.items);
    token = page.nextToken;
  } while (token);
  return all;
}
