import type { Page } from "../fetchAll";

export interface VendorClient {
  get<T>(path: string, params: { token?: string }): Promise<Page<T>>;
}
