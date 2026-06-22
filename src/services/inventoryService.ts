import { inventoryService as localInventoryService } from './localInventoryService';

// The Inventory module will only communicate with this service.
// Currently mapped to local data mode (no Supabase).
// In the future, this can be swapped to `supabaseInventoryService`.
export const inventoryService = localInventoryService;
