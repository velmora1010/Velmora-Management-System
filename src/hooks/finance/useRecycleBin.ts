import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { departmentService } from '../../services/departmentService';
import type { Department, DepartmentSection } from '../../types';

export type RecycleBinItemType = 'bill' | 'expense' | 'credit' | 'po' | 'file';

export interface RecycleBinItem {
  id: string;
  type: RecycleBinItemType;
  title: string;
  module: 'Bills' | 'Expenses' | 'Credit' | 'PO History' | 'Uploaded Files';
  amount: number | null;
  deletedAt: string | null;
  deletedBy: string | null;
  source: string | null;
  categoryHierarchy: string | null;
  notes: string | null;
  vendorOrSource: string | null;
  fileSource?: 'credit' | 'expense' | null;
  raw: any;
}

export const useRecycleBin = () => {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<DepartmentSection[]>([]);

  useEffect(() => {
    const loadMappings = async () => {
      try {
        const [deptsRes, secsRes] = await Promise.all([
          departmentService.getAllDepartments(),
          departmentService.getAllSections(),
        ]);
        if (deptsRes.data) setDepartments(deptsRes.data);
        if (secsRes.data) setSections(secsRes.data);
      } catch (err) {
        console.error('Failed to load mappings in useRecycleBin:', err);
      }
    };
    loadMappings();
  }, []);

  const getDeptName = useCallback((id: string | null | undefined) => {
    if (!id) return '-';
    const match = departments.find(d => String(d.id) === String(id));
    return match ? match.department_name : String(id);
  }, [departments]);

  const getSectionName = useCallback((id: string | null | undefined) => {
    if (!id) return '-';
    const match = sections.find(s => String(s.id) === String(id));
    return match ? match.section_name : String(id);
  }, [sections]);

  const fetchAllDeletedItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const unified: RecycleBinItem[] = [];

      // 1. Fetch archived bills
      try {
        const { data: bills, error: billsErr } = await supabase
          .from(SUPABASE_TABLES.financeBills)
          .select('*')
          .eq('status', 'archived')
          .order('created_at', { ascending: false });

        if (billsErr && billsErr.code !== '42703') {
          console.warn('Archived bills query warning:', billsErr);
        } else if (bills) {
          bills.forEach((b: any) => {
            const dept = getDeptName(b.main_category);
            const sec = getSectionName(b.sub_category1);
            const sub2 = b.sub_category2 ? ` › ${b.sub_category2}` : '';
            unified.push({
              id: b.id,
              type: 'bill',
              title: dept !== '-' ? dept : (b.notes || 'Archived Bill'),
              module: 'Bills',
              amount: b.amount != null ? Number(b.amount) : null,
              deletedAt: b.created_at || null,
              deletedBy: b.email || null,
              source: b.payment_type || b.mode_of_pay || null,
              categoryHierarchy: sec !== '-' ? `${sec}${sub2}` : null,
              notes: b.notes || null,
              vendorOrSource: b.account || b.email || null,
              raw: b,
            });
          });
        }
      } catch (err) {
        console.error('Failed fetching archived bills:', err);
      }

      // 2. Fetch archived expenses
      try {
        const { data: expenses, error: expErr } = await supabase
          .from(SUPABASE_TABLES.expenses)
          .select('*')
          .eq('status', 'archived')
          .order('created_at', { ascending: false });

        if (expErr && expErr.code !== '42703') {
          console.warn('Archived expenses query warning:', expErr);
        } else if (expenses) {
          expenses.forEach((e: any) => {
            const dept = getDeptName(e.main_category);
            const sec = getSectionName(e.sub_category1);
            const sub2 = e.sub_category2 ? ` › ${e.sub_category2}` : '';
            unified.push({
              id: e.id,
              type: 'expense',
              title: e.vendor || (dept !== '-' ? dept : (e.notes || 'Archived Expense')),
              module: 'Expenses',
              amount: e.amount != null ? Number(e.amount) : null,
              deletedAt: e.created_at || e.transaction_date || null,
              deletedBy: e.purchased_by || e.approved_by || null,
              source: e.payment_mode || e.bank_account || null,
              categoryHierarchy: dept !== '-' ? `${dept} › ${sec}${sub2}` : null,
              notes: e.notes || null,
              vendorOrSource: e.vendor || null,
              raw: e,
            });
          });
        }
      } catch (err) {
        console.error('Failed fetching archived expenses:', err);
      }

      // 3. Fetch archived credits
      try {
        const { data: credits, error: credErr } = await supabase
          .from(SUPABASE_TABLES.creditsRow)
          .select('*')
          .eq('status', 'archived')
          .order('created_at', { ascending: false });

        if (credErr && credErr.code !== '42703') {
          console.warn('Archived credits query warning:', credErr);
        } else if (credits) {
          credits.forEach((c: any) => {
            const dept = getDeptName(c.main_category);
            const sec = getSectionName(c.sub_category1);
            const sub2 = c.sub_category2 ? ` › ${c.sub_category2}` : '';
            unified.push({
              id: c.id,
              type: 'credit',
              title: c.source || (dept !== '-' ? dept : (c.notes || 'Archived Credit')),
              module: 'Credit',
              amount: c.amount != null ? Number(c.amount) : null,
              deletedAt: c.created_at || c.transaction_date || null,
              deletedBy: null,
              source: c.source || c.bank_account || null,
              categoryHierarchy: dept !== '-' ? `${dept} › ${sec}${sub2}` : null,
              notes: c.notes || null,
              vendorOrSource: c.source || null,
              raw: c,
            });
          });
        }
      } catch (err) {
        console.error('Failed fetching archived credits:', err);
      }

      // 4. Check for archived Purchase Orders (if status column exists)
      try {
        const { data: pos, error: poErr } = await supabase
          .from(SUPABASE_TABLES.purchaseOrders)
          .select('*')
          .eq('status', 'archived')
          .order('created_at', { ascending: false });

        if (!poErr && pos) {
          pos.forEach((p: any) => {
            const grandTotal = (p.subtotal || 0) + (p.gst_total || 0);
            unified.push({
              id: p.id,
              type: 'po',
              title: p.po_number || 'Archived Purchase Order',
              module: 'PO History',
              amount: grandTotal > 0 ? grandTotal : null,
              deletedAt: p.created_at || null,
              deletedBy: null,
              source: p.vendor_name || null,
              categoryHierarchy: p.category ? `${p.category}${p.sub_category_1 ? ` › ${p.sub_category_1}` : ''}` : null,
              notes: p.terms_conditions || null,
              vendorOrSource: p.vendor_name || null,
              raw: p,
            });
          });
        }
      } catch (err) {
        // Soft deletion on PO not yet provisioned in schema
      }

      // 5. Check for archived Uploaded Files
      try {
        const [expFiles, credFiles] = await Promise.all([
          supabase.from('expense_imports').select('*').eq('status', 'archived'),
          supabase.from(SUPABASE_TABLES.creditImports).select('*').eq('import_status', 'archived'),
        ]);

        if (!expFiles.error && expFiles.data) {
          expFiles.data.forEach((f: any) => {
            unified.push({
              id: f.id || f.batch_id,
              type: 'file',
              title: f.file_name || 'Archived Expense Statement',
              module: 'Uploaded Files',
              amount: null,
              deletedAt: f.imported_at || null,
              deletedBy: f.imported_by || null,
              source: f.source_type || f.document_type || 'Expense Statement',
              categoryHierarchy: `${f.total_rows || 0} rows`,
              notes: f.file_hash ? `Hash: ${f.file_hash.substring(0, 10)}...` : null,
              vendorOrSource: f.source_type || 'Expense Statement',
              fileSource: 'expense',
              raw: { ...f, fileCategory: 'expense' },
            });
          });
        }

        if (!credFiles.error && credFiles.data) {
          credFiles.data.forEach((f: any) => {
            unified.push({
              id: f.id || f.batch_id,
              type: 'file',
              title: f.file_name || 'Archived Credit Statement',
              module: 'Uploaded Files',
              amount: null,
              deletedAt: f.created_at || null,
              deletedBy: null,
              source: 'Credit Statement',
              categoryHierarchy: `${f.transaction_count || 0} transactions`,
              notes: f.file_hash ? `Hash: ${f.file_hash.substring(0, 10)}...` : null,
              vendorOrSource: 'Credit Statement',
              fileSource: 'credit',
              raw: { ...f, fileCategory: 'credit' },
            });
          });
        }
      } catch (err) {
        console.error('Failed fetching archived imports:', err);
      }

      setItems(unified);
    } catch (err: any) {
      console.error('Failed to load recycle bin data:', err);
      setError(err?.message || 'Failed to load recycle bin records.');
    } finally {
      setIsLoading(false);
    }
  }, [getDeptName, getSectionName]);

  useEffect(() => {
    fetchAllDeletedItems();
  }, [fetchAllDeletedItems]);

  // Restore single item
  const restoreItem = async (item: RecycleBinItem): Promise<{ success: boolean; error?: string }> => {
    try {
      if (item.type === 'bill') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.financeBills)
          .update({ status: 'active' })
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'expense') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.expenses)
          .update({ status: 'active' })
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'credit') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.creditsRow)
          .update({ status: 'active' })
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'po') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.purchaseOrders)
          .update({ status: 'active' })
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'file') {
        const isCredit = item.raw?.fileCategory === 'credit' || item.source === 'Credit Statement';
        const batchId = item.raw?.batch_id;

        if (isCredit) {
          // Restore credit import tracking record
          const { error: credImpErr } = await supabase
            .from(SUPABASE_TABLES.creditImports)
            .update({ import_status: 'completed' })
            .eq(batchId ? 'batch_id' : 'id', batchId || item.id);
          if (credImpErr) throw credImpErr;

          // Restore associated credit rows
          if (batchId) {
            const { error: credRowErr } = await supabase
              .from(SUPABASE_TABLES.creditsRow)
              .update({ status: 'active' })
              .eq('import_batch_id', batchId);
            if (credRowErr) {
              console.warn('Failed to restore associated credit rows:', credRowErr);
            }
          }
        } else {
          // Restore expense import tracking record
          const { error: expImpErr } = await supabase
            .from('expense_imports')
            .update({ status: 'completed' })
            .eq(batchId ? 'batch_id' : 'id', batchId || item.id);
          if (expImpErr) throw expImpErr;

          // Restore associated expense rows
          if (batchId) {
            const { error: expRowErr } = await supabase
              .from(SUPABASE_TABLES.expenses)
              .update({ status: 'active' })
              .eq('import_batch_id', batchId);
            if (expRowErr) {
              console.warn('Failed to restore associated expense rows:', expRowErr);
            }
          }
        }
      }

      setItems(prev => prev.filter(i => i.id !== item.id));
      return { success: true };
    } catch (err: any) {
      console.error('Failed to restore item:', err);
      return { success: false, error: err?.message || 'Failed to restore item' };
    }
  };

  // Permanently delete single item
  const permanentlyDeleteItem = async (item: RecycleBinItem): Promise<{ success: boolean; error?: string }> => {
    try {
      if (item.type === 'bill') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.financeBills)
          .delete()
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'expense') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.expenses)
          .delete()
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'credit') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.creditsRow)
          .delete()
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'po') {
        const { error } = await supabase
          .from(SUPABASE_TABLES.purchaseOrders)
          .delete()
          .eq('id', item.id);
        if (error) throw error;
      } else if (item.type === 'file') {
        const isCredit = item.raw?.fileCategory === 'credit' || item.source === 'Credit Statement';
        const batchId = item.raw?.batch_id;

        if (isCredit) {
          // Delete associated credit rows first
          if (batchId) {
            const { error: credRowErr } = await supabase
              .from(SUPABASE_TABLES.creditsRow)
              .delete()
              .eq('import_batch_id', batchId);
            if (credRowErr) {
              console.warn('Failed to delete associated credit rows:', credRowErr);
            }
          }

          // Delete credit import tracking record
          const { error: credImpErr } = await supabase
            .from(SUPABASE_TABLES.creditImports)
            .delete()
            .eq(batchId ? 'batch_id' : 'id', batchId || item.id);
          if (credImpErr) throw credImpErr;
        } else {
          // Delete associated expense rows first
          if (batchId) {
            const { error: expRowErr } = await supabase
              .from(SUPABASE_TABLES.expenses)
              .delete()
              .eq('import_batch_id', batchId);
            if (expRowErr) {
              console.warn('Failed to delete associated expense rows:', expRowErr);
            }
          }

          // Delete expense import tracking record
          const { error: expImpErr } = await supabase
            .from('expense_imports')
            .delete()
            .eq(batchId ? 'batch_id' : 'id', batchId || item.id);
          if (expImpErr) throw expImpErr;
        }
      }

      setItems(prev => prev.filter(i => i.id !== item.id));
      return { success: true };
    } catch (err: any) {
      console.error('Failed to permanently delete item:', err);
      return { success: false, error: err?.message || 'Failed to permanently delete item' };
    }
  };

  // Bulk restore
  const restoreBulk = async (selectedItems: RecycleBinItem[]): Promise<{ success: boolean; count: number; error?: string }> => {
    try {
      const billIds = selectedItems.filter(i => i.type === 'bill').map(i => i.id);
      const expIds = selectedItems.filter(i => i.type === 'expense').map(i => i.id);
      const credIds = selectedItems.filter(i => i.type === 'credit').map(i => i.id);
      const poIds = selectedItems.filter(i => i.type === 'po').map(i => i.id);

      const creditFileBatchIds = selectedItems
        .filter(i => i.type === 'file' && (i.raw?.fileCategory === 'credit' || i.source === 'Credit Statement'))
        .map(i => i.raw?.batch_id)
        .filter(Boolean) as string[];

      const expenseFileBatchIds = selectedItems
        .filter(i => i.type === 'file' && !(i.raw?.fileCategory === 'credit' || i.source === 'Credit Statement'))
        .map(i => i.raw?.batch_id)
        .filter(Boolean) as string[];

      const promises: Promise<any>[] = [];

      if (billIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.financeBills).update({ status: 'active' }).in('id', billIds)
        );
      }
      if (expIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.expenses).update({ status: 'active' }).in('id', expIds)
        );
      }
      if (credIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.creditsRow).update({ status: 'active' }).in('id', credIds)
        );
      }
      if (poIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.purchaseOrders).update({ status: 'active' }).in('id', poIds)
        );
      }
      if (creditFileBatchIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.creditImports).update({ import_status: 'completed' }).in('batch_id', creditFileBatchIds),
          supabase.from(SUPABASE_TABLES.creditsRow).update({ status: 'active' }).in('import_batch_id', creditFileBatchIds)
        );
      }
      if (expenseFileBatchIds.length > 0) {
        promises.push(
          supabase.from('expense_imports').update({ status: 'completed' }).in('batch_id', expenseFileBatchIds),
          supabase.from(SUPABASE_TABLES.expenses).update({ status: 'active' }).in('import_batch_id', expenseFileBatchIds)
        );
      }

      await Promise.all(promises);
      const restoredIds = new Set(selectedItems.map(i => i.id));
      setItems(prev => prev.filter(i => !restoredIds.has(i.id)));
      return { success: true, count: selectedItems.length };
    } catch (err: any) {
      console.error('Failed bulk restore:', err);
      return { success: false, count: 0, error: err?.message || 'Failed to restore items' };
    }
  };

  // Bulk permanent delete
  const permanentlyDeleteBulk = async (selectedItems: RecycleBinItem[]): Promise<{ success: boolean; count: number; error?: string }> => {
    try {
      const billIds = selectedItems.filter(i => i.type === 'bill').map(i => i.id);
      const expIds = selectedItems.filter(i => i.type === 'expense').map(i => i.id);
      const credIds = selectedItems.filter(i => i.type === 'credit').map(i => i.id);
      const poIds = selectedItems.filter(i => i.type === 'po').map(i => i.id);

      const creditFileBatchIds = selectedItems
        .filter(i => i.type === 'file' && (i.raw?.fileCategory === 'credit' || i.source === 'Credit Statement'))
        .map(i => i.raw?.batch_id)
        .filter(Boolean) as string[];

      const expenseFileBatchIds = selectedItems
        .filter(i => i.type === 'file' && !(i.raw?.fileCategory === 'credit' || i.source === 'Credit Statement'))
        .map(i => i.raw?.batch_id)
        .filter(Boolean) as string[];

      const promises: Promise<any>[] = [];

      if (billIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.financeBills).delete().in('id', billIds)
        );
      }
      if (expIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.expenses).delete().in('id', expIds)
        );
      }
      if (credIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.creditsRow).delete().in('id', credIds)
        );
      }
      if (poIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.purchaseOrders).delete().in('id', poIds)
        );
      }
      if (creditFileBatchIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.creditsRow).delete().in('import_batch_id', creditFileBatchIds),
          supabase.from(SUPABASE_TABLES.creditImports).delete().in('batch_id', creditFileBatchIds)
        );
      }
      if (expenseFileBatchIds.length > 0) {
        promises.push(
          supabase.from(SUPABASE_TABLES.expenses).delete().in('import_batch_id', expenseFileBatchIds),
          supabase.from('expense_imports').delete().in('batch_id', expenseFileBatchIds)
        );
      }

      await Promise.all(promises);
      const deletedIds = new Set(selectedItems.map(i => i.id));
      setItems(prev => prev.filter(i => !deletedIds.has(i.id)));
      return { success: true, count: selectedItems.length };
    } catch (err: any) {
      console.error('Failed bulk permanent delete:', err);
      return { success: false, count: 0, error: err?.message || 'Failed to permanently delete items' };
    }
  };

  const counts = {
    total: items.length,
    records: items.filter(i => i.type !== 'file').length,
    files: items.filter(i => i.type === 'file').length,
    bills: items.filter(i => i.type === 'bill').length,
    expenses: items.filter(i => i.type === 'expense').length,
    credits: items.filter(i => i.type === 'credit').length,
    po: items.filter(i => i.type === 'po').length,
  };

  return {
    items,
    isLoading,
    error,
    counts,
    refresh: fetchAllDeletedItems,
    restoreItem,
    permanentlyDeleteItem,
    restoreBulk,
    permanentlyDeleteBulk,
  };
};
