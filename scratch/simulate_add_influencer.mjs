import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

global.WebSocket = WebSocket;

const supabaseUrl = 'https://utusdosvijjuxtowzhta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dXNkb3N2aWpqdXh0b3d6aHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODQxOTIsImV4cCI6MjA5NzY2MDE5Mn0.o-1z11_1KgsosTre_gOzR2InF9MjXg6spKibo0Rv5oM';
const supabase = createClient(supabaseUrl, supabaseKey);

const SUPABASE_TABLES = {
  taskItems: "Task_item_rows",
  tasks: "Task_row",
  vendorCategories: "Vendor_Category",
  vendors: "Vendors_row",
  comboBoxes: "combo_boxes",
  creditImports: "credit_imports",
  creditRules: "credit_rules",
  creditsRow: "credits_row",
  expenses: "expenses_row",
  financeBills: "finance_bills_rows",
  financeCategories: "finance_categories_rows",
  influencerBargainHistory: "influencer_bargain_history_rows",
  influencerBrandPerformance: "influencer_brand_performance_rows",
  influencerCreate: "influencer_create_rows",
  influencerDispatch: "influencer_dispatch_details_rows",
  influencerPlatform: "influencer_platforms_details_rows",
  influencerPricing: "influencer_pricing_rows",
  influencerProduct: "influencer_products_rows",
  influencerStatus: "influencer_status_tracking_rows",
  influencersInfo: "influencers_info_rows",
  mainTasks: "main_tasks_rows",
  productBarcodes: "product_barcodes",
  productionBatches: "production_batches",
  purchaseOrderProducts: "purchase_order_products_rows",
  purchaseOrders: "purchase_orders_rows",
  qcBarcodes: "qc_barcodes",
  rawMaterialBarcodes: "raw_material_barcodes",
};

async function loadInfluencers(campaignId) {
  try {
    console.log('Loading influencers...');
    const { data: infData, error: infError } = await supabase
      .from(SUPABASE_TABLES.influencersInfo)
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (infError) throw infError;

    const infoList = infData || [];
    const influencerIds = infoList.map(inf => inf.id);

    if (influencerIds.length > 0) {
      console.log('Fetching related tables for influencer ids:', influencerIds);
      const [
        { data: platformsData },
        { data: pricingData },
        { data: productsData },
        { data: performanceData },
        { data: dispatchData }
      ] = await Promise.all([
        supabase.from(SUPABASE_TABLES.influencerPlatform).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerPricing).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerProduct).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerBrandPerformance).select('*').in('influencer_id', influencerIds),
        supabase.from(SUPABASE_TABLES.influencerDispatch).select('*').in('influencer_id', influencerIds).eq('campaign_id', campaignId)
      ]);

      let bargainData = [];
      if (pricingData && pricingData.length > 0) {
        const pricingIds = pricingData.map(p => p.id);
        const { data: bData } = await supabase.from(SUPABASE_TABLES.influencerBargainHistory).select('*').in('pricing_id', pricingIds);
        bargainData = bData || [];
      }

      const combinedData = infoList.map(inf => {
        const platforms = (platformsData || []).filter(p => p.influencer_id === inf.id);
        const pricing = (pricingData || []).find(p => p.influencer_id === inf.id) || {};
        const bargainHistory = bargainData.filter(b => b.pricing_id === pricing.id);
        const products = (productsData || []).filter(p => p.influencer_id === inf.id);
        const brandPerformance = (performanceData || []).filter(p => p.influencer_id === inf.id);
        const dispatchDetails = (dispatchData || []).find(d => d.influencer_id === inf.id);

        return {
          ...inf,
          platforms,
          pricing: { ...pricing, bargainHistory },
          products,
          performance: brandPerformance,
          brandPerformance,
          dispatchDetails
        };
      });
      console.log('Loaded combined data length:', combinedData.length);
    } else {
      console.log('No influencers found.');
    }
  } catch (err) {
    console.error('loadInfluencers error:', err);
  }
}

async function run() {
  await loadInfluencers(9);
}

run();
