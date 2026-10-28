import { supabase } from '../../../lib/supabase';
import db from '../../../lib/db';
import type { 
  WebsiteUploadBatch, 
  WebsiteRawOrderRow, 
  WebsiteConsolidatedOrder, 
  WebsiteOrderItem,
  WebsiteSalesFilterState,
  PriceInterpretationMode,
  ColumnMapping,
  GetOrdersPaginatedParams,
  ShipmentStatusCounts,
  PaginatedOrdersResult,
  WebsiteFullOrderDetails,
  OrderCancellationData
} from './types';
import { 
  syncSalesUploadToLogistics,
  deleteLogisticsOrderByOrderId,
  deleteLogisticsOrdersByBatchId,
  cleanOrderId
} from '../../../services/unifiedLogisticsService';
import { 
  parseFileToRawRows, 
  detectColumnMapping, 
  consolidateRawRows,
  getTodayInBusinessTimezone,
  formatSalesDateShort,
  normalizeLocationKey,
  orderMatchesLocationFilter,
  resolveCanonicalLocation,
  normalizeOrderId,
  normalizeCustomerName,
  normalizePhoneDigits
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
    priceMode: PriceInterpretationMode = 'Order Total',
    customMapping?: ColumnMapping
  ): Promise<{ 
    batch: WebsiteUploadBatch; 
    consolidatedOrders: WebsiteConsolidatedOrder[];
    metrics: {
      sourceRowsProcessed: number;
      totalUniqueOrders: number;
      newOrdersCount: number;
      updatedOrdersCount: number;
      itemsCount: number;
      logisticsActiveCount: number;
      logisticsFulfilledCount: number;
      logisticsPendingCount: number;
      logisticsPreservedCount: number;
    };
  }> {
    const { headers, rows: rawJsonRows } = await parseFileToRawRows(file);
    const mapping = customMapping || detectColumnMapping(headers);

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
    const metrics = await this.saveUploadRecords(batch, rawRowsProcessed, consolidatedOrders);

    // Automatically synchronize orders into Logistics Department (Dexie)
    const logisticsSync = await syncSalesUploadToLogistics(consolidatedOrders);

    batch.status = 'COMPLETED';
    return { 
      batch, 
      consolidatedOrders,
      metrics: {
        sourceRowsProcessed: rawJsonRows.length,
        totalUniqueOrders: consolidatedOrders.length,
        newOrdersCount: metrics.newOrdersCount,
        updatedOrdersCount: metrics.updatedOrdersCount,
        itemsCount: metrics.itemsCount,
        logisticsActiveCount: logisticsSync.activeCount,
        logisticsFulfilledCount: logisticsSync.fulfilledCount,
        logisticsPendingCount: logisticsSync.pendingCount,
        logisticsPreservedCount: logisticsSync.preservedWorkflowCount
      }
    };
  }

  // Transactional Save into Supabase sales_uploads, sales_raw_data, sales_orders, sales_order_items
  private async saveUploadRecords(
    batch: WebsiteUploadBatch,
    rawRows: WebsiteRawOrderRow[],
    consolidatedOrders: WebsiteConsolidatedOrder[]
  ): Promise<{ newOrdersCount: number; updatedOrdersCount: number; itemsCount: number }> {
    const uploadId = batch.id;
    const fileExt = batch.file_name.split('.').pop()?.toLowerCase() || 'csv';
    const minDate = batch.order_date || getTodayInBusinessTimezone();
    const maxDate = batch.order_date || minDate;

    // STEP 1: Insert sales_uploads (status = 'PROCESSING')
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
      // STEP 2: Insert raw spreadsheet rows into sales_raw_data
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

      // STEP 3: PRE-FETCH EXISTING ORDERS FROM `sales_orders` TO PRESERVE STABLE PRIMARY KEY UUIDs
      let newOrdersCount = 0;
      let updatedOrdersCount = 0;
      let itemsCount = 0;

      if (consolidatedOrders && consolidatedOrders.length > 0) {
        const orderIdsInUpload = consolidatedOrders.map(o => o.order_id);
        const existingOrdersMap = new Map<string, { id: string; order_id: string; order_status?: string; extra_data?: any }>();

        for (let i = 0; i < orderIdsInUpload.length; i += 500) {
          const chunkOrderIds = orderIdsInUpload.slice(i, i + 500);
          const { data: existingRows, error: fetchErr } = await supabase
            .from('sales_orders')
            .select('id, order_id, order_status, extra_data')
            .eq('channel', 'WEBSITE')
            .in('order_id', chunkOrderIds);

          if (!fetchErr && existingRows) {
            existingRows.forEach(row => {
              existingOrdersMap.set(row.order_id, row);
            });
          }
        }

        const orderIdToUuid = new Map<string, string>();
        const orderPayloads: any[] = [];

        consolidatedOrders.forEach(o => {
          const existingRecord = existingOrdersMap.get(o.order_id);
          if (existingRecord && (existingRecord.order_status === 'DELETED' || existingRecord.extra_data?.is_deleted)) {
            // STRICT TOMBSTONE: Do not resurrect deleted orders from stale CSV uploads!
            return;
          }

          let orderUuid: string;

          if (existingRecord) {
            // PRESERVE STABLE INTERNAL DATABASE PRIMARY KEY UUID
            orderUuid = existingRecord.id;
            updatedOrdersCount++;
          } else {
            // NEW ORDER GENERATES NEW STABLE UUID
            orderUuid = o.id || crypto.randomUUID();
            newOrdersCount++;
          }

          orderIdToUuid.set(o.order_id, orderUuid);

          const fStatus = (o.fulfillment_status || '').toLowerCase().trim();
          const isIncomingCancelled = o.order_status === 'CANCELLED' || Boolean(o.cancellation) || fStatus === 'cancelled';
          const isExistingCancelled = existingRecord?.order_status === 'CANCELLED' || Boolean(existingRecord?.extra_data?.cancellation);
          const isCancelled = isIncomingCancelled || isExistingCancelled;

          const isFulfilled = !isCancelled && (fStatus === 'fulfilled' || fStatus === 'shipped' || fStatus === 'delivered');

          let cancellationData = existingRecord?.extra_data?.cancellation || o.cancellation;
          if (isCancelled && !cancellationData) {
            cancellationData = {
              status: 'CANCELLED',
              reason: 'Source upload cancellation',
              cancelled_at: new Date().toISOString(),
              requested_at: new Date().toISOString(),
              requested_by: 'Source Upload',
              confirmed_at: new Date().toISOString(),
              confirmed_by: 'Source System',
              logistics_action: 'CONFIRMED',
              previous_fulfillment_status: fStatus && fStatus !== 'cancelled' ? fStatus : 'unfulfilled'
            };
          }

          const finalOrderStatus = isCancelled 
            ? 'CANCELLED' 
            : (isFulfilled ? 'FULFILLED' : 'CONFIRMED');

          const finalDispatchStatus = isCancelled
            ? 'CANCELLED'
            : (isFulfilled ? 'DELIVERED' : 'UNFULFILLED');

          orderPayloads.push({
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
            order_status: finalOrderStatus,
            dispatch_status: finalDispatchStatus,
            dispatch_date: isFulfilled ? (o.order_date || getTodayInBusinessTimezone()) : null,
            extra_data: {
              ...(existingRecord?.extra_data || {}),
              address: o.address || existingRecord?.extra_data?.address || '',
              order_formatted: o.order_formatted || existingRecord?.extra_data?.order_formatted || '',
              product_name: o.product_name || existingRecord?.extra_data?.product_name || '',
              original_order_date: o.original_order_date || existingRecord?.extra_data?.original_order_date || '',
              payment_classification_reason: o.payment_classification_reason || existingRecord?.extra_data?.payment_classification_reason || '',
              data_conflict: o.data_conflict || false,
              conflict_details: o.conflict_details || '',
              fulfillment_status: isCancelled ? 'cancelled' : (isFulfilled ? 'fulfilled' : (fStatus || 'unfulfilled')),
              financial_status: o.financial_status || existingRecord?.extra_data?.financial_status || '',
              awb_number: o.awb_number || existingRecord?.extra_data?.awb_number || '',
              courier: o.courier || existingRecord?.extra_data?.courier || '',
              fulfilled_date: o.fulfilled_date || (isFulfilled ? o.order_date : ''),
              ...(cancellationData ? { cancellation: cancellationData } : {})
            }
          });
        });

        // STEP 4: Upsert parent sales_orders without changing sales_orders.id
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

        // STEP 5: Prepare child line item payloads
        const itemPayloads: any[] = [];
        consolidatedOrders.forEach(o => {
          if (!orderIdToUuid.has(o.order_id)) {
            // Skipped deleted order
            return;
          }
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

        itemsCount = itemPayloads.length;

        // STEP 6: Safely synchronize child items (sales_order_items)
        if (itemPayloads.length > 0) {
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

      return {
        newOrdersCount,
        updatedOrdersCount,
        itemsCount
      };
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

  /**
   * Helper function to execute paginated/batched Supabase queries to bypass PostgREST 1000-row limit.
   */
  private async fetchAllPages<T>(
    buildQuery: (start: number, end: number) => any,
    pageSize = 1000
  ): Promise<T[]> {
    let allRows: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const rangeStart = page * pageSize;
      const rangeEnd = rangeStart + pageSize - 1;

      const query = buildQuery(rangeStart, rangeEnd);
      const { data, error } = await query;

      if (error) {
        console.error('[Supabase Error] Batched query execution failed:', error);
        throw new Error(error.message || 'Database fetch failed');
      }

      const rows = (data || []) as T[];
      allRows = allRows.concat(rows);

      if (rows.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allRows;
  }

  // STEP 9: Get Upload Batches from sales_uploads
  async getUploadBatches(): Promise<WebsiteUploadBatch[]> {
    await this.checkAndMigrateLocalStorage();

    const data = await this.fetchAllPages<any>((start, end) =>
      supabase
        .from('sales_uploads')
        .select('*')
        .eq('channel', 'WEBSITE')
        .order('uploaded_at', { ascending: false })
        .order('id', { ascending: true })
        .range(start, end)
    );

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

    const data = await this.fetchAllPages<any>((start, end) => {
      let query = supabase
        .from('sales_raw_data')
        .select('*')
        .order('row_number', { ascending: true })
        .order('id', { ascending: true });
      if (batchId) {
        query = query.eq('upload_id', batchId);
      }
      return query.range(start, end);
    });

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

    const orderRows = await this.fetchAllPages<any>((start, end) => {
      let query = supabase
        .from('sales_orders')
        .select('*')
        .eq('channel', 'WEBSITE')
        .neq('order_status', 'DELETED')
        .order('order_date', { ascending: false })
        .order('id', { ascending: true });

      if (filters?.batchId) {
        query = query.eq('upload_id', filters.batchId);
      }
      if (filters?.startDate && filters?.endDate) {
        query = query.gte('order_date', filters.startDate).lte('order_date', filters.endDate);
      } else if (filters?.selectedDate) {
        query = query.eq('order_date', filters.selectedDate);
      }

      return query.range(start, end);
    });

    if (!orderRows || orderRows.length === 0) return [];

    // Fetch matching sales_order_items for product details using chunked parent order IDs
    const salesOrderIds = orderRows.map(o => o.id);
    let itemRows: any[] = [];

    for (let i = 0; i < salesOrderIds.length; i += 300) {
      const chunkIds = salesOrderIds.slice(i, i + 300);
      const chunkItems = await this.fetchAllPages<any>((start, end) =>
        supabase
          .from('sales_order_items')
          .select('*')
          .in('sales_order_id', chunkIds)
          .order('id', { ascending: true })
          .range(start, end)
      );
      itemRows = itemRows.concat(chunkItems);
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

      const rawState = o.state || 'Unspecified';
      const rawCity = o.city || 'Unspecified';
      const rawPincode = o.pincode || '';
      const canonicalLoc = resolveCanonicalLocation(rawState, rawCity, rawPincode);

      return {
        id: o.id,
        order_id: o.order_id,
        customer_name: o.customer_name || 'N/A',
        address: extra.address || '',
        state: rawState,
        city: rawCity,
        pincode: rawPincode,
        canonicalState: canonicalLoc.stateName,
        canonicalStateKey: canonicalLoc.stateKey || normalizeLocationKey(canonicalLoc.stateName),
        canonicalCity: canonicalLoc.cityName,
        canonicalCityKey: canonicalLoc.cityKey || normalizeLocationKey(canonicalLoc.cityName),
        canonicalPincode: canonicalLoc.pincode || rawPincode,
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
        items,
        fulfillment_status: extra.fulfillment_status || o.dispatch_status || o.order_status || 'unfulfilled',
        financial_status: extra.financial_status || '',
        awb_number: extra.awb_number || o.awb_number || '',
        courier: extra.courier || o.courier || '',
        fulfilled_date: extra.fulfilled_date || o.dispatch_date || '',
        order_status: o.order_status,
        cancellation: extra.cancellation || (o.order_status === 'CANCELLED' ? {
          status: 'CANCELLED',
          reason: extra.cancellation_reason || 'Order cancelled',
          notes: extra.cancellation_notes,
          requested_by: extra.cancellation_requested_by || 'Sales Team',
          requested_at: extra.cancellation_requested_at || o.updated_at || o.created_at,
          confirmed_by: extra.cancellation_confirmed_by || 'Sales Team',
          confirmed_at: extra.cancellation_confirmed_at || o.updated_at || o.created_at,
          logistics_action: extra.logistics_action || 'CONFIRMED'
        } : undefined)
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

      if (filters.orderIdSearch && filters.orderIdSearch.trim()) {
        const targetId = normalizeOrderId(filters.orderIdSearch);
        const itemOrderId = normalizeOrderId(o.order_id);
        if (itemOrderId !== targetId) return false;
      }

      if (filters.customerNameSearch && filters.customerNameSearch.trim()) {
        const q = normalizeCustomerName(filters.customerNameSearch);
        const oName = normalizeCustomerName(o.customer_name);
        if (!oName.includes(q)) return false;
      }

      if (filters.phoneSearch && filters.phoneSearch.trim()) {
        const q = normalizePhoneDigits(filters.phoneSearch);
        const orderPhone = normalizePhoneDigits(o.phone);
        const rawPhoneDigits = String(o.phone || '').replace(/\D/g, '');
        if (q && !orderPhone.includes(q) && !rawPhoneDigits.includes(q)) return false;
      }

      if (filters.state || filters.city || (filters.states && filters.states.length > 0) || (filters.cities && filters.cities.length > 0) || (filters.pincodes && filters.pincodes.length > 0)) {
        const selectedStates = filters.states && filters.states.length > 0 ? filters.states : (filters.state ? [filters.state] : []);
        const selectedCities = filters.cities && filters.cities.length > 0 ? filters.cities : (filters.city ? [filters.city] : []);
        const selectedPincodes = filters.pincodes && filters.pincodes.length > 0 ? filters.pincodes : [];
        if (!orderMatchesLocationFilter(o, selectedStates, selectedCities, selectedPincodes)) return false;
      }
      if (filters.paymentMode && o.payment_mode !== filters.paymentMode) return false;
      if (filters.offer && o.offer !== filters.offer) return false;

      if (filters.batchIds && filters.batchIds.length > 0 && !filters.batchIds.includes(o.upload_batch_id)) return false;
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

  // Delete an upload batch and all associated records from Supabase and Logistics
  async deleteUploadBatch(batchId: string): Promise<boolean> {
    try {
      const orders = await this.fetchAllPages<{ id: string; order_id: string }>((start, end) =>
        supabase
          .from('sales_orders')
          .select('id, order_id')
          .eq('upload_id', batchId)
          .eq('channel', 'WEBSITE')
          .order('id', { ascending: true })
          .range(start, end)
      );

      const salesOrderIds = (orders || []).map(o => o.id);
      const rawOrderIds = (orders || []).map(o => cleanOrderId(o.order_id));

      if (salesOrderIds.length > 0) {
        for (let i = 0; i < salesOrderIds.length; i += 300) {
          await supabase.from('sales_order_items').delete().in('sales_order_id', salesOrderIds.slice(i, i + 300));
        }
      }

      await supabase.from('sales_orders').delete().eq('upload_id', batchId).eq('channel', 'WEBSITE');
      await supabase.from('sales_raw_data').delete().eq('upload_id', batchId);
      await supabase.from('sales_uploads').delete().eq('id', batchId);

      // Propagate batch deletion to Logistics Dexie
      await deleteLogisticsOrdersByBatchId(batchId, rawOrderIds);
    } catch (e: any) {
      console.error('[Supabase Error] Table: sales_uploads/orders, Op: DELETE, Message:', e.message);
      throw new Error(`Failed to delete upload batch: ${e.message}`);
    }

    return true;
  }

  // Fetch customer tracking shipments for operations analytics
  async getTrackingShipments(): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('customer_tracking_shipments')
        .select('*');
      if (error) {
        console.warn('Error fetching customer_tracking_shipments:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('customer_tracking_shipments query exception:', e);
      return [];
    }
  }

  // Permanently delete a single order from Sales and propagate deletion to Logistics
  async deleteSalesOrder(orderId: string): Promise<{
    success: boolean;
    orderId: string;
    wasDispatched: boolean;
    message?: string;
  }> {
    const cleanId = cleanOrderId(orderId);
    if (!cleanId) throw new Error('Invalid order ID provided for deletion');

    try {
      // 1. Fetch matching sales_orders row from Supabase
      const { data: orderRows, error: fetchErr } = await supabase
        .from('sales_orders')
        .select('id, order_id, dispatch_status, extra_data')
        .eq('channel', 'WEBSITE')
        .eq('order_id', cleanId);

      if (fetchErr) {
        console.error('[Supabase Error] Table: sales_orders, Op: SELECT, Message:', fetchErr.message);
        throw new Error(`Failed to locate order in database: ${fetchErr.message}`);
      }

      const existingOrder = orderRows && orderRows[0];
      let wasDispatched = false;

      if (existingOrder) {
        if (existingOrder.dispatch_status === 'DISPATCHED' || existingOrder.dispatch_status === 'DELIVERED') {
          wasDispatched = true;
        }

        // A. Delete child line items
        const { error: itemErr } = await supabase
          .from('sales_order_items')
          .delete()
          .eq('sales_order_id', existingOrder.id);

        if (itemErr) {
          console.error('[Supabase Error] Table: sales_order_items, Op: DELETE, Message:', itemErr.message);
          throw new Error(`Failed to delete order items: ${itemErr.message}`);
        }

        // B. Mark sales_orders as DELETED (tombstone)
        const currentExtra = existingOrder.extra_data || {};
        const { error: updateErr } = await supabase
          .from('sales_orders')
          .update({
            order_status: 'DELETED',
            dispatch_status: 'CANCELLED',
            extra_data: {
              ...currentExtra,
              is_deleted: true,
              deleted_at: new Date().toISOString(),
              tombstone: true
            }
          })
          .eq('id', existingOrder.id);

        if (updateErr) {
          console.error('[Supabase Error] Table: sales_orders, Op: UPDATE, Message:', updateErr.message);
          throw new Error(`Failed to update order status: ${updateErr.message}`);
        }

        // C. Clean up raw spreadsheet data
        await supabase
          .from('sales_raw_data')
          .delete()
          .eq('order_id', cleanId);
      }

      // 2. Propagate deletion to Logistics
      const logRes = await deleteLogisticsOrderByOrderId(cleanId, 'Deleted from Sales');
      if (logRes.wasDispatched) {
        wasDispatched = true;
      }

      return {
        success: true,
        orderId: cleanId,
        wasDispatched,
        message: `Order #${cleanId} deleted from Sales and Logistics.`
      };
    } catch (err: any) {
      console.error('[Delete Sales Order Failed]', err);
      throw err;
    }
  }

  // Get the most recent sales order date present in the database
  async getLatestSalesDate(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('order_date')
        .eq('channel', 'WEBSITE')
        .neq('order_status', 'DELETED')
        .order('order_date', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].order_date) {
        return data[0].order_date;
      }
    } catch (e) {
      console.warn('Failed to get latest sales date:', e);
    }
    return getTodayInBusinessTimezone();
  }

  // Get dynamic shipment status counts directly from database & logistics
  async getShipmentStatusCounts(): Promise<ShipmentStatusCounts> {
    try {
      const [totalRes, deliveredRes, dispatchedRes, unfulfilledRes, cancelledRes] = await Promise.all([
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('channel', 'WEBSITE').neq('order_status', 'DELETED').neq('order_status', 'CANCELLED'),
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('channel', 'WEBSITE').neq('order_status', 'DELETED').neq('order_status', 'CANCELLED').eq('dispatch_status', 'DELIVERED'),
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('channel', 'WEBSITE').neq('order_status', 'DELETED').neq('order_status', 'CANCELLED').eq('dispatch_status', 'DISPATCHED'),
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('channel', 'WEBSITE').neq('order_status', 'DELETED').neq('order_status', 'CANCELLED').eq('dispatch_status', 'UNFULFILLED'),
        supabase.from('sales_orders').select('*', { count: 'exact', head: true }).eq('channel', 'WEBSITE').eq('order_status', 'CANCELLED')
      ]);

      const all = totalRes.count ?? 0;
      let delivered = deliveredRes.count ?? 0;
      let inTransit = dispatchedRes.count ?? 0;
      let unfulfilled = unfulfilledRes.count ?? Math.max(0, all - delivered - inTransit);
      let cancelled = cancelledRes.count ?? 0;

      let pendingAwb = unfulfilled;
      let readyToShip = unfulfilled;
      let readyForPickup = 0;
      let rtoInTransit = 0;

      // Merge Dexie logistics_orders if available for live tracking stages
      try {
        const dexieOrders = await db.logistics_orders.toArray();
        if (dexieOrders && dexieOrders.length > 0) {
          let dPendingAwb = 0;
          let dReadyToShip = 0;
          let dReadyForPickup = 0;
          let dInTransit = 0;
          let dRto = 0;
          let dDelivered = 0;

          for (const o of dexieOrders) {
            if (o.stage === 'trash' || o.status === 'Deleted' || o.status === 'Cancelled') continue;
            const st = (o.status || '').toLowerCase();
            const hasAwb = !!(o.awbNumber && o.awbNumber.trim().length > 0);

            if (st.includes('delivered') || o.stage === 'fulfilled' || o.deliveredDate) {
              dDelivered++;
            } else if (st.includes('rto') || st.includes('return')) {
              dRto++;
            } else if (st.includes('transit') || st.includes('shipped') || o.stage === 'dispatched' || o.stage === 'tracking') {
              dInTransit++;
            } else if (st.includes('pickup')) {
              dReadyForPickup++;
            } else if (hasAwb || st.includes('ready to ship') || o.stage === 'prepare_dispatch') {
              dReadyToShip++;
            } else {
              dPendingAwb++;
              dReadyToShip++;
            }
          }

          if (dReadyForPickup > 0) readyForPickup = dReadyForPickup;
          if (dRto > 0) rtoInTransit = dRto;
          if (dInTransit > 0) inTransit = Math.max(inTransit, dInTransit);
          if (dPendingAwb > 0) pendingAwb = dPendingAwb;
          if (dReadyToShip > 0) readyToShip = dReadyToShip;
        }
      } catch (e) {
        // Fallback gracefully
      }

      return {
        all,
        pendingAwb,
        readyToShip,
        readyForPickup,
        inTransit,
        rtoInTransit,
        delivered,
        cancelled
      };
    } catch (err) {
      console.error('Failed to get shipment status counts:', err);
      return {
        all: 0,
        pendingAwb: 0,
        readyToShip: 0,
        readyForPickup: 0,
        inTransit: 0,
        rtoInTransit: 0,
        delivered: 0
      };
    }
  }

  // Fast server-side paginated, searchable, sortable orders query
  async getOrdersPaginated(params: GetOrdersPaginatedParams): Promise<PaginatedOrdersResult> {
    await this.checkAndMigrateLocalStorage();

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.max(1, Math.min(params.pageSize || 25, 100));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('sales_orders')
      .select('*', { count: 'exact' })
      .eq('channel', 'WEBSITE')
      .neq('order_status', 'DELETED');

    if (params.search && params.search.trim()) {
      const q = params.search.trim().replace(/^#/, '');
      query = query.or(`order_id.ilike.%${q}%,customer_name.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    // 1. General Date Range (Order Date)
    if (params.dateFrom && params.dateTo) {
      query = query.gte('order_date', params.dateFrom).lte('order_date', params.dateTo);
    } else if (params.dateFrom) {
      query = query.gte('order_date', params.dateFrom);
    } else if (params.dateTo) {
      query = query.lte('order_date', params.dateTo);
    }

    // 1b. Manifested Date (dispatch_date)
    if (params.manifestDateFrom && params.manifestDateTo) {
      query = query.gte('dispatch_date', params.manifestDateFrom).lte('dispatch_date', params.manifestDateTo);
    } else if (params.manifestDateFrom) {
      query = query.gte('dispatch_date', params.manifestDateFrom);
    } else if (params.manifestDateTo) {
      query = query.lte('dispatch_date', params.manifestDateTo);
    }

    // 1c. Delivered Date
    if (params.deliveredDateFrom && params.deliveredDateTo) {
      query = query.gte('dispatch_date', params.deliveredDateFrom).lte('dispatch_date', params.deliveredDateTo);
    } else if (params.deliveredDateFrom) {
      query = query.gte('dispatch_date', params.deliveredDateFrom);
    } else if (params.deliveredDateTo) {
      query = query.lte('dispatch_date', params.deliveredDateTo);
    }

    // 2. Payment Modes Filter (Prepaid, COD, Partial COD)
    const rawModes: string[] = [];
    if (params.paymentModes && params.paymentModes.length > 0) {
      rawModes.push(...params.paymentModes);
    } else if (params.paymentMode && params.paymentMode.toUpperCase() !== 'ALL') {
      rawModes.push(params.paymentMode);
    }

    if (rawModes.length > 0) {
      const selectedDbModes = new Set<string>();
      rawModes.forEach(m => {
        const norm = m.trim().toUpperCase();
        if (norm === 'PREPAID') {
          selectedDbModes.add('PREPAID');
        } else if (norm === 'PARTIAL COD' || norm === 'PARTIAL' || norm === 'PARTIAL_COD') {
          selectedDbModes.add('PARTIAL COD');
        } else if (norm === 'COD' || norm === 'FULL COD') {
          selectedDbModes.add('COD');
        }
      });

      const modesArr = Array.from(selectedDbModes);
      // If user selected a proper subset of the 3 payment modes, apply exact in() filter
      if (modesArr.length > 0 && modesArr.length < 3) {
        query = query.in('payment_mode', modesArr);
      }
    }

    // 2b. Fulfillment Status Filter (Fulfilled, Unfulfilled) - kept distinct from courier dispatch_status!
    const rawFulfillment: string[] = [];
    if (params.fulfillmentStatuses && params.fulfillmentStatuses.length > 0) {
      rawFulfillment.push(...params.fulfillmentStatuses);
    } else if (params.fulfillmentStatus && params.fulfillmentStatus.toUpperCase() !== 'ALL') {
      rawFulfillment.push(params.fulfillmentStatus);
    }

    if (rawFulfillment.length > 0) {
      const norms = rawFulfillment.map(f => f.trim().toUpperCase());
      const hasFulfilled = norms.includes('FULFILLED');
      const hasUnfulfilled = norms.includes('UNFULFILLED');

      if (hasFulfilled && !hasUnfulfilled) {
        query = query.eq('order_status', 'FULFILLED');
      } else if (hasUnfulfilled && !hasFulfilled) {
        query = query.neq('order_status', 'FULFILLED');
      }
    }

    // 3. Zones / States Filter
    if (params.zones && params.zones.length > 0) {
      const zoneStates: string[] = [];
      params.zones.forEach(z => {
        if (z === 'Zone A') zoneStates.push('Tamil Nadu');
        if (z === 'Zone B') zoneStates.push('Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana', 'Puducherry');
        if (z === 'Zone C') zoneStates.push('Maharashtra', 'Delhi', 'Gujarat', 'West Bengal');
        if (z === 'Zone D') zoneStates.push('Uttar Pradesh', 'Madhya Pradesh', 'Rajasthan', 'Punjab', 'Haryana', 'Bihar', 'Odisha');
        if (z === 'Zone E') zoneStates.push('Assam', 'Jammu', 'Kashmir', 'Manipur', 'Meghalaya', 'Tripura', 'Nagaland');
      });
      if (zoneStates.length > 0) {
        query = query.or(zoneStates.map(s => `state.ilike.%${s}%`).join(','));
      }
    } else if (params.state && params.state !== 'ALL') {
      query = query.ilike('state', `%${params.state}%`);
    }

    const ss = (params.shipmentStatus || '').trim().toLowerCase();
    const isCancelledSection = ss === 'cancelled orders' || ss === 'cancelled';

    if (isCancelledSection) {
      query = query.eq('order_status', 'CANCELLED');
    } else {
      query = query.neq('order_status', 'CANCELLED');
      if (ss && ss !== 'all shipments' && ss !== 'all') {
        if (ss === 'delivered') {
          query = query.eq('dispatch_status', 'DELIVERED');
        } else if (ss === 'pending awb') {
          query = query.eq('dispatch_status', 'UNFULFILLED');
        } else if (ss === 'ready to ship') {
          query = query.eq('dispatch_status', 'UNFULFILLED');
        } else if (ss === 'in transit') {
          query = query.eq('dispatch_status', 'DISPATCHED');
        } else if (ss === 'rto - in transit') {
          query = query.ilike('dispatch_status', '%RTO%');
        } else if (ss === 'ready for pickup') {
          query = query.ilike('dispatch_status', '%PICKUP%');
        }
      }
    }

    const sortBy = params.sortBy || 'order_date';
    const ascending = params.sortOrder === 'asc';

    query = query.order(sortBy, { ascending }).order('id', { ascending: true }).range(from, to);

    const { data: orderRows, count, error } = await query;

    if (error) {
      console.error('[Supabase Error] getOrdersPaginated failed:', error);
      throw new Error(error.message || 'Failed to fetch paginated orders');
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;

    if (!orderRows || orderRows.length === 0) {
      return {
        orders: [],
        totalCount,
        page,
        pageSize,
        totalPages
      };
    }

    // Fetch line items for this specific page of orders
    const salesOrderIds = orderRows.map(o => o.id);
    const { data: itemRows } = await supabase
      .from('sales_order_items')
      .select('*')
      .in('sales_order_id', salesOrderIds)
      .order('id', { ascending: true });

    const itemsByOrderId = new Map<string, WebsiteOrderItem[]>();
    (itemRows || []).forEach(it => {
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

    // Fetch upload batch file names for this page
    const uploadIds = Array.from(new Set(orderRows.map(o => o.upload_id).filter(Boolean)));
    const uploadMap = new Map<string, string>();
    if (uploadIds.length > 0) {
      const { data: uploadRows } = await supabase
        .from('sales_uploads')
        .select('id, file_name')
        .in('id', uploadIds);
      (uploadRows || []).forEach(u => uploadMap.set(u.id, u.file_name));
    }

    // Fetch Logistics records from Dexie for shipment status / AWB
    let logisticsMap = new Map<string, any>();
    try {
      const rawIds = orderRows.map(o => cleanOrderId(o.order_id));
      const dbRecs = await db.logistics_orders.where('orderId').anyOfIgnoreCase(rawIds).toArray();
      dbRecs.forEach(rec => {
        const cid = cleanOrderId(rec.orderId).toLowerCase();
        logisticsMap.set(cid, rec);
      });
    } catch (e) {
      // Dexie read fallback
    }

    const orders: WebsiteConsolidatedOrder[] = orderRows.map(o => {
      const extra = o.extra_data || {};
      const items = itemsByOrderId.get(o.id) || [];
      const logRec = logisticsMap.get(cleanOrderId(o.order_id).toLowerCase());

      const productNames = items.length > 0
        ? Array.from(new Set(items.map(it => it.product_name))).join(', ')
        : extra.product_name || 'N/A';

      const orderFormatted = items.length > 0
        ? items.map(it => `${it.product_name} × ${it.quantity}`).join(' | ')
        : extra.order_formatted || `${productNames} × ${o.total_quantity || 1}`;

      const rawState = o.state || 'Unspecified';
      const rawCity = o.city || 'Unspecified';
      const rawPincode = o.pincode || '';
      const canonicalLoc = resolveCanonicalLocation(rawState, rawCity, rawPincode);

      const awb = logRec?.awbNumber || extra.awb_number || o.awb_number || '';
      const courier = logRec?.courier || extra.courier || o.courier || '';
      const shipmentStatus = logRec?.status || logRec?.stage || (awb ? 'Dispatched' : (o.dispatch_status === 'DELIVERED' ? 'Delivered' : 'Pending Manifest'));

      return {
        id: o.id,
        order_id: o.order_id,
        customer_name: o.customer_name || 'N/A',
        address: extra.address || '',
        state: rawState,
        city: rawCity,
        pincode: rawPincode,
        canonicalState: canonicalLoc.stateName,
        canonicalStateKey: canonicalLoc.stateKey || normalizeLocationKey(canonicalLoc.stateName),
        canonicalCity: canonicalLoc.cityName,
        canonicalCityKey: canonicalLoc.cityKey || normalizeLocationKey(canonicalLoc.cityName),
        canonicalPincode: canonicalLoc.pincode || rawPincode,
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
        batch_file_name: uploadMap.get(o.upload_id) || '',
        data_conflict: extra.data_conflict || false,
        conflict_details: extra.conflict_details || '',
        created_at: o.created_at,
        items,
        fulfillment_status: o.order_status === 'CANCELLED' || extra.cancellation?.status === 'CANCELLED'
          ? 'cancelled'
          : (extra.fulfillment_status || (o.dispatch_status === 'DELIVERED' ? 'fulfilled' : 'unfulfilled')),
        financial_status: extra.financial_status || (o.payment_mode === 'PREPAID' ? 'paid' : 'pending'),
        awb_number: awb,
        courier: courier,
        shipment_status: shipmentStatus,
        fulfilled_date: extra.fulfilled_date || o.dispatch_date || '',
        order_status: o.order_status,
        cancellation: extra.cancellation || (o.order_status === 'CANCELLED' ? {
          status: 'CANCELLED',
          reason: extra.cancellation_reason || 'Order cancelled',
          notes: extra.cancellation_notes,
          requested_by: extra.cancellation_requested_by || 'Sales Team',
          requested_at: extra.cancellation_requested_at || o.updated_at || o.created_at,
          confirmed_by: extra.cancellation_confirmed_by || 'Sales Team',
          confirmed_at: extra.cancellation_confirmed_at || o.updated_at || o.created_at,
          logistics_action: extra.logistics_action || 'CONFIRMED'
        } : undefined)
      };
    });

    return {
      orders,
      totalCount,
      page,
      pageSize,
      totalPages
    };
  }

  // Fetch complete details for a single order including raw rows, line items, and logistics
  async getFullOrderDetails(orderId: string): Promise<WebsiteFullOrderDetails> {
    const cleanId = cleanOrderId(orderId);

    // 1. Fetch sales_order
    const { data: orderRow, error: orderErr } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('channel', 'WEBSITE')
      .eq('order_id', cleanId)
      .single();

    if (orderErr || !orderRow) {
      throw new Error(`Order #${cleanId} not found in database: ${orderErr?.message || 'Not found'}`);
    }

    // 2. Fetch sales_order_items
    const { data: itemRows } = await supabase
      .from('sales_order_items')
      .select('*')
      .eq('sales_order_id', orderRow.id)
      .order('id', { ascending: true });

    // 3. Fetch sales_raw_data for deep metadata
    const { data: rawRows } = await supabase
      .from('sales_raw_data')
      .select('raw_data')
      .eq('order_id', cleanId);

    // 4. Fetch source upload batch
    let sourceFile: any = undefined;
    if (orderRow.upload_id) {
      const { data: uploadRow } = await supabase
        .from('sales_uploads')
        .select('id, file_name, uploaded_at')
        .eq('id', orderRow.upload_id)
        .single();
      if (uploadRow) sourceFile = uploadRow;
    }

    // 5. Fetch Dexie logistics order
    let logisticsData: any = {};
    try {
      const logRec = await db.logistics_orders.where('orderId').equals(cleanId).first();
      if (logRec) logisticsData = logRec;
    } catch (e) {}

    // Extract deep fields from rawRows
    const raw0 = rawRows && rawRows.length > 0 ? (rawRows[0].raw_data || {}) : {};
    const email = raw0.Email || raw0.email || '';
    const subtotal = Number(raw0.Subtotal || raw0.subtotal) || Number(orderRow.order_total) || 0;
    const shipping = Number(raw0.Shipping || raw0.shipping) || 0;
    const taxes = Number(raw0.Taxes || raw0.taxes) || 0;
    const discountAmount = Number(raw0['Discount Amount'] || raw0.discount_amount) || 0;
    const discountCode = raw0['Discount Code'] || raw0.discount_code || orderRow.offer || 'No Offer';
    const refundedAmount = Number(raw0['Refunded Amount'] || raw0.refunded_amount) || 0;
    const financialStatus = (raw0['Financial Status'] || orderRow.extra_data?.financial_status || (orderRow.payment_mode === 'PREPAID' ? 'paid' : 'pending')).toLowerCase();
    const isCancelledOrder = orderRow.order_status === 'CANCELLED' || Boolean(orderRow.extra_data?.cancellation);
    const fulfillmentStatus = isCancelledOrder
      ? 'cancelled'
      : (raw0['Fulfillment Status'] || orderRow.extra_data?.fulfillment_status || (orderRow.dispatch_status === 'DELIVERED' ? 'fulfilled' : 'unfulfilled')).toLowerCase();

    // Map items with SKU and unit prices
    const items = (itemRows && itemRows.length > 0) ? itemRows.map((it: any, i: number) => {
      const matchingRaw = (rawRows || [])[i]?.raw_data || {};
      return {
        id: it.id,
        product_name: it.product_name,
        sku: matchingRaw['Lineitem sku'] || it.product_code || '-',
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || (Number(matchingRaw['Lineitem price']) || 0),
        line_total: Number(it.line_total) || ((Number(it.unit_price) || 0) * (Number(it.quantity) || 1)),
        fulfillment_status: matchingRaw['Lineitem fulfillment status'] || fulfillmentStatus
      };
    }) : [{
      id: 'default-item',
      product_name: orderRow.extra_data?.product_name || 'Standard Products',
      sku: raw0['Lineitem sku'] || '-',
      quantity: Number(orderRow.total_quantity) || 1,
      unit_price: Number(orderRow.order_total) || 0,
      line_total: Number(orderRow.order_total) || 0,
      fulfillment_status: fulfillmentStatus
    }];

    // Construct addresses
    const shippingAddress = {
      name: raw0['Shipping Name'] || orderRow.customer_name || 'N/A',
      street: raw0['Shipping Street'] || raw0['Shipping Address1'] || orderRow.extra_data?.address || '-',
      city: raw0['Shipping City'] || orderRow.city || '-',
      state: raw0['Shipping Province Name'] || raw0['Shipping Province'] || orderRow.state || '-',
      pincode: String(raw0['Shipping Zip'] || orderRow.pincode || '-').replace(/^'/, ''),
      country: raw0['Shipping Country'] || 'India',
      phone: String(raw0['Shipping Phone'] || orderRow.phone || '')
    };

    const billingAddress = {
      name: raw0['Billing Name'] || orderRow.customer_name || 'N/A',
      street: raw0['Billing Street'] || raw0['Billing Address1'] || shippingAddress.street,
      city: raw0['Billing City'] || orderRow.city || shippingAddress.city,
      state: raw0['Billing Province Name'] || raw0['Billing Province'] || orderRow.state || shippingAddress.state,
      pincode: String(raw0['Billing Zip'] || orderRow.pincode || shippingAddress.pincode).replace(/^'/, ''),
      country: raw0['Billing Country'] || 'India',
      phone: String(raw0['Billing Phone'] || orderRow.phone || '')
    };

    // Tracking URL generator
    const awb = logisticsData.awbNumber || orderRow.extra_data?.awb_number || '';
    const courier = logisticsData.courier || orderRow.extra_data?.courier || '';
    let trackingUrl = '';
    if (awb) {
      if (courier.toLowerCase().includes('delhivery')) {
        trackingUrl = `https://www.delhivery.com/track/package/${awb}`;
      } else if (courier.toLowerCase().includes('bluedart')) {
        trackingUrl = `https://www.bluedart.com/tracking?handler=traking&trackFor=0&action=awb&awbNo=${awb}`;
      }
    }

    // Timeline events
    const timeline: any[] = [];
    if (raw0['Created at'] || orderRow.created_at) {
      timeline.push({
        title: 'Order Placed by Customer',
        timestamp: raw0['Created at'] || orderRow.created_at,
        description: `Customer placed order #${cleanId} via Website (${orderRow.payment_mode})`,
        type: 'order'
      });
    }
    if (raw0['Paid at']) {
      timeline.push({
        title: 'Payment Confirmed',
        timestamp: raw0['Paid at'],
        description: `Full payment received via ${orderRow.source_payment_method}`,
        type: 'payment'
      });
    }
    if (sourceFile?.uploaded_at) {
      timeline.push({
        title: 'Imported to Velmora Sales System',
        timestamp: sourceFile.uploaded_at,
        description: `File batch: ${sourceFile.file_name}`,
        type: 'system'
      });
    }
    if (logisticsData.manifestedDate || logisticsData.dispatchDate) {
      timeline.push({
        title: 'Handed Over to Courier',
        timestamp: logisticsData.manifestedDate || logisticsData.dispatchDate,
        description: `Courier: ${courier || 'Assigned Courier'}, AWB: ${awb}`,
        type: 'fulfillment'
      });
    }
    if (logisticsData.deliveredDate) {
      timeline.push({
        title: 'Delivered to Customer',
        timestamp: logisticsData.deliveredDate,
        description: 'Shipment marked delivered in Logistics',
        type: 'fulfillment'
      });
    }

    return {
      order: {
        id: orderRow.id,
        order_id: cleanId,
        customer_name: orderRow.customer_name,
        address: shippingAddress.street,
        state: orderRow.state,
        city: orderRow.city,
        pincode: orderRow.pincode,
        order_formatted: orderRow.extra_data?.order_formatted || items.map(it => `${it.product_name} × ${it.quantity}`).join(' | '),
        product_name: items.map(it => it.product_name).join(', '),
        total_quantity: Number(orderRow.total_quantity) || 1,
        offer: orderRow.offer || 'No Offer',
        price: Number(orderRow.order_total) || 0,
        phone: orderRow.phone,
        payment_mode: orderRow.payment_mode,
        source_payment_mode: orderRow.source_payment_method,
        source_payment_method: orderRow.source_payment_method,
        advance_paid: Number(orderRow.advance_paid) || 0,
        remaining_payable: Number(orderRow.remaining_cod) || 0,
        payment_classification_reason: orderRow.extra_data?.payment_classification_reason || '',
        order_date: orderRow.order_date,
        original_order_date: orderRow.extra_data?.original_order_date || orderRow.order_date,
        upload_batch_id: orderRow.upload_id,
        batch_file_name: sourceFile?.file_name || '',
        created_at: orderRow.created_at,
        items,
        fulfillment_status: fulfillmentStatus,
        financial_status: financialStatus,
        awb_number: awb,
        courier: courier,
        fulfilled_date: orderRow.extra_data?.fulfilled_date || orderRow.dispatch_date || '',
        email,
        subtotal,
        shipping_charges: shipping,
        taxes,
        discount_amount: discountAmount,
        refund_amount: refundedAmount,
        shipment_status: logisticsData.status || (awb ? 'In Transit' : 'Unfulfilled'),
        tracking_url: trackingUrl
      },
      rawRows: rawRows ? rawRows.map(r => r.raw_data) : [],
      email,
      billingAddress,
      shippingAddress,
      items,
      financials: {
        subtotal,
        discount_amount: discountAmount,
        discount_code: discountCode,
        shipping_charges: shipping,
        taxes,
        total: Number(orderRow.order_total) || 0,
        advance_paid: Number(orderRow.advance_paid) || 0,
        remaining_cod: Number(orderRow.remaining_cod) || 0,
        refunded_amount: refundedAmount,
        payment_method: orderRow.source_payment_method || orderRow.payment_mode,
        financial_status: financialStatus
      },
      logistics: {
        stage: logisticsData.stage,
        status: logisticsData.status || (awb ? 'In Transit' : 'Unfulfilled'),
        courier,
        awb_number: awb,
        tracking_url: trackingUrl,
        manifested_date: logisticsData.manifestedDate,
        dispatched_date: logisticsData.dispatchDate,
        delivered_date: logisticsData.deliveredDate,
        tracking_history: logisticsData.trackingHistory || []
      },
      sourceFile,
      timeline
    };
  }

  // ==========================================
  // ORDER CANCELLATION WORKFLOW METHODS
  // ==========================================

  // 1. Request or Confirm Cancellation (from Website Sales)
  async cancelOrder(params: {
    orderId: string;
    reason: string;
    notes?: string;
    requestedBy?: string;
  }): Promise<{ success: boolean; mode: 'DIRECT_CANCELLED' | 'REQUESTED_LOGISTICS'; message: string }> {
    await this.checkAndMigrateLocalStorage();
    const cleanId = cleanOrderId(params.orderId);
    const requestedBy = params.requestedBy || 'Sales Team';
    const now = new Date().toISOString();

    if (!params.reason || !params.reason.trim()) {
      throw new Error('A cancellation reason is required');
    }

    // Fetch existing order from Supabase
    const { data: orderRow, error: fetchErr } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('channel', 'WEBSITE')
      .or(`order_id.eq.${cleanId},order_id.eq.#${cleanId}`)
      .neq('order_status', 'DELETED')
      .single();

    if (fetchErr || !orderRow) {
      throw new Error(`Order #${cleanId} not found in database`);
    }

    if (orderRow.order_status === 'CANCELLED') {
      throw new Error(`Order #${cleanId} is already cancelled`);
    }

    const extra = orderRow.extra_data || {};
    if (extra.cancellation && extra.cancellation.status === 'PENDING_LOGISTICS_APPROVAL') {
      throw new Error(`Order #${cleanId} already has an active pending cancellation request awaiting Logistics review`);
    }

    // Check courier & logistics status from Dexie and Supabase
    let dexieOrder: any = null;
    try {
      dexieOrder = await db.logistics_orders.where('orderId').equalsIgnoreCase(cleanId).first();
    } catch (e) {
      // dexie fallback
    }

    const hasAwb = Boolean(orderRow.awb_number || extra.awb_number || dexieOrder?.awbNumber);
    const isDelivered = orderRow.dispatch_status === 'DELIVERED' || dexieOrder?.status?.toLowerCase().includes('deliv');
    const isDispatched = hasAwb || orderRow.dispatch_status === 'DISPATCHED' || dexieOrder?.stage === 'dispatched' || dexieOrder?.stage === 'tracking';

    if (isDelivered) {
      throw new Error(`Cannot cancel order #${cleanId} because it is already Delivered. Standard cancellation is prevented. Please direct customer to Returns & Refunds.`);
    }

    if (isDispatched) {
      // Dispatched / In Transit / Manifested: Submit request for Logistics to review
      const cancellationData: OrderCancellationData = {
        status: 'PENDING_LOGISTICS_APPROVAL',
        reason: params.reason,
        notes: params.notes,
        requested_by: requestedBy,
        requested_at: now,
        logistics_action: 'PENDING_REVIEW',
        previous_fulfillment_status: extra.fulfillment_status || orderRow.order_status || 'unfulfilled',
        previous_shipment_status: dexieOrder?.status || (hasAwb ? 'Dispatched' : 'Pending Manifest'),
        audit_trail: [
          ...(extra.cancellation?.audit_trail || []),
          {
            action: 'CANCELLATION_REQUESTED',
            actor: requestedBy,
            timestamp: now,
            reason: params.reason,
            notes: params.notes
          }
        ]
      };

      const updatedExtra = {
        ...extra,
        cancellation: cancellationData
      };

      const { error: updateErr } = await supabase
        .from('sales_orders')
        .update({
          extra_data: updatedExtra,
          updated_at: now
        })
        .eq('id', orderRow.id);

      if (updateErr) {
        throw new Error(`Failed to submit cancellation request: ${updateErr.message}`);
      }

      // Update Dexie logistics_orders
      if (dexieOrder) {
        await db.logistics_orders.update(dexieOrder.id!, {
          cancellationStatus: 'Requested',
          cancellationReason: params.reason,
          cancellationNotes: params.notes,
          cancellationRequestedAt: now,
          cancellationRequestedBy: requestedBy,
          remarks: `Cancellation Requested: ${params.reason}`
        });
      }

      window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', { detail: { orderId: cleanId } }));
      window.dispatchEvent(new CustomEvent('velmora:logistics_order_updated', { detail: { orderId: cleanId } }));

      return {
        success: true,
        mode: 'REQUESTED_LOGISTICS',
        message: `Cancellation requested for Order #${cleanId}. Submitted to Logistics for shipment review.`
      };
    } else {
      // Un-dispatched / Not manifested: Direct cancellation
      const cancellationData: OrderCancellationData = {
        status: 'CANCELLED',
        reason: params.reason,
        notes: params.notes,
        requested_by: requestedBy,
        requested_at: now,
        confirmed_by: requestedBy,
        confirmed_at: now,
        logistics_action: 'CONFIRMED',
        logistics_notes: 'Direct pre-dispatch cancellation',
        previous_fulfillment_status: extra.fulfillment_status || orderRow.order_status || 'unfulfilled',
        previous_shipment_status: dexieOrder?.status || 'Pending Manifest',
        audit_trail: [
          ...(extra.cancellation?.audit_trail || []),
          {
            action: 'DIRECT_CANCELLATION_CONFIRMED',
            actor: requestedBy,
            timestamp: now,
            reason: params.reason,
            notes: params.notes
          }
        ]
      };

      const updatedExtra = {
        ...extra,
        cancellation: cancellationData,
        fulfillment_status: 'cancelled'
      };

      const { error: updateErr } = await supabase
        .from('sales_orders')
        .update({
          order_status: 'CANCELLED',
          dispatch_status: 'CANCELLED',
          extra_data: updatedExtra,
          updated_at: now
        })
        .eq('id', orderRow.id);

      if (updateErr) {
        throw new Error(`Failed to cancel order: ${updateErr.message}`);
      }

      // Update Dexie logistics_orders
      if (dexieOrder) {
        await db.logistics_orders.update(dexieOrder.id!, {
          status: 'Cancelled',
          stage: 'trash',
          cancellationStatus: 'Completed',
          remarks: `Order Cancelled: ${params.reason}`
        });
      }

      window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', { detail: { orderId: cleanId } }));
      window.dispatchEvent(new CustomEvent('velmora:logistics_order_updated', { detail: { orderId: cleanId } }));

      return {
        success: true,
        mode: 'DIRECT_CANCELLED',
        message: `Order #${cleanId} cancelled successfully`
      };
    }
  }

  // 2. Logistics Confirms Cancellation
  async confirmLogisticsCancellation(params: {
    orderId: string;
    confirmedBy?: string;
    logisticsNotes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const cleanId = cleanOrderId(params.orderId);
    const confirmedBy = params.confirmedBy || 'Logistics Team';
    const now = new Date().toISOString();

    const { data: orderRow, error: fetchErr } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('channel', 'WEBSITE')
      .or(`order_id.eq.${cleanId},order_id.eq.#${cleanId}`)
      .neq('order_status', 'DELETED')
      .single();

    if (fetchErr || !orderRow) {
      throw new Error(`Order #${cleanId} not found in database`);
    }

    const extra = orderRow.extra_data || {};
    const existingCanc = extra.cancellation || {};

    const updatedCancellation: OrderCancellationData = {
      ...existingCanc,
      status: 'CANCELLED',
      reason: existingCanc.reason || 'Logistics confirmed cancellation',
      requested_by: existingCanc.requested_by || 'Sales Team',
      requested_at: existingCanc.requested_at || now,
      confirmed_by: confirmedBy,
      confirmed_at: now,
      logistics_action: 'CONFIRMED',
      logistics_notes: params.logisticsNotes || 'Shipment intercepted and confirmed cancelled by Logistics',
      audit_trail: [
        ...(existingCanc.audit_trail || []),
        {
          action: 'LOGISTICS_CONFIRMED_CANCELLATION',
          actor: confirmedBy,
          timestamp: now,
          notes: params.logisticsNotes
        }
      ]
    };

    const updatedExtra = {
      ...extra,
      cancellation: updatedCancellation,
      fulfillment_status: 'cancelled'
    };

    const { error: updateErr } = await supabase
      .from('sales_orders')
      .update({
        order_status: 'CANCELLED',
        dispatch_status: 'CANCELLED',
        extra_data: updatedExtra,
        updated_at: now
      })
      .eq('id', orderRow.id);

    if (updateErr) {
      throw new Error(`Failed to confirm cancellation: ${updateErr.message}`);
    }

    // Update Dexie
    try {
      const dexieOrder = await db.logistics_orders.where('orderId').equalsIgnoreCase(cleanId).first();
      if (dexieOrder) {
        await db.logistics_orders.update(dexieOrder.id!, {
          status: 'Cancelled',
          stage: 'trash',
          cancellationStatus: 'Completed',
          remarks: `Logistics Confirmed Cancellation: ${params.logisticsNotes || ''}`
        });
      }
    } catch (e) {
      // Dexie update fallback
    }

    window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', { detail: { orderId: cleanId } }));
    window.dispatchEvent(new CustomEvent('velmora:logistics_order_updated', { detail: { orderId: cleanId } }));

    return {
      success: true,
      message: `Logistics confirmed cancellation for Order #${cleanId}`
    };
  }

  // 3. Logistics Rejects Cancellation
  async rejectLogisticsCancellation(params: {
    orderId: string;
    rejectedBy?: string;
    rejectionReason: string;
  }): Promise<{ success: boolean; message: string }> {
    if (!params.rejectionReason || !params.rejectionReason.trim()) {
      throw new Error('A rejection reason is required when rejecting cancellation');
    }

    const cleanId = cleanOrderId(params.orderId);
    const rejectedBy = params.rejectedBy || 'Logistics Team';
    const now = new Date().toISOString();

    const { data: orderRow, error: fetchErr } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('channel', 'WEBSITE')
      .or(`order_id.eq.${cleanId},order_id.eq.#${cleanId}`)
      .neq('order_status', 'DELETED')
      .single();

    if (fetchErr || !orderRow) {
      throw new Error(`Order #${cleanId} not found in database`);
    }

    const extra = orderRow.extra_data || {};
    const existingCanc = extra.cancellation || {};

    const updatedCancellation: OrderCancellationData = {
      ...existingCanc,
      status: 'REJECTED',
      logistics_action: 'REJECTED',
      logistics_notes: params.rejectionReason,
      audit_trail: [
        ...(existingCanc.audit_trail || []),
        {
          action: 'LOGISTICS_REJECTED_CANCELLATION',
          actor: rejectedBy,
          timestamp: now,
          reason: params.rejectionReason
        }
      ]
    };

    const updatedExtra = {
      ...extra,
      cancellation: updatedCancellation
    };

    const { error: updateErr } = await supabase
      .from('sales_orders')
      .update({
        extra_data: updatedExtra,
        updated_at: now
      })
      .eq('id', orderRow.id);

    if (updateErr) {
      throw new Error(`Failed to reject cancellation: ${updateErr.message}`);
    }

    // Update Dexie
    try {
      const dexieOrder = await db.logistics_orders.where('orderId').equalsIgnoreCase(cleanId).first();
      if (dexieOrder) {
        await db.logistics_orders.update(dexieOrder.id!, {
          cancellationStatus: 'Rejected',
          remarks: `Cancellation Rejected by Logistics: ${params.rejectionReason}`
        });
      }
    } catch (e) {
      // Dexie update fallback
    }

    window.dispatchEvent(new CustomEvent('velmora:website_sales_updated', { detail: { orderId: cleanId } }));
    window.dispatchEvent(new CustomEvent('velmora:logistics_order_updated', { detail: { orderId: cleanId } }));

    return {
      success: true,
      message: `Cancellation rejected for Order #${cleanId}. Order remains in active workflow.`
    };
  }

}

export const websiteSalesService = new WebsiteSalesService();
