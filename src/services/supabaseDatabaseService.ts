import { supabase } from '../lib/supabase';
import { DATA_SOURCE } from '../config/dataSource';

export const supabaseDatabaseService = {
  async getRows(tableName: string, orderByColumn: string = 'created_at', ascending: boolean = false) {
    if (DATA_SOURCE !== 'supabase') {
      throw new Error("Active DATA_SOURCE is not 'supabase'.");
    }
    
    // Attempt with order, but fallback to simple select if you want, 
    // actually it's better to just let the caller specify or assume created_at exists mostly.
    // Let's just do a simple select, since some tables might not have created_at.
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.error(`[Supabase Error] getRows on ${tableName}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async insertRow(tableName: string, payload: any) {
    if (DATA_SOURCE !== 'supabase') {
      throw new Error("Active DATA_SOURCE is not 'supabase'.");
    }
    const { data, error } = await supabase.from(tableName).insert([payload]).select();
    if (error) {
      console.error(`[Supabase Error] insertRow on ${tableName}:`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async updateRow(tableName: string, matchColumn: string, matchValue: string | number, payload: any) {
    if (DATA_SOURCE !== 'supabase') {
      throw new Error("Active DATA_SOURCE is not 'supabase'.");
    }
    const { data, error } = await supabase.from(tableName).update(payload).eq(matchColumn, matchValue).select();
    if (error) {
      console.error(`[Supabase Error] updateRow on ${tableName} (${matchColumn}=${matchValue}):`, error);
      throw new Error(error.message);
    }
    return data;
  },

  async deleteRow(tableName: string, matchColumn: string, matchValue: string | number) {
    if (DATA_SOURCE !== 'supabase') {
      throw new Error("Active DATA_SOURCE is not 'supabase'.");
    }
    const { data, error } = await supabase.from(tableName).delete().eq(matchColumn, matchValue).select();
    if (error) {
      console.error(`[Supabase Error] deleteRow on ${tableName} (${matchColumn}=${matchValue}):`, error);
      throw new Error(error.message);
    }
    return data;
  }
};
