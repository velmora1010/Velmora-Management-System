import { supabase } from '../lib/supabase';

export const rawMaterialService = {
  async getRawMaterials() {
    const { data, error } = await supabase.from('raw_materials').select('*');
    if (error) throw error;
    return data;
  },

  async getBatches() {
    const { data, error } = await supabase.from('batches').select('*');
    if (error) throw error;
    return data;
  },

  async saveRawMaterialIntake(inventoryInRecord: any, batchesData: any[]) {
    // 1. Insert inventory_in record
    const { data: invIn, error: invError } = await supabase
      .from('inventory_in')
      .insert(inventoryInRecord)
      .select('id')
      .single();

    if (invError) throw invError;

    // 2. Add inventory_in_id to batches
    const batchesToInsert = batchesData.map(b => ({
      ...b,
      inventory_in_id: invIn.id
    }));

    // 3. Insert or Update batches
    const { data: savedBatches, error: batchError } = await supabase
      .from('batches')
      .upsert(batchesToInsert, { onConflict: 'serial_number' })
      .select('id');

    if (batchError) throw batchError;
    
    return savedBatches.map(b => b.id);
  }
};
