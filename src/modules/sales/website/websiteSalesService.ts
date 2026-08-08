import { supabase } from '../../../lib/supabase';
import type { 
  WebsiteUploadBatch, 
  WebsiteRawOrderRow, 
  WebsiteConsolidatedOrder, 
  WebsiteOrderItem,
  WebsiteSalesFilterState,
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
  private isMigrated = false;

  constructor() {
    this.checkAndMigrateLocalStorage();
  }

  // One-time migration of existing localStorage data to Supabase 4-table structure
  async checkAndMigrateLocalStorage(): Promise<void> {
    if (this.isMigrated) return;
    this.isMigrated = true;

    try {
      // Check if sales_orders already has data in Supabase
      const { count, error } = await supabase
        .from('sales_orders')
        .select('id', { count: 'exact', head: true })
        .eq('channel', 'WEBSITE');

      if (!error && count && count > 0) {
        // Supabase already has data, clear stale local business data to prevent confusion
        localStorage.removeItem(UPLOADS_KEY);
        localStorage.removeItem(RAW_ROWS_KEY);
        localStorage.removeItem(ORDERS_KEY);
        return;
      }

      // Check if localStorage has historical Website Sales data to migrate
      const localBatchesStr = localStorage.getItem(UPLOADS_KEY);
      const localRawStr = localStorage.getItem(RAW_ROWS_KEY);
      const localOrdersStr = localStorage.getItem(ORDERS_KEY);

      if (!localBatchesStr && !localOrdersStr) return;

      const localBatches: WebsiteUploadBatch[] = localBatchesStr ? JSON.parse(localBatchesStr) : [];
      const localRaw: WebsiteRawOrderRow[] = localRawStr ? JSON.parse(localRawStr) : [];
      const localOrders: WebsiteConsolidatedOrder[] = localOrdersStr ? JSON.parse(localOrdersStr) : [];

      if (localBatches.length === 0 && localOrders.length === 0) return;

      console.log(`[Migration] Found ${localBatches.length} batches and ${localOrders.length} orders in localStorage. Migrating to Supabase...`);

      for (const batch of localBatches) {
        const batchRaw = localRaw.filter(r => r.upload_batch_id === batch.id);
        const batchOrders = localOrders.filter(o => o.upload_batch_id === batch.id);
        if (batchOrders.length > 0) {
          await this.saveUploadRecords(batch, batchRaw, batchOrders);
        }
      }

      // Clear localStorage keys after successful migration
      localStorage.removeItem(UPLOADS_KEY);
      localStorage.removeItem(RAW_ROWS_KEY);
      localStorage.removeItem(ORDERS_KEY);
      console.log('[Migration] Successfully migrated local Website Sales data to Supabase!');
    } catch (e) {
      console.warn('[Migration Warning] Error migrating local data to Supabase:', e);
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
      status: 'PROCESSING',
      column_mapping: mapping,
      order_date: mainOrderDate,
      order_date_range: dateRangeStr
    };

    // Save transactional records into public.sales_uploads, public.sales_raw_data, public.sales_orders, public.sales_order_items
    await this.saveUploadRecords(batch, rawRowsProcessed, consolidatedOrders);

    batch.status = 'COMPLETED';
    return { batch, consolidatedOrders };
  }

  // Transactional Save into Supabase sales_uploads, sales_raw_data, sales_orders, sales_order_items
  private async saveUploadRecords(
    batch: WebsiteUploadBatch,
    rawRows: WebsiteRawOrderRow[],
    consolidatedOrders: WebsiteConsolidatedOrder[]
  ): Promise<void> {
    const uploadId = batch.id;
    const fileExt = batch.file_name.split('.').pop()?.toLowerCase() || 'csv';
    const minDate = batch.order_date || getTodayInBusinessTimezone();
    const maxDate = batch.order_date || minDate;

    // STEP 3: Insert sales_uploads (status = 'PROCESSING')
    const uploadPayload = {
      id: uploadId,
      channel: 'WEBSITE',
      file_name: batch.file_name,
      file_type: fileExt,
      uploaded_at: batch.uploaded_at || new Date().toISOString(),
      uploaded_by: batch.uploaded_by || 'Current User',
      order_date_from: minDate,
      order_date_to: maxDate,
      source_rows: batch.total_source_rows || rawRows.length,
      unique_orders: batch.total_unique_orders || consolidatedOrders.length,
      duplicates_merged: batch.duplicate_order_count || 0,
      status: 'PROCESSING'
    };

    const { error: uploadErr } = await supabase
      .from('sales_uploads')
      .insert([uploadPayload]);

    if (uploadErr) {
      console.error('[Supabase Error] Table: sales_uploads, Op: INSERT, Code:', uploadErr.code, 'Message:', uploadErr.message, 'Details:', uploadErr.details);
      throw new Error(`Failed to insert upload record: ${uploadErr.message}`);
    }

    try {
      // STEP 4: Insert raw spreadsheet rows into sales_raw_data
      if (rawRows && rawRows.length > 0) {
        const rawPayloads = rawRows.map(r => ({
          upload_id: uploadId,
          row_number: r.row_number,
          order_id: r.order_id || null,
          raw_data: r.raw_data || r
        }));

        for (let i = 0; i < rawPayloads.length; i += 500) {
          const chunk = rawPayloads.slice(i, i + 500);
          const { error: rawErr } = await supabase.from('sales_raw_data').insert(chunk);
          if (rawErr) {
            console.error('[Supabase Error] Table: sales_raw_data, Op: INSERT, Code:', rawErr.code, 'Message:', rawErr.message, 'Details:', rawErr.details);
            throw new Error(`Failed to insert raw data: ${rawErr.message}`);
          }
        }
      }

      // STEP 5: Insert / Upsert consolidated orders into sales_orders
      if (consolidatedOrders && consolidatedOrders.length > 0) {
        const orderIdToUuid = new Map<string, string>();

        const orderPayloads = consolidatedOrders.map(o => {
          const orderUuid = o.id || crypto.randomUUID();
          orderIdToUuid.set(o.order_id, orderUuid);

          return {
            id: orderUuid,
            upload_id: uploadId,
            channel: 'WEBSITE',
            order_id: o.order_id,
            order_date: o.order_date || getTodayInBusinessTimezone(),
            customer_name: o.customer_name || 'N/A',
            phone: o.phone || '',
            state: o.state || 'Unspecified',
            city: o.city || 'Unspecified',
            pincode: o.pincode || '',
            offer: o.offer || 'No Offer',
            order_type: o.items && o.items.length > 1 ? 'Multi Product Order' : 'Single Product Order',
            total_quantity: o.total_quantity || 1,
            order_total: Number(o.price) || 0,
            payment_mode: o.payment_mode || 'UNKNOWN',
            source_payment_method: o.source_payment_method || o.source_payment_mode || 'Unknown',
            advance_paid: Number(o.advance_paid) || 0,
            remaining_cod: o.payment_mode === 'PREPAID' ? 0 : Number(o.remaining_payable ?? o.price),
            order_status: 'CONFIRMED',
            dispatch_status: 'DISPATCHED',
            dispatch_date: o.order_date || getTodayInBusinessTimezone(),
            extra_data: {
              address: o.address || '',
              order_formatted: o.order_formatted || '',
              product_name: o.product_name || '',
              original_order_date: o.original_order_date || '',
              payment_classification_reason: o.payment_classification_reason || '',
              data_conflict: o.data_conflict || false,
              conflict_details: o.conflict_details || ''
            }
          };
        });

        for (let i = 0; i < orderPayloads.length; i += 500) {
          const chunk = orderPayloads.slice(i, i + 500);
          const { error: orderErr } = await supabase
            .from('sales_orders')
            .upsert(chunk, { onConflict: 'channel,order_id' });

          if (orderErr) {
            console.error('[Supabase Error] Table: sales_orders, Op: UPSERT, Code:', orderErr.code, 'Message:', orderErr.message, 'Details:', orderErr.details);
            throw new Error(`Failed to upsert sales orders: ${orderErr.message}`);
          }
        }

        // STEP 6: Insert product lines into sales_order_items
        const itemPayloads: any[] = [];
        consolidatedOrders.forEach(o => {
          const salesOrderId = orderIdToUuid.get(o.order_id) || o.id;
          if (o.items && o.items.length > 0) {
            o.items.forEach(it => {
              const unitPrice = it.quantity > 0 ? Math.round((Number(o.price) || 0) / (o.total_quantity || 1)) : 0;
              itemPayloads.push({
                id: it.id || crypto.randomUUID(),
                sales_order_id: salesOrderId,
                product_code: it.product_code || it.product_name,
                product_name: it.product_name,
                quantity: it.quantity,
                unit_price: unitPrice,
                line_total: unitPrice * it.quantity,
                item_data: {}
              });
            });
          } else if (o.product_name) {
            itemPayloads.push({
              id: crypto.randomUUID(),
              sales_order_id: salesOrderId,
              product_code: o.product_name,
              product_name: o.product_name,
              quantity: o.total_quantity || 1,
              unit_price: Number(o.price) || 0,
              line_total: Number(o.price) || 0,
              item_data: {}
            });
          }
        });

        if (itemPayloads.length > 0) {
          // Remove existing items for these orders before inserting to avoid duplicates
          const salesOrderIds = Array.from(orderIdToUuid.values());
          for (let i = 0; i < salesOrderIds.length; i += 500) {
            const chunkIds = salesOrderIds.slice(i, i + 500);
            await supabase.from('sales_order_items').delete().in('sales_order_id', chunkIds);
          }

          for (let i = 0; i < itemPayloads.length; i += 500) {
            const chunk = itemPayloads.slice(i, i + 500);
            const { error: itemErr } = await supabase.from('sales_order_items').insert(chunk);
            if (itemErr) {
              console.error('[Supabase Error] Table: sales_order_items, Op: INSERT, Code:', itemErr.code, 'Message:', itemErr.message, 'Details:', itemErr.details);
              throw new Error(`Failed to insert sales order items: ${itemErr.message}`);
            }
          }
        }
      }

      // STEP 7: Update status = 'COMPLETED'
      const { error: completeErr } = await supabase
        .from('sales_uploads')
        .update({ status: 'COMPLETED' })
        .eq('id', uploadId);

      if (completeErr) {
        console.error('[Supabase Error] Table: sales_uploads, Op: UPDATE, Code:', completeErr.code, 'Message:', completeErr.message, 'Details:', completeErr.details);
      }

    } catch (err: any) {
      // Mark sales_uploads status as FAILED if processing crashed
      await supabase
        .from('sales_uploads')
        .update({ status: 'FAILED' })
        .eq('id', uploadId);

      console.error('[Supabase Transaction Failed]', err);
      throw err;
    }
  }

  // STEP 9: Get Upload Batches from sales_uploads
  async getUploadBatches(): Promise<WebsiteUploadBatch[]> {
    await this.checkAndMigrateLocalStorage();

    const { data, error } = await supabase
      .from('sales_uploads')
      .select('*')
      .eq('channel', 'WEBSITE')
      .order('uploaded_at', { ascending: false });

    if (error) {
      console.error('[Supabase Error] Table: sales_uploads, Op: SELECT, Code:', error.code, 'Message:', error.message);
      throw new Error(`Failed to fetch upload batches: ${error.message}`);
    }

    return (data || []).map(b => {
      const minDate = b.order_date_from || getTodayInBusinessTimezone();
      const maxDate = b.order_date_to || minDate;
      const dateRangeStr = minDate === maxDate
        ? formatSalesDateShort(minDate)
        : `${formatSalesDateShort(minDate)} – ${formatSalesDateShort(maxDate)}`;

      return {
        id: b.id,
        file_name: b.file_name,
        uploaded_by: b.uploaded_by || 'Unknown',
        uploaded_at: b.uploaded_at,
        total_source_rows: b.source_rows || 0,
        total_unique_orders: b.unique_orders || 0,
        valid_rows: b.source_rows || 0,
        invalid_rows: 0,
        duplicate_order_count: b.duplicates_merged || 0,
        price_interpretation: 'Order Total',
        status: b.status || 'COMPLETED',
        order_date: minDate,
        order_date_range: dateRangeStr
      };
    });
  }

  // STEP 10: Get Raw Order Rows from sales_raw_data
  async getRawOrderRows(batchId?: string): Promise<WebsiteRawOrderRow[]> {
    await this.checkAndMigrateLocalStorage();

    let query = supabase.from('sales_raw_data').select('*').order('row_number', { ascending: true });
    if (batchId) {
      query = query.eq('upload_id', batchId);
    }
    const { data, error } = await query;
    if (error) {
      console.error('[Supabase Error] Table: sales_raw_data, Op: SELECT, Code:', error.code, 'Message:', error.message);
      throw new Error(`Failed to fetch raw rows: ${error.message}`);
    }

    return (data || []).map(r => ({
      id: r.id,
      upload_batch_id: r.upload_id,
      row_number: r.row_number,
      raw_data: r.raw_data || {},
      order_id: r.order_id || r.raw_data?.['Order ID'] || r.raw_data?.['Order #'] || '',
      validation_status: 'VALID'
    }));
  }

  // STEP 11, 12, 13: Fetch Consolidated Orders & Items from sales_orders and sales_order_items
  async getConsolidatedOrders(filters?: WebsiteSalesFilterState & { batchId?: string; selectedDate?: string }): Promise<WebsiteConsolidatedOrder[]> {
    await this.checkAndMigrateLocalStorage();

    let query = supabase.from('sales_orders').select('*').eq('channel', 'WEBSITE').order('order_date', { ascending: false });

    if (filters?.batchId) {
      query = query.eq('upload_id', filters.batchId);
    }
    if (filters?.startDate && filters?.endDate) {
      query = query.gte('order_date', filters.startDate).lte('order_date', filters.endDate);
    } else if (filters?.selectedDate) {
      query = query.eq('order_date', filters.selectedDate);
    }

    const { data: orderRows, error: orderErr } = await query;
    if (orderErr) {
      console.error('[Supabase Error] Table: sales_orders, Op: SELECT, Code:', orderErr.code, 'Message:', orderErr.message);
      throw new Error(`Failed to fetch consolidated orders: ${orderErr.message}`);
    }

    if (!orderRows || orderRows.length === 0) return [];

    // Fetch matching sales_order_items for product details
    const salesOrderIds = orderRows.map(o => o.id);
    let itemRows: any[] = [];

    for (let i = 0; i < salesOrderIds.length; i += 500) {
      const chunkIds = salesOrderIds.slice(i, i + 500);
      const { data: itemsChunk, error: itemErr } = await supabase
        .from('sales_order_items')
        .select('*')
        .in('sales_order_id', chunkIds);

      if (itemErr) {
        console.error('[Supabase Error] Table: sales_order_items, Op: SELECT, Code:', itemErr.code, 'Message:', itemErr.message);
      } else if (itemsChunk) {
        itemRows = itemRows.concat(itemsChunk);
      }
    }

    // Group items by sales_order_id
    const itemsByOrderId = new Map<string, WebsiteOrderItem[]>();
    itemRows.forEach(it => {
      if (!itemsByOrderId.has(it.sales_order_id)) {
        itemsByOrderId.set(it.sales_order_id, []);
      }
      itemsByOrderId.get(it.sales_order_id)!.push({
        id: it.id,
        website_order_id: it.sales_order_id,
        product_name: it.product_name,
        product_code: it.product_code,
        quantity: Number(it.quantity) || 1,
        unit_price: it.unit_price != null ? Number(it.unit_price) : null,
        line_total: it.line_total != null ? Number(it.line_total) : null
      });
    });

    const orders: WebsiteConsolidatedOrder[] = orderRows.map(o => {
      const extra = o.extra_data || {};
      const items = itemsByOrderId.get(o.id) || [];

      const productNames = items.length > 0
        ? Array.from(new Set(items.map(it => it.product_name))).join(', ')
        : extra.product_name || 'N/A';

      const orderFormatted = items.length > 0
        ? items.map(it => `${it.product_name} × ${it.quantity}`).join(' | ')
        : extra.order_formatted || `${productNames} × ${o.total_quantity || 1}`;

      return {
        id: o.id,
        order_id: o.order_id,
        customer_name: o.customer_name || 'N/A',
        address: extra.address || '',
        state: o.state || 'Unspecified',
        city: o.city || 'Unspecified',
        pincode: o.pincode || '',
        order_formatted: orderFormatted,
        product_name: productNames,
        total_quantity: Number(o.total_quantity) || 1,
        offer: o.offer || 'No Offer',
        price: Number(o.order_total) || 0,
        phone: o.phone || '',
        payment_mode: o.payment_mode || 'UNKNOWN',
        source_payment_mode: o.source_payment_method || 'Unknown',
        source_payment_method: o.source_payment_method || 'Unknown',
        advance_paid: Number(o.advance_paid) || 0,
        remaining_payable: Number(o.remaining_cod) || 0,
        payment_classification_reason: extra.payment_classification_reason || '',
        order_date: o.order_date,
        original_order_date: extra.original_order_date || o.order_date,
        upload_batch_id: o.upload_id,
        data_conflict: extra.data_conflict || false,
        conflict_details: extra.conflict_details || '',
        created_at: o.created_at,
        items
      };
    });

    if (!filters) return orders;

    return orders.filter(o => {
      if (filters.batchId && o.upload_batch_id !== filters.batchId) return false;
      if (filters.startDate && filters.endDate) {
        if (!o.order_date || o.order_date < filters.startDate || o.order_date > filters.endDate) return false;
      } else if (filters.selectedDate && o.order_date !== filters.selectedDate) {
        return false;
      }

      if (filters.orderIdSearch) {
        const q = filters.orderIdSearch.toLowerCase().trim();
        if (!o.order_id.toLowerCase().includes(q)) return false;
      }

      if (filters.customerNameSearch) {
        const q = filters.customerNameSearch.toLowerCase().trim();
        if (!o.customer_name.toLowerCase().includes(q)) return false;
      }

      if (filters.phoneSearch) {
        const q = filters.phoneSearch.replace(/\D/g, '');
        const orderPhone = (o.phone || '').replace(/\D/g, '');
        if (q && !orderPhone.includes(q)) return false;
      }

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

  // Reprocess existing upload batch using preserved sales_raw_data
  async reprocessUploadBatch(batchId: string): Promise<WebsiteConsolidatedOrder[]> {
    const rawRows = await this.getRawOrderRows(batchId);
    if (rawRows.length === 0) return [];

    const rawObjects = rawRows.map(r => r.raw_data || r);
    const headers = Object.keys(rawObjects[0] || {});
    const mapping = detectColumnMapping(headers);

    const { consolidatedOrders, detectedOrderDates } = consolidateRawRows(rawObjects, mapping, 'Order Total', batchId);
    const mainOrderDate = detectedOrderDates.length > 0 ? detectedOrderDates[0] : getTodayInBusinessTimezone();
    const dateRangeStr = detectedOrderDates.length > 1
      ? `${formatSalesDateShort(detectedOrderDates[0])} – ${formatSalesDateShort(detectedOrderDates[detectedOrderDates.length - 1])}`
      : formatSalesDateShort(mainOrderDate);

    await supabase
      .from('sales_uploads')
      .update({
        order_date_from: mainOrderDate,
        order_date_to: detectedOrderDates.length > 1 ? detectedOrderDates[detectedOrderDates.length - 1] : mainOrderDate,
        unique_orders: consolidatedOrders.length
      })
      .eq('id', batchId);

    await this.saveUploadRecords(
      {
        id: batchId,
        file_name: 'reprocessed.csv',
        uploaded_by: 'System',
        uploaded_at: new Date().toISOString(),
        total_source_rows: rawRows.length,
        total_unique_orders: consolidatedOrders.length,
        valid_rows: rawRows.length,
        invalid_rows: 0,
        duplicate_order_count: 0,
        price_interpretation: 'Order Total',
        status: 'COMPLETED',
        order_date: mainOrderDate,
        order_date_range: dateRangeStr
      },
      [],
      consolidatedOrders
    );

    return consolidatedOrders;
  }

  // Delete an upload batch and all associated records from Supabase
  async deleteUploadBatch(batchId: string): Promise<boolean> {
    try {
      const { data: orders } = await supabase
        .from('sales_orders')
        .select('id')
        .eq('upload_id', batchId)
        .eq('channel', 'WEBSITE');

      if (orders && orders.length > 0) {
        const salesOrderIds = orders.map(o => o.id);
        for (let i = 0; i < salesOrderIds.length; i += 500) {
          await supabase.from('sales_order_items').delete().in('sales_order_id', salesOrderIds.slice(i, i + 500));
        }
      }

      await supabase.from('sales_orders').delete().eq('upload_id', batchId).eq('channel', 'WEBSITE');
      await supabase.from('sales_raw_data').delete().eq('upload_id', batchId);
      await supabase.from('sales_uploads').delete().eq('id', batchId);
    } catch (e: any) {
      console.error('[Supabase Error] Table: sales_uploads/orders, Op: DELETE, Message:', e.message);
      throw new Error(`Failed to delete upload batch: ${e.message}`);
    }

    return true;
  }
}

export const websiteSalesService = new WebsiteSalesService();
