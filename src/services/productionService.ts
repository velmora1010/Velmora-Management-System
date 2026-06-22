import { supabase } from '../lib/supabase';

export const productionService = {
  async getProductionBatches() {
    const { data, error } = await supabase.from('production_batches').select('*');
    if (error) throw error;
    return data;
  },

  async getMicroBatches(productionBatchId: string) {
    const { data, error } = await supabase
      .from('production_micro_batches')
      .select('*')
      .eq('production_batch_id', productionBatchId);
    if (error) throw error;
    return data;
  },

  async saveProductionBatch(
    batchData: any, 
    microBatches: any[], 
    ingredients: any[], 
    issues: any[], 
    finishedGoods: any[],
    updatedRawMaterials: { id: string, available_quantity: number, status: string }[]
  ) {
    // 1. Insert/Update Production Batch
    const { error: batchError } = await supabase
      .from('production_batches')
      .upsert(batchData, { onConflict: 'production_batch_id' });
    if (batchError) throw batchError;

    // 2. Insert Micro Batches
    if (microBatches.length > 0) {
      const { error: microError } = await supabase
        .from('production_micro_batches')
        .upsert(microBatches);
      if (microError) throw microError;
    }

    // 3. Insert Ingredients
    if (ingredients.length > 0) {
      const { error: ingError } = await supabase
        .from('production_ingredients')
        .upsert(ingredients);
      if (ingError) throw ingError;
    }

    // 4. Insert Issues
    if (issues.length > 0) {
      const { error: issuesError } = await supabase
        .from('raw_material_issues')
        .insert(issues);
      if (issuesError) throw issuesError;
    }

    // 5. Insert Finished Goods
    if (finishedGoods.length > 0) {
      const { error: fgError } = await supabase
        .from('finished_goods_inventory')
        .insert(finishedGoods);
      if (fgError) throw fgError;
    }

    // 6. Update Raw Material Batches (decrease quantities)
    // Supabase does not support bulk updates natively with a single call easily without a stored function,
    // so we'll run them individually. Since JS is fast and batches are few per transaction.
    for (const rm of updatedRawMaterials) {
      const { error: updateError } = await supabase
        .from('batches')
        .update({ 
          available_quantity: rm.available_quantity, 
          status: rm.status 
        })
        .eq('id', rm.id);
      if (updateError) throw updateError;
    }

    return true;
  }
};
