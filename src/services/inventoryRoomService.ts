import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';

export const inventoryRoomService = {
  async getInventoryIn() {
    const { data, error } = await supabase.from('inventory_in').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getBatches() {
    const { data, error } = await supabase.from('batches').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getProductionBatches() {
    console.log("Loading", SUPABASE_TABLES.productionBatches, "...");
    const { data, error } = await supabase.from(SUPABASE_TABLES.productionBatches).select('*').order('created_at', { ascending: false });
    console.log("Loaded table:", SUPABASE_TABLES.productionBatches, data?.length, error);
    if (error) throw error;
    return data;
  },

  async getFinishedGoods() {
    const { data, error } = await supabase.from('finished_goods_inventory').select('*').order('scanned_at', { ascending: false });
    if (error) throw error;
    return data;
  }
};
