import { fetchAll } from "../fetchAll";
import type { VendorClient } from "./client";

export const fetchDevices = (client: VendorClient) =>
  fetchAll((token) => client.get("/devices", { token }));
