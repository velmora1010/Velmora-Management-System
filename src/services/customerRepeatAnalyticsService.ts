import { supabase } from '../lib/supabase';
import { normalizeCourier } from '../config/courierConfig';

export interface CustomerRepeatKpis {
  totalOrders: number;
  grossOrderValue: number;
  cancelledOrders: number;
  refundedOrders: number;
  netSalesValue: number;
  totalUniqueCustomers: number;
  oneTimeBuyers: number;
  repeatBuyers: number; // 2+ orders
  repeatPercentage: number;
  customersWith3: number;
  customersWith3Plus: number;
  customersWith5: number;
  customersWith5Plus: number;
  customersWith10: number;
  customersWith10Plus: number;
  customersWith15: number;
  customersWith15Plus: number;
  totalRepeatRevenue: number;
  repeatAOV: number;
}

export interface FrequencyDistributionItem {
  bucket: string;
  bucketNum: number;
  customerCount: number;
  percentage: number;
  totalRevenue: number;
}

export interface RepeatTrendPoint {
  dateKey: string;
  displayDate: string;
  repeatOrders: number;
  repeatRevenue: number;
  firstTimeOrders: number;
  totalOrders: number;
}

export interface CustomerOrderHistoryEntry {
  orderId: string;
  orderDate: string;
}

export interface TopCustomerItem {
  rank: number;
  customerKey: string;
  customerName: string;
  phone: string;
  maskedPhone: string;
  city: string;
  state: string;
  totalOrders: number;
  repeatPurchaseCount: number;
  totalValue: number;
  averageOrderValue: number;
  mostPurchasedProduct: string;
  lastOrderDate: string;
  firstOrderDate: string;
  orderIds: string[];
  orderHistory: CustomerOrderHistoryEntry[];
}

export interface GeographicLocationItem {
  rank: number;
  name: string;
  state?: string;
  totalOrders: number;
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  salesValue: number;
}

export interface ProductRepeatInsightItem {
  productName: string;
  repeatCustomerCount: number;
  repeatQuantity: number;
  repeatSalesValue: number;
  averageUnitPrice: number;
}

export interface AnalyticsFilterParams {
  startDate?: string;
  endDate?: string;
  state?: string;
  city?: string;
  product?: string;
  frequencyRange?: 'all' | '1' | '2' | '3' | '5' | '10' | '15' | '2+' | '3+' | '5+';
  channel?: string;
  searchQuery?: string;
}

export interface ComprehensiveRepeatAnalyticsData {
  kpis: CustomerRepeatKpis;
  frequencyDistribution: FrequencyDistributionItem[];
  repeatTrends: RepeatTrendPoint[];
  allCustomers: TopCustomerItem[];
  allCustomersByValue: TopCustomerItem[];
  allRepeatCustomers: TopCustomerItem[];
  topCustomers: TopCustomerItem[];
  topCustomersByValue: TopCustomerItem[];
  topCustomersByRepeat: TopCustomerItem[];
  topStates: GeographicLocationItem[];
  topCities: GeographicLocationItem[];
  productInsights: ProductRepeatInsightItem[];
  availableStates: string[];
  availableCities: string[];
  availableProducts: string[];
  lastUpdated: string;
  dateRangeDisplay: string;
}

// Helper: Normalize 10-digit Indian Mobile Phone
export function normalizeCustomerPhone(raw?: string | null): string {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 11 && (digits.startsWith('0') || digits.startsWith('1'))) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('910')) return digits.slice(3);
  if (digits.length === 14 && digits.startsWith('0091')) return digits.slice(4);
  return '';
}

// Helper: Mask phone number (e.g., 9944561299 -> 99****1299)
export function maskCustomerPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone || 'Not Provided';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `${clean.slice(0, 2)}****${clean.slice(6)}`;
  }
  return `${phone.slice(0, 2)}****${phone.slice(-2)}`;
}

// Helper: Normalize State names
export function normalizeStateName(raw?: string | null): string {
  if (!raw || raw.trim() === '' || raw.toLowerCase() === 'unspecified' || raw.toLowerCase() === 'null') {
    return 'Unknown';
  }
  const s = raw.trim();
  const lower = s.toLowerCase();
  if (lower === 'tn' || lower.includes('tamil')) return 'Tamil Nadu';
  if (lower === 'kl' || lower.includes('kerala')) return 'Kerala';
  if (lower === 'ka' || lower.includes('karnat')) return 'Karnataka';
  if (lower === 'ts' || lower.includes('telang')) return 'Telangana';
  if (lower === 'ap' || lower.includes('andhra')) return 'Andhra Pradesh';
  if (lower === 'mh' || lower.includes('maharasht')) return 'Maharashtra';
  if (lower === 'dl' || lower.includes('delhi')) return 'Delhi';
  if (lower === 'wb' || lower.includes('bengal')) return 'West Bengal';
  if (lower === 'up' || lower.includes('uttar pradesh')) return 'Uttar Pradesh';
  if (lower === 'gj' || lower.includes('gujarat')) return 'Gujarat';
  if (lower === 'mp' || lower.includes('madhya pradesh')) return 'Madhya Pradesh';
  if (lower === 'rj' || lower.includes('rajasthan')) return 'Rajasthan';
  if (lower === 'hr' || lower.includes('haryana')) return 'Haryana';
  if (lower === 'pb' || lower.includes('punjab')) return 'Punjab';
  if (lower === 'br' || lower.includes('bihar')) return 'Bihar';
  if (lower === 'or' || lower.includes('odisha') || lower.includes('orissa')) return 'Odisha';
  if (lower === 'as' || lower.includes('assam')) return 'Assam';
  if (lower === 'ch' || lower.includes('chandigarh')) return 'Chandigarh';
  if (lower === 'ct' || lower.includes('chhattisgarh') || lower.includes('chhatisgarh')) return 'Chhattisgarh';
  if (lower === 'ga' || lower.includes('goa')) return 'Goa';
  if (lower === 'hp' || lower.includes('himachal')) return 'Himachal Pradesh';
  if (lower === 'jh' || lower.includes('jharkhand')) return 'Jharkhand';
  if (lower === 'ut' || lower.includes('uttarakhand')) return 'Uttarakhand';
  if (lower === 'py' || lower.includes('puducherry') || lower.includes('pondicherry')) return 'Puducherry';
  if (lower === 'jk' || lower.includes('jammu') || lower.includes('kashmir')) return 'Jammu and Kashmir';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Helper: Normalize City names
export function normalizeCityName(raw?: string | null): string {
  if (!raw || raw.trim() === '' || raw.toLowerCase() === 'unspecified' || raw.toLowerCase() === 'null') {
    return 'Unknown';
  }
  const clean = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  return clean.replace(/\b\w/g, c => c.toUpperCase());
}

class CustomerRepeatAnalyticsService {
  private cachedOrders: any[] | null = null;
  private cachedItemsMap: Map<string, any[]> | null = null;
  private lastFetchTime = 0;
  private ordersInFlight: Promise<any[]> | null = null;
  private itemsInFlight: Promise<Map<string, any[]>> | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Invalidates internal memory cache to force fresh pull
   */
  public clearCache(): void {
    this.cachedOrders = null;
    this.cachedItemsMap = null;
    this.ordersInFlight = null;
    this.itemsInFlight = null;
    this.lastFetchTime = 0;
  }

  /**
   * Fetch canonical sales orders from Supabase using high-efficiency pagination.
   * Maps orders immediately to compact scalar objects, discarding heavy extra_data
   * JSON payloads to reduce heap footprint by >85%.
   */
  private async fetchAllSalesOrders(): Promise<any[]> {
    const now = Date.now();
    if (this.cachedOrders && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedOrders;
    }
    if (this.ordersInFlight) {
      return this.ordersInFlight;
    }

    this.ordersInFlight = (async () => {
      try {
        const pageSize = 1000;
        let page = 0;
        const allOrders: any[] = [];

        while (true) {
          const { data, error } = await supabase
            .from('sales_orders')
            .select('id, order_id, customer_name, phone, state, city, pincode, order_total, order_date, order_status, channel, extra_data')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error || !data || data.length === 0) break;

          for (const o of data) {
            const extra = o.extra_data || {};
            const isCancelled = o.order_status === 'CANCELLED' ||
                                extra.cancellation?.status === 'CANCELLED' ||
                                extra.fulfillment_status === 'cancelled';
            const finStatus = (extra.financial_status || '').toLowerCase();
            const isRefunded = finStatus === 'refunded' || finStatus === 'voided';
            const email = (extra.email || o.email || '').toLowerCase().trim();
            const productNameFallback = extra.product_name || '';

            allOrders.push({
              id: o.id,
              order_id: o.order_id,
              customer_name: o.customer_name,
              phone: o.phone,
              email,
              state: o.state,
              city: o.city,
              pincode: o.pincode,
              order_total: Number(o.order_total) || 0,
              order_date: o.order_date,
              order_status: o.order_status,
              channel: o.channel,
              product_name: productNameFallback,
              isCancelled,
              isRefunded
            });
          }

          if (data.length < pageSize) break;
          page++;
        }

        this.cachedOrders = allOrders;
        this.lastFetchTime = Date.now();
        return allOrders;
      } finally {
        this.ordersInFlight = null;
      }
    })();

    return this.ordersInFlight;
  }

  /**
   * Fetch line items from sales_order_items for product-level analytics.
   * Deduplicates concurrent queries and retains only essential numeric & string attributes.
   */
  private async fetchOrderItems(): Promise<Map<string, any[]>> {
    const now = Date.now();
    if (this.cachedItemsMap && now - this.lastFetchTime < this.CACHE_TTL_MS) {
      return this.cachedItemsMap;
    }
    if (this.itemsInFlight) {
      return this.itemsInFlight;
    }

    this.itemsInFlight = (async () => {
      try {
        const pageSize = 1000;
        let page = 0;
        const itemsMap = new Map<string, any[]>();

        while (true) {
          const { data, error } = await supabase
            .from('sales_order_items')
            .select('sales_order_id, product_name, quantity, line_total, unit_price')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error || !data || data.length === 0) break;
          for (const it of data) {
            if (!it.sales_order_id) continue;
            if (!itemsMap.has(it.sales_order_id)) {
              itemsMap.set(it.sales_order_id, []);
            }
            itemsMap.get(it.sales_order_id)!.push({
              product_name: it.product_name,
              quantity: Number(it.quantity) || 1,
              line_total: Number(it.line_total) || 0,
              unit_price: Number(it.unit_price) || 0
            });
          }
          if (data.length < pageSize) break;
          page++;
        }

        this.cachedItemsMap = itemsMap;
        return itemsMap;
      } finally {
        this.itemsInFlight = null;
      }
    })();

    return this.itemsInFlight;
  }

  /**
   * Computes comprehensive customer repeat and geographic analytics with filters.
   */
  public async getRepeatAnalytics(
    filters: AnalyticsFilterParams = {}
  ): Promise<ComprehensiveRepeatAnalyticsData> {
    const [rawOrders, itemsMap] = await Promise.all([
      this.fetchAllSalesOrders(),
      this.fetchOrderItems()
    ]);

    // 1. Filter and identify distinct valid orders
    // Rules:
    // - Deduplicate raw orders first so duplicated imported rows are never double-counted
    // - Distinct order counted once by canonical order_id
    // - Exclude cancelled orders from valid purchase counts and net sales
    // - Exclude fully refunded / voided orders from net sales
    // - Apply date range, state, city, channel, and product filters
    let grossOrderValue = 0;
    let netSalesValue = 0;
    let cancelledOrders = 0;
    let refundedOrders = 0;

    const seenOrderIds = new Set<string>();
    const distinctRawOrders: any[] = [];
    for (const o of rawOrders) {
      const cleanId = String(o.order_id || '').trim().toLowerCase();
      if (!cleanId) continue;
      if (seenOrderIds.has(cleanId)) continue;
      seenOrderIds.add(cleanId);
      distinctRawOrders.push(o);
    }

    const distinctOrdersMap = new Map<string, any>();
    const allUniqueStates = new Set<string>();
    const allUniqueCities = new Set<string>();
    const allUniqueProducts = new Set<string>();

    // Collect available products across all items
    itemsMap.forEach(items => {
      items.forEach(it => {
        if (it.product_name) allUniqueProducts.add(it.product_name.trim());
      });
    });

    distinctRawOrders.forEach(o => {
      const cleanId = String(o.order_id || '').trim().toLowerCase();
      const normState = normalizeStateName(o.state);
      const normCity = normalizeCityName(o.city);
      if (normState && normState !== 'Unknown') allUniqueStates.add(normState);
      if (normCity && normCity !== 'Unknown') allUniqueCities.add(normCity);

      const isCancelled = o.isCancelled ?? false;
      const isRefunded = o.isRefunded ?? false;
      const orderAmount = Number(o.order_total) || 0;

      grossOrderValue += orderAmount;

      if (isCancelled) {
        cancelledOrders++;
        return;
      }

      if (isRefunded) {
        refundedOrders++;
        return;
      }

      // Date Range Filter
      const orderDate = o.order_date ? String(o.order_date).slice(0, 10) : '';
      if (filters.startDate && orderDate && orderDate < filters.startDate) return;
      if (filters.endDate && orderDate && orderDate > filters.endDate) return;

      // Channel Filter
      if (filters.channel && filters.channel !== 'ALL' && o.channel !== filters.channel) return;

      // State Filter
      if (filters.state && filters.state !== 'ALL' && normState !== filters.state) return;

      // City Filter
      if (filters.city && filters.city !== 'ALL' && normCity !== filters.city) return;

      // Product Filter: Check if order items include the requested product
      if (filters.product && filters.product !== 'ALL') {
        const orderItems = itemsMap.get(o.id) || [];
        const hasProd = orderItems.some(it => it.product_name?.trim() === filters.product) ||
                        (o.product_name && o.product_name.includes(filters.product));
        if (!hasProd) return;
      }

      if (!distinctOrdersMap.has(cleanId)) {
        distinctOrdersMap.set(cleanId, o);
        netSalesValue += orderAmount;
      }
    });

    const validOrders = Array.from(distinctOrdersMap.values());

    // 2. Group Valid Orders into Customers
    // Rules:
    // 1. Normalized 10-digit customer phone number, when available.
    // 2. Otherwise normalized email.
    // 3. Otherwise stable customer ID, if available.
    // 4. Otherwise individual unique order key (order_id) to NEVER merge distinct customers with missing contact info!
    const customerMap = new Map<string, {
      customerKey: string;
      name: string;
      phone: string;
      city: string;
      state: string;
      orders: any[];
    }>();

    validOrders.forEach(o => {
      const phone = normalizeCustomerPhone(o.phone);
      const email = (o.email || '').toLowerCase().trim();
      const cleanOrderId = String(o.order_id || '').trim().toLowerCase();
      
      let custKey = '';
      if (phone) {
        custKey = `phone_${phone}`;
      } else if (email) {
        custKey = `email_${email}`;
      } else if (o.customer_id) {
        custKey = `custid_${o.customer_id}`;
      } else {
        custKey = `order_${cleanOrderId || o.id}`;
      }

      const normCity = normalizeCityName(o.city);
      const normState = normalizeStateName(o.state);

      if (!customerMap.has(custKey)) {
        customerMap.set(custKey, {
          customerKey: custKey,
          name: o.customer_name || 'Customer',
          phone: phone,
          city: normCity,
          state: normState,
          orders: []
        });
      }

      customerMap.get(custKey)!.orders.push(o);
    });

    // 3. Filter by purchase frequency range if specified
    let targetCustomers = Array.from(customerMap.values());
    if (filters.frequencyRange && filters.frequencyRange !== 'all') {
      targetCustomers = targetCustomers.filter(c => {
        const count = c.orders.length;
        switch (filters.frequencyRange) {
          case '1': return count === 1;
          case '2': return count === 2;
          case '3': return count === 3;
          case '5': return count === 5;
          case '10': return count === 10;
          case '15': return count === 15;
          case '2+': return count >= 2;
          case '3+': return count >= 3;
          case '5+': return count >= 5;
          default: return true;
        }
      });
    }

    // 4. Compute KPIs & Precise Purchase Frequency Buckets
    const totalUniqueCustomers = targetCustomers.length;
    let oneTimeBuyers = 0;
    let repeatBuyers = 0;
    let totalRepeatRevenue = 0;
    let repeatOrdersCount = 0;

    let customersWith3 = 0;
    let customersWith3Plus = 0;
    let customersWith5 = 0;
    let customersWith5Plus = 0;
    let customersWith10 = 0;
    let customersWith10Plus = 0;
    let customersWith15 = 0;
    let customersWith15Plus = 0;

    const frequencyBuckets: Record<number, { count: number; revenue: number }> = {};
    for (let i = 1; i <= 15; i++) {
      frequencyBuckets[i] = { count: 0, revenue: 0 };
    }
    let bucket15PlusCount = 0;
    let bucket15PlusRevenue = 0;

    targetCustomers.forEach(c => {
      const orderCount = c.orders.length;
      const spend = c.orders.reduce((sum, ord) => sum + (Number(ord.order_total) || 0), 0);

      if (orderCount === 1) {
        oneTimeBuyers++;
        frequencyBuckets[1].count++;
        frequencyBuckets[1].revenue += spend;
      } else {
        repeatBuyers++;
        totalRepeatRevenue += spend;
        repeatOrdersCount += orderCount;

        if (orderCount <= 15) {
          frequencyBuckets[orderCount].count++;
          frequencyBuckets[orderCount].revenue += spend;
        } else {
          bucket15PlusCount++;
          bucket15PlusRevenue += spend;
        }

        if (orderCount === 3) customersWith3++;
        if (orderCount >= 3) customersWith3Plus++;
        if (orderCount === 5) customersWith5++;
        if (orderCount >= 5) customersWith5Plus++;
        if (orderCount === 10) customersWith10++;
        if (orderCount >= 10) customersWith10Plus++;
        if (orderCount === 15) customersWith15++;
        if (orderCount >= 15) customersWith15Plus++;
      }
    });

    const repeatPercentage = totalUniqueCustomers > 0 ? (repeatBuyers / totalUniqueCustomers) * 100 : 0;
    const repeatAOV = repeatOrdersCount > 0 ? totalRepeatRevenue / repeatOrdersCount : 0;

    const kpis: CustomerRepeatKpis = {
      totalOrders: validOrders.length,
      grossOrderValue,
      cancelledOrders,
      refundedOrders,
      netSalesValue,
      totalUniqueCustomers,
      oneTimeBuyers,
      repeatBuyers,
      repeatPercentage,
      customersWith3,
      customersWith3Plus,
      customersWith5,
      customersWith5Plus,
      customersWith10,
      customersWith10Plus,
      customersWith15,
      customersWith15Plus,
      totalRepeatRevenue,
      repeatAOV
    };

    // 5. Purchase Frequency Distribution (1 through 15, and 15+)
    const frequencyDistribution: FrequencyDistributionItem[] = [];
    for (let i = 1; i <= 15; i++) {
      frequencyDistribution.push({
        bucket: i === 1 ? '1 order' : `${i} orders`,
        bucketNum: i,
        customerCount: frequencyBuckets[i].count,
        percentage: totalUniqueCustomers > 0 ? (frequencyBuckets[i].count / totalUniqueCustomers) * 100 : 0,
        totalRevenue: frequencyBuckets[i].revenue
      });
    }
    frequencyDistribution.push({
      bucket: '15+ orders',
      bucketNum: 16,
      customerCount: bucket15PlusCount,
      percentage: totalUniqueCustomers > 0 ? (bucket15PlusCount / totalUniqueCustomers) * 100 : 0,
      totalRevenue: bucket15PlusRevenue
    });

    // 6. Repeat Purchase Trends Over Time (Chronological first-time vs repeat classification)
    // Rule: First order ever placed by each customer is their first-time order.
    // Subsequent orders placed after their first order are repeat orders.
    const trendMap = new Map<string, { repeatOrders: number; repeatRevenue: number; firstTimeOrders: number }>();
    
    targetCustomers.forEach(c => {
      // Sort customer orders chronologically
      const chronOrders = [...c.orders].sort((a, b) => String(a.order_date || '').localeCompare(String(b.order_date || '')));
      chronOrders.forEach((o, index) => {
        const d = o.order_date ? String(o.order_date).slice(0, 7) : 'Unknown';
        if (d === 'Unknown') return;
        if (!trendMap.has(d)) {
          trendMap.set(d, { repeatOrders: 0, repeatRevenue: 0, firstTimeOrders: 0 });
        }
        const entry = trendMap.get(d)!;
        const amt = Number(o.order_total) || 0;
        if (index === 0) {
          entry.firstTimeOrders++;
        } else {
          entry.repeatOrders++;
          entry.repeatRevenue += amt;
        }
      });
    });

    const repeatTrends: RepeatTrendPoint[] = Array.from(trendMap.entries())
      .filter(([k]) => k !== 'Unknown')
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, stats]) => {
        const [year, month] = dateKey.split('-');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const displayDate = month ? `${monthNames[parseInt(month, 10) - 1]} ${year}` : dateKey;
        return {
          dateKey,
          displayDate,
          repeatOrders: stats.repeatOrders,
          repeatRevenue: stats.repeatRevenue,
          firstTimeOrders: stats.firstTimeOrders,
          totalOrders: stats.repeatOrders + stats.firstTimeOrders
        };
      });

    // 7. Base customer profiles for ranking
    const allCustomerProfiles: TopCustomerItem[] = targetCustomers.map(c => {
      const sortedOrders = [...c.orders].sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
      const totalValue = sortedOrders.reduce((sum, ord) => sum + (Number(ord.order_total) || 0), 0);
      const totalOrders = sortedOrders.length;
      const aov = totalOrders > 0 ? totalValue / totalOrders : 0;
      const lastOrderDate = sortedOrders[0]?.order_date || 'N/A';
      const firstOrderDate = sortedOrders[sortedOrders.length - 1]?.order_date || 'N/A';

      // Find most purchased product across line items of this customer's orders
      const productCounts = new Map<string, number>();
      sortedOrders.forEach(ord => {
        const orderLineItems = itemsMap.get(ord.id) || [];
        if (orderLineItems.length > 0) {
          orderLineItems.forEach(it => {
            const p = (it.product_name || 'Standard Products').trim();
            productCounts.set(p, (productCounts.get(p) || 0) + (it.quantity || 1));
          });
        } else {
          const fallback = ord.product_name || 'Standard Products';
          productCounts.set(fallback, (productCounts.get(fallback) || 0) + (ord.total_quantity || 1));
        }
      });

      let mostPurchased = 'Standard Products';
      let maxQty = 0;
      productCounts.forEach((qty, name) => {
        if (qty > maxQty) {
          maxQty = qty;
          mostPurchased = name;
        }
      });

      return {
        rank: 0,
        customerKey: c.customerKey,
        customerName: c.name,
        phone: c.phone || 'Not Provided',
        maskedPhone: maskCustomerPhone(c.phone),
        city: c.city,
        state: c.state,
        totalOrders,
        repeatPurchaseCount: Math.max(0, totalOrders - 1),
        totalValue,
        averageOrderValue: Math.round(aov),
        mostPurchasedProduct: mostPurchased,
        lastOrderDate,
        firstOrderDate,
        orderIds: sortedOrders.map(o => o.order_id),
        orderHistory: sortedOrders.map(o => ({
          orderId: o.order_id,
          orderDate: o.order_date || ''
        }))
      };
    });

    // 7A. All Customers Ranked by Total Purchase Value (highest to lowest) + Top 100 slice
    const allCustomersByValue: TopCustomerItem[] = [...allCustomerProfiles]
      .sort((a, b) => {
        // Primary: totalValue desc
        if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
        // Secondary: totalOrders desc
        if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
        // Tertiary: lastOrderDate desc
        return (b.lastOrderDate || '').localeCompare(a.lastOrderDate || '');
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const topCustomersByValue: TopCustomerItem[] = allCustomersByValue.slice(0, 100);

    // 7B. All Repeat Customers (2+ distinct valid orders, highest to lowest) + Top 100 slice
    const repeatCustomerProfiles = allCustomerProfiles.filter(c => c.totalOrders >= 2);
    const allRepeatCustomers: TopCustomerItem[] = [...repeatCustomerProfiles]
      .sort((a, b) => {
        // Primary: totalOrders desc
        if (b.totalOrders !== a.totalOrders) return b.totalOrders - a.totalOrders;
        // Secondary: totalValue desc
        if (b.totalValue !== a.totalValue) return b.totalValue - a.totalValue;
        // Tertiary: lastOrderDate desc
        return (b.lastOrderDate || '').localeCompare(a.lastOrderDate || '');
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const topCustomersByRepeat: TopCustomerItem[] = allRepeatCustomers.slice(0, 100);

    const topCustomers = topCustomersByValue; // alias for backwards compatibility

    // 8. Geographic Analytics: Top 100 States & Cities
    const stateAgg = new Map<string, { totalOrders: number; customers: Set<string>; repeatCustomers: Set<string>; salesValue: number }>();
    const cityAgg = new Map<string, { city: string; state: string; totalOrders: number; customers: Set<string>; repeatCustomers: Set<string>; salesValue: number }>();

    validOrders.forEach(o => {
      const st = normalizeStateName(o.state);
      const ct = normalizeCityName(o.city);
      const amt = Number(o.order_total) || 0;
      const phone = normalizeCustomerPhone(o.phone);
      const custKey = phone ? `phone_${phone}` : `cust_${(o.customer_name || 'unknown').trim().toLowerCase()}_${(o.city || '').trim().toLowerCase()}`;
      const cust = customerMap.get(custKey);
      const isRepeat = cust && cust.orders.length >= 2;

      // State Aggregation
      if (!stateAgg.has(st)) {
        stateAgg.set(st, { totalOrders: 0, customers: new Set(), repeatCustomers: new Set(), salesValue: 0 });
      }
      const sEntry = stateAgg.get(st)!;
      sEntry.totalOrders++;
      sEntry.customers.add(custKey);
      if (isRepeat) sEntry.repeatCustomers.add(custKey);
      sEntry.salesValue += amt;

      // City Aggregation (keyed by city + state to distinguish identical city names across states)
      const cityKey = `${ct}__${st}`;
      if (!cityAgg.has(cityKey)) {
        cityAgg.set(cityKey, { city: ct, state: st, totalOrders: 0, customers: new Set(), repeatCustomers: new Set(), salesValue: 0 });
      }
      const cEntry = cityAgg.get(cityKey)!;
      cEntry.totalOrders++;
      cEntry.customers.add(custKey);
      if (isRepeat) cEntry.repeatCustomers.add(custKey);
      cEntry.salesValue += amt;
    });

    const topStates: GeographicLocationItem[] = Array.from(stateAgg.entries())
      .map(([stName, data]) => {
        const uCust = data.customers.size;
        const rCust = data.repeatCustomers.size;
        return {
          rank: 0,
          name: stName,
          totalOrders: data.totalOrders,
          uniqueCustomers: uCust,
          repeatCustomers: rCust,
          repeatRate: uCust > 0 ? (rCust / uCust) * 100 : 0,
          salesValue: data.salesValue
        };
      })
      .sort((a, b) => b.salesValue - a.salesValue)
      .slice(0, 100)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const topCities: GeographicLocationItem[] = Array.from(cityAgg.values())
      .map(data => {
        const uCust = data.customers.size;
        const rCust = data.repeatCustomers.size;
        return {
          rank: 0,
          name: data.city,
          state: data.state,
          totalOrders: data.totalOrders,
          uniqueCustomers: uCust,
          repeatCustomers: rCust,
          repeatRate: uCust > 0 ? (rCust / uCust) * 100 : 0,
          salesValue: data.salesValue
        };
      })
      .sort((a, b) => b.salesValue - a.salesValue)
      .slice(0, 100)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    // 9. Product-Level Repeat Purchase Insights
    // Extract strictly from actual order line items belonging to repeat customer orders
    const repeatCustOrderIds = new Set<string>();
    const orderToCustKeyMap = new Map<string, string>();

    customerMap.forEach(c => {
      if (c.orders.length >= 2) {
        c.orders.forEach(o => {
          repeatCustOrderIds.add(o.id);
          orderToCustKeyMap.set(o.id, c.customerKey);
        });
      }
    });

    const productMap = new Map<string, { repeatQuantity: number; repeatSalesValue: number; buyersSet: Set<string> }>();

    repeatCustOrderIds.forEach(orderId => {
      const orderItems = itemsMap.get(orderId) || [];
      const cKey = orderToCustKeyMap.get(orderId) || 'unknown';

      if (orderItems.length > 0) {
        orderItems.forEach(it => {
          const p = (it.product_name || 'Standard Products').trim();
          if (!productMap.has(p)) {
            productMap.set(p, { repeatQuantity: 0, repeatSalesValue: 0, buyersSet: new Set() });
          }
          const pEntry = productMap.get(p)!;
          pEntry.repeatQuantity += Number(it.quantity) || 1;
          pEntry.repeatSalesValue += Number(it.line_total) || 0;
          pEntry.buyersSet.add(cKey);
        });
      }
    });

    const productInsights: ProductRepeatInsightItem[] = Array.from(productMap.entries())
      .map(([name, data]) => {
        const avgPrice = data.repeatQuantity > 0 ? data.repeatSalesValue / data.repeatQuantity : 0;
        return {
          productName: name,
          repeatCustomerCount: data.buyersSet.size,
          repeatQuantity: data.repeatQuantity,
          repeatSalesValue: data.repeatSalesValue,
          averageUnitPrice: Math.round(avgPrice)
        };
      })
      .sort((a, b) => b.repeatSalesValue - a.repeatSalesValue);

    // Format date range text
    const dateRangeDisplay = filters.startDate && filters.endDate
      ? `${filters.startDate} to ${filters.endDate}`
      : filters.startDate
      ? `Since ${filters.startDate}`
      : 'All Time (Full Canonical History)';

    return {
      kpis,
      frequencyDistribution,
      repeatTrends,
      allCustomers: allCustomerProfiles,
      allCustomersByValue,
      allRepeatCustomers,
      topCustomers,
      topCustomersByValue,
      topCustomersByRepeat,
      topStates,
      topCities,
      productInsights,
      availableStates: Array.from(allUniqueStates).sort(),
      availableCities: Array.from(allUniqueCities).sort(),
      availableProducts: Array.from(allUniqueProducts).sort(),
      lastUpdated: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dateRangeDisplay
    };
  }
}

export const customerRepeatAnalyticsService = new CustomerRepeatAnalyticsService();
