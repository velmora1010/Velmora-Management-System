import { supabase } from '../lib/supabase';

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
    const { data, error } = await supabase.from('production_batches').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getFinishedGoods() {
    const { data, error } = await supabase.from('finished_goods_inventory').select('*').order('scanned_at', { ascending: false });
    if (error) throw error;
    return data;
  }
};
