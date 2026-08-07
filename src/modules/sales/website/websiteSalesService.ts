import { supabase } from '../../../lib/supabase';
import type { 
  WebsiteUploadBatch, 
  WebsiteRawOrderRow, 
  WebsiteConsolidatedOrder, 
  WebsiteSalesFilterState,
  ColumnMapping,
  PriceInterpretationMode
} from './types';
import { 
  parseFileToRawRows, 
  detectColumnMapping, 
  consolidateRawRows,
  getTodayInBusinessTimezone,
  formatSalesDateShort
} from './websiteSalesUtils';

const UPLOADS_KEY = 'website_sales_upload_batches';
const RAW_ROWS_KEY = 'website_sales_raw_order_rows';
const ORDERS_KEY = 'website_sales_consolidated_orders';

export class WebsiteSalesService {
  // Helper for localStorage JSON fallback
  private getLocalList<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private setLocalList<T>(key: string, list: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.warn(`LocalStorage write error for ${key}:`, e);
    }
  }

  // Parse uploaded spreadsheet file, perform consolidation, and persist records
  async processAndUploadFile(
    file: File,
    uploadedBy: string = 'Current User',
    priceMode: PriceInterpretationMode = 'Order Total'
  ): Promise<{ batch: WebsiteUploadBatch; consolidatedOrders: WebsiteConsolidatedOrder[] }> {
    const { headers, rows: rawJsonRows } = await parseFileToRawRows(file);
    const mapping = detectColumnMapping(headers);

    const batchId = crypto.randomUUID();
    const {
      consolidatedOrders,
      rawRowsProcessed,
      validRowCount,
      invalidRowCount,
      duplicateOrderCount,
      detectedOrderDates
    } = consolidateRawRows(rawJsonRows, mapping, priceMode, batchId);

    const mainOrderDate = detectedOrderDates.length > 0 ? detectedOrderDates[0] : getTodayInBusinessTimezone();
    const dateRangeStr = detectedOrderDates.length > 1
      ? `${formatSalesDateShort(detectedOrderDates[0])} – ${formatSalesDateShort(detectedOrderDates[detectedOrderDates.length - 1])}`
      : formatSalesDateShort(mainOrderDate);

    const batch: WebsiteUploadBatch = {
      id: batchId,
      file_name: file.name,
      uploaded_by: uploadedBy,
      uploaded_at: new Date().toISOString(),
      total_source_rows: rawJsonRows.length,
      total_unique_orders: consolidatedOrders.length,
      valid_rows: validRowCount,
      invalid_rows: invalidRowCount,
      duplicate_order_count: duplicateOrderCount,
      price_interpretation: priceMode,
      status: 'COMPLETED',
      column_mapping: mapping,
      order_date: mainOrderDate,
      order_date_range: dateRangeStr
    };

    await this.saveUploadRecords(batch, rawRowsProcessed, consolidatedOrders);

    return { batch, consolidatedOrders };
  }

  // Save records to Supabase with LocalStorage fallback
  private async saveUploadRecords(
    batch: WebsiteUploadBatch,
    rawRows: WebsiteRawOrderRow[],
    consolidatedOrders: WebsiteConsolidatedOrder[]
  ): Promise<void> {
    try {
      // Insert Batch
      const { error: batchErr } = await supabase
        .from('website_order_uploads')
        .insert([{
          id: batch.id,
          file_name: batch.file_name,
          uploaded_by: batch.uploaded_by,
          uploaded_at: batch.uploaded_at,
          total_source_rows: batch.total_source_rows,
          total_unique_orders: batch.total_unique_orders,
          valid_rows: batch.valid_rows,
          invalid_rows: batch.invalid_rows,
          duplicate_order_count: batch.duplicate_order_count,
          price_interpretation: batch.price_interpretation,
          status: batch.status,
          column_mapping: batch.column_mapping,
          order_date: batch.order_date,
          order_date_range: batch.order_date_range
        }]);

      if (!batchErr) {
        // Insert Raw Rows in chunks of 500
        const rawPayloads = rawRows.map(r => ({
          id: r.id,
          upload_batch_id: batch.id,
          row_number: r.row_number,
          raw_data: r.raw_data,
          order_id: r.order_id,
          customer_name: r.customer_name,
          product_name: r.product_name,
          quantity: r.quantity,
          price: r.price,
          payment_mode: r.payment_mode,
          order_date: r.order_date,
          original_order_date: r.original_order_date,
          validation_status: r.validation_status,
          validation_errors: r.validation_errors
        }));

        for (let i = 0; i < rawPayloads.length; i += 500) {
          const chunk = rawPayloads.slice(i, i + 500);
          await supabase.from('website_order_raw_rows').insert(chunk);
        }

        // Insert Consolidated Orders & Items
        const orderPayloads = consolidatedOrders.map(o => ({
          id: o.id,
          order_id: o.order_id,
          customer_name: o.customer_name,
          address: o.address,
          state: o.state,
          city: o.city,
          pincode: o.pincode,
          offer: o.offer,
          price: o.price,
          phone: o.phone,
          payment_mode: o.payment_mode,
          source_payment_mode: o.source_payment_mode,
          source_payment_method: o.source_payment_method,
          advance_paid: o.advance_paid,
          remaining_payable: o.remaining_payable,
          payment_classification_reason: o.payment_classification_reason,
          order_date: o.order_date,
          original_order_date: o.original_order_date,
          total_quantity: o.total_quantity,
          upload_batch_id: batch.id,
          data_conflict: o.data_conflict,
          conflict_details: o.conflict_details,
          created_at: o.created_at
        }));

        for (let i = 0; i < orderPayloads.length; i += 500) {
          const chunk = orderPayloads.slice(i, i + 500);
          await supabase.from('website_orders').insert(chunk);
        }

        // Insert Order Items
        const itemPayloads: any[] = [];
        consolidatedOrders.forEach(o => {
          if (o.items && o.items.length > 0) {
            o.items.forEach(it => {
              itemPayloads.push({
                id: it.id || crypto.randomUUID(),
                website_order_id: o.id,
                product_name: it.product_name,
                quantity: it.quantity
              });
            });
          }
        });

        for (let i = 0; i < itemPayloads.length; i += 500) {
          const chunk = itemPayloads.slice(i, i + 500);
          await supabase.from('website_order_items').insert(chunk);
        }
      }
    } catch (e) {
      console.warn('Supabase insert warning, saving locally:', e);
    }

    // Always keep local store updated as fallback
    const batches = this.getLocalList<WebsiteUploadBatch>(UPLOADS_KEY);
    batches.unshift(batch);
    this.setLocalList(UPLOADS_KEY, batches);

    const existingRaw = this.getLocalList<WebsiteRawOrderRow>(RAW_ROWS_KEY);
    this.setLocalList(RAW_ROWS_KEY, [...rawRows, ...existingRaw]);

    const existingOrders = this.getLocalList<WebsiteConsolidatedOrder>(ORDERS_KEY);
    this.setLocalList(ORDERS_KEY, [...consolidatedOrders, ...existingOrders]);
  }

  // Get Upload Batches
  async getUploadBatches(): Promise<WebsiteUploadBatch[]> {
    try {
      const { data, error } = await supabase
        .from('website_order_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as WebsiteUploadBatch[];
      }
    } catch (e) {
      console.warn('Supabase fetch batches fallback:', e);
    }

    return this.getLocalList<WebsiteUploadBatch>(UPLOADS_KEY);
  }

  // Get Raw Order Rows
  async getRawOrderRows(batchId?: string): Promise<WebsiteRawOrderRow[]> {
    try {
      let query = supabase.from('website_order_raw_rows').select('*').order('row_number', { ascending: true });
      if (batchId) {
        query = query.eq('upload_batch_id', batchId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as WebsiteRawOrderRow[];
      }
    } catch (e) {
      console.warn('Supabase fetch raw rows fallback:', e);
    }

    const localRows = this.getLocalList<WebsiteRawOrderRow>(RAW_ROWS_KEY);
    if (batchId) {
      return localRows.filter(r => r.upload_batch_id === batchId);
    }
    return localRows;
  }

  // Reprocess existing batch using preserved raw rows and updated column mapping
  async reprocessUploadBatch(batchId: string): Promise<WebsiteConsolidatedOrder[]> {
    const rawRows = await this.getRawOrderRows(batchId);
    if (rawRows.length === 0) return [];

    const rawObjects = rawRows.map(r => r.raw_data || r);
    const headers = Object.keys(rawObjects[0] || {});

    // Re-detect column mapping with updated priorities
    const mapping = detectColumnMapping(headers);

    // Get batch metadata
    const batches = await this.getUploadBatches();
    const batchInfo = batches.find(b => b.id === batchId);
    const priceMode = batchInfo?.price_interpretation || 'Order Total';

    // Re-consolidate orders using rawRows directly for multi-row carry forward
    const { consolidatedOrders, detectedOrderDates } = consolidateRawRows(rawRows, mapping, priceMode, batchId);

    const mainOrderDate = detectedOrderDates.length > 0 ? detectedOrderDates[0] : getTodayInBusinessTimezone();
    const dateRangeStr = detectedOrderDates.length > 1
      ? `${formatSalesDateShort(detectedOrderDates[0])} – ${formatSalesDateShort(detectedOrderDates[detectedOrderDates.length - 1])}`
      : formatSalesDateShort(mainOrderDate);

    // Update batch in LocalStorage
    const updatedBatches = batches.map(b => {
      if (b.id === batchId) {
        return {
          ...b,
          order_date: mainOrderDate,
          order_date_range: dateRangeStr
        };
      }
      return b;
    });
    this.setLocalList(UPLOADS_KEY, updatedBatches);

    // Overwrite in Supabase
    try {
      await supabase.from('website_orders').delete().eq('upload_batch_id', batchId);
      await supabase.from('website_order_items').delete().eq('website_order_id', batchId);

      const orderPayloads = consolidatedOrders.map(o => ({
        id: o.id,
        order_id: o.order_id,
        customer_name: o.customer_name,
        address: o.address,
        state: o.state,
        city: o.city,
        pincode: o.pincode,
        offer: o.offer,
        price: o.price,
        phone: o.phone,
        payment_mode: o.payment_mode,
        source_payment_mode: o.source_payment_mode,
        source_payment_method: o.source_payment_method,
        advance_paid: o.advance_paid,
        remaining_payable: o.remaining_payable,
        payment_classification_reason: o.payment_classification_reason,
        order_date: o.order_date,
        original_order_date: o.original_order_date,
        total_quantity: o.total_quantity,
        upload_batch_id: batchId,
        data_conflict: o.data_conflict,
        conflict_details: o.conflict_details,
        created_at: o.created_at
      }));

      for (let i = 0; i < orderPayloads.length; i += 500) {
        const chunk = orderPayloads.slice(i, i + 500);
        await supabase.from('website_orders').insert(chunk);
      }

      const itemPayloads: any[] = [];
      consolidatedOrders.forEach(o => {
        if (o.items && o.items.length > 0) {
          o.items.forEach(it => {
            itemPayloads.push({
              id: it.id || crypto.randomUUID(),
              website_order_id: o.id,
              product_name: it.product_name,
              quantity: it.quantity
            });
          });
        }
      });

      for (let i = 0; i < itemPayloads.length; i += 500) {
        const chunk = itemPayloads.slice(i, i + 500);
        await supabase.from('website_order_items').insert(chunk);
      }
    } catch (e) {
      console.warn('Supabase reprocess overwrite warning:', e);
    }

    // Overwrite in LocalStorage
    const localOrders = this.getLocalList<WebsiteConsolidatedOrder>(ORDERS_KEY);
    const otherOrders = localOrders.filter(o => o.upload_batch_id !== batchId);
    this.setLocalList(ORDERS_KEY, [...consolidatedOrders, ...otherOrders]);

    return consolidatedOrders;
  }

  // Fetch Consolidated Orders with filters
  async getConsolidatedOrders(filters?: WebsiteSalesFilterState): Promise<WebsiteConsolidatedOrder[]> {
    let orders: WebsiteConsolidatedOrder[] = [];

    try {
      let query = supabase.from('website_orders').select('*').order('created_at', { ascending: false });
      if (filters?.batchId) {
        query = query.eq('upload_batch_id', filters.batchId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        orders = data as WebsiteConsolidatedOrder[];
      }
    } catch (e) {
      console.warn('Supabase fetch orders fallback:', e);
    }

    if (orders.length === 0) {
      orders = this.getLocalList<WebsiteConsolidatedOrder>(ORDERS_KEY);
    }

    // Auto-heal check: if any orders missing order_date or remaining_payable
    const needsReprocessing = orders.some(o => (o.order_date === undefined || o.customer_name === o.order_id || o.state === '-' || o.payment_mode === 'UNKNOWN' || o.remaining_payable === undefined) && o.upload_batch_id);
    if (needsReprocessing) {
      const batchIdsToReprocess = Array.from(
        new Set(orders.filter(o => (o.order_date === undefined || o.customer_name === o.order_id || o.state === '-' || o.payment_mode === 'UNKNOWN' || o.remaining_payable === undefined) && o.upload_batch_id).map(o => o.upload_batch_id))
      );
      for (const bId of batchIdsToReprocess) {
        if (bId) {
          const reprocessed = await this.reprocessUploadBatch(bId);
          if (reprocessed.length > 0) {
            orders = orders.filter(o => o.upload_batch_id !== bId).concat(reprocessed);
          }
        }
      }
    }

    // Apply in-memory client filtering for rich combination queries
    if (!filters) return orders;

    return orders.filter(o => {
      if (filters.batchId && o.upload_batch_id !== filters.batchId) return false;
      if (filters.selectedDate && o.order_date !== filters.selectedDate) return false;

      // 1. Order ID Search
      if (filters.orderIdSearch) {
        const q = filters.orderIdSearch.toLowerCase().trim();
        if (!o.order_id.toLowerCase().includes(q)) return false;
      }

      // 2. Customer Name Search
      if (filters.customerNameSearch) {
        const q = filters.customerNameSearch.toLowerCase().trim();
        if (!o.customer_name.toLowerCase().includes(q)) return false;
      }

      // 3. Phone Search (10-digit normalized)
      if (filters.phoneSearch) {
        const q = filters.phoneSearch.replace(/\D/g, '');
        const orderPhone = (o.phone || '').replace(/\D/g, '');
        if (q && !orderPhone.includes(q)) return false;
      }

      // 4. Single dropdown backward compatibility & Multi-select arrays
      if (filters.state && o.state !== filters.state) return false;
      if (filters.city && o.city !== filters.city) return false;
      if (filters.paymentMode && o.payment_mode !== filters.paymentMode) return false;
      if (filters.offer && o.offer !== filters.offer) return false;

      if (filters.batchIds && filters.batchIds.length > 0 && !filters.batchIds.includes(o.upload_batch_id)) return false;
      if (filters.states && filters.states.length > 0 && !filters.states.includes(o.state)) return false;
      if (filters.cities && filters.cities.length > 0 && !filters.cities.includes(o.city)) return false;
      if (filters.pincodes && filters.pincodes.length > 0 && !filters.pincodes.includes(o.pincode)) return false;
      if (filters.paymentModes && filters.paymentModes.length > 0 && !filters.paymentModes.includes(o.payment_mode)) return false;
      if (filters.offers && filters.offers.length > 0 && !filters.offers.includes(o.offer || 'No Offer')) return false;

      // 5. Price & Remaining COD Ranges
      if (filters.minPrice && !isNaN(parseFloat(filters.minPrice)) && o.price < parseFloat(filters.minPrice)) return false;
      if (filters.maxPrice && !isNaN(parseFloat(filters.maxPrice)) && o.price > parseFloat(filters.maxPrice)) return false;

      if (filters.minRemainingCod && !isNaN(parseFloat(filters.minRemainingCod))) {
        const rem = o.remaining_payable ?? (o.payment_mode === 'COD' ? o.price : 0);
        if (rem < parseFloat(filters.minRemainingCod)) return false;
      }
      if (filters.maxRemainingCod && !isNaN(parseFloat(filters.maxRemainingCod))) {
        const rem = o.remaining_payable ?? (o.payment_mode === 'COD' ? o.price : 0);
        if (rem > parseFloat(filters.maxRemainingCod)) return false;
      }

      // 6. Products
      if (filters.products && filters.products.length > 0) {
        const hasProd = o.items
          ? o.items.some(it => filters.products!.includes(it.product_name.trim()))
          : filters.products.some(p => o.product_name.includes(p));
        if (!hasProd) return false;
      } else if (filters.product) {
        const prodSearch = filters.product.toLowerCase();
        const hasMatch = o.product_name.toLowerCase().includes(prodSearch) ||
          (o.items && o.items.some(it => it.product_name.toLowerCase().includes(prodSearch)));
        if (!hasMatch) return false;
      }

      // 7. Quantities
      if (filters.quantities && filters.quantities.length > 0) {
        const qty = o.total_quantity || 1;
        const matched = filters.quantities.some(q => {
          if (q === '1' && qty === 1) return true;
          if (q === '2' && qty === 2) return true;
          if (q === '3' && qty === 3) return true;
          if (q === '4' && qty === 4) return true;
          if (q === '5+' && qty >= 5) return true;
          return false;
        });
        if (!matched) return false;
      }

      // 8. Order Types
      if (filters.orderTypes && filters.orderTypes.length > 0) {
        const itemCount = o.items ? o.items.length : 1;
        const totalQty = o.total_quantity || 1;
        const matched = filters.orderTypes.some(ot => {
          if (ot === 'Single Product Order' && itemCount === 1) return true;
          if (ot === 'Multi Product Order' && itemCount > 1) return true;
          if (ot === 'Single Unit Order' && totalQty === 1) return true;
          if (ot === 'Multi Unit Order' && totalQty > 1) return true;
          if (ot === 'One Product, Multiple Quantity' && itemCount === 1 && totalQty > 1) return true;
          if (ot === 'Multiple Products, Multiple Quantity' && itemCount > 1 && totalQty > 1) return true;
          return false;
        });
        if (!matched) return false;
      }

      // 9. General Search Query
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchesId = o.order_id.toLowerCase().includes(q);
        const matchesName = o.customer_name.toLowerCase().includes(q);
        const matchesPhone = o.phone.toLowerCase().includes(q);
        const matchesProd = o.product_name.toLowerCase().includes(q);
        const matchesCity = o.city.toLowerCase().includes(q);
        if (!matchesId && !matchesName && !matchesPhone && !matchesProd && !matchesCity) {
          return false;
        }
      }

      return true;
    });
  }

  // Delete an upload batch and all associated records
  async deleteUploadBatch(batchId: string): Promise<boolean> {
    try {
      await supabase.from('website_order_uploads').delete().eq('id', batchId);
      await supabase.from('website_order_raw_rows').delete().eq('upload_batch_id', batchId);
      await supabase.from('website_orders').delete().eq('upload_batch_id', batchId);
    } catch (e) {
      console.warn('Supabase delete batch warning:', e);
    }

    const batches = this.getLocalList<WebsiteUploadBatch>(UPLOADS_KEY).filter(b => b.id !== batchId);
    this.setLocalList(UPLOADS_KEY, batches);

    const rawRows = this.getLocalList<WebsiteRawOrderRow>(RAW_ROWS_KEY).filter(r => r.upload_batch_id !== batchId);
    this.setLocalList(RAW_ROWS_KEY, rawRows);

    const orders = this.getLocalList<WebsiteConsolidatedOrder>(ORDERS_KEY).filter(o => o.upload_batch_id !== batchId);
    this.setLocalList(ORDERS_KEY, orders);

    return true;
  }
}

export const websiteSalesService = new WebsiteSalesService();
