import type { VendorClient } from "./client";

export interface User { id: string; email: string }

// Users endpoint predates fetchAll.
export async function fetchUsers(client: VendorClient): Promise<User[]> {
  const users: User[] = [];
  let token: string | undefined;
  for (;;) {
    const page = await client.get<User>("/users", { token });
    if (page.items.length === 0) break;
    users.push(...page.items);
    if (!page.nextToken) break;
    token = page.nextToken;
  }
  return users;
}
