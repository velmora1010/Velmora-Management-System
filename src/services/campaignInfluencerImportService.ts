import { supabase } from '../lib/supabase';
import { SUPABASE_TABLES } from '../config/supabaseTables';

export interface CampaignInfluencerImportRecord {
  id?: string;
  campaign_id: number | string;
  file_name: string;
  file_type?: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  new_influencers: number;
  updated_influencers: number;
  archived_influencers: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string | null;
  uploaded_by?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

export interface CampaignInfluencerImportRowAudit {
  influencer_code: string;
  influencer_name: string;
  row_number: number;
  action: 'new' | 'updated' | 'unchanged' | 'archived' | 'invalid';
  status: string;
  error_message?: string | null;
}

export const campaignInfluencerImportService = {
  /**
   * Initializes an import log entry in campaign_influencer_imports
   */
  async createImport(params: {
    campaignId: number | string;
    fileName: string;
    fileType?: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
  }): Promise<string | null> {
    try {
      let uploadedBy: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) uploadedBy = user.id;
      } catch (authErr) {
        // Auth session might not be present in all environments
      }

      const numericCampaignId = Number(params.campaignId);

      const payload = {
        campaign_id: isNaN(numericCampaignId) ? params.campaignId : numericCampaignId,
        file_name: params.fileName,
        file_type: params.fileType || null,
        total_rows: params.totalRows,
        valid_rows: params.validRows,
        invalid_rows: params.invalidRows,
        status: 'processing',
        uploaded_by: uploadedBy,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from(SUPABASE_TABLES.campaignInfluencerImports)
        .insert([payload])
        .select('id')
        .single();

      if (error) {
        console.warn('Could not insert to campaign_influencer_imports:', error.message || error);
        return null;
      }

      return data?.id || null;
    } catch (err) {
      console.warn('campaignInfluencerImportService.createImport exception:', err);
      return null;
    }
  },

  /**
   * Bulk writes audit rows into campaign_influencer_import_rows in chunks
   */
  async recordAuditRows(
    importId: string | null,
    campaignId: number | string,
    rows: CampaignInfluencerImportRowAudit[]
  ): Promise<void> {
    if (!importId || !rows || rows.length === 0) return;

    try {
      const numericCampaignId = Number(campaignId);
      const campIdVal = isNaN(numericCampaignId) ? campaignId : numericCampaignId;
      const chunkSize = 50;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map(r => ({
          import_id: importId,
          campaign_id: campIdVal,
          influencer_code: r.influencer_code || '',
          influencer_name: r.influencer_name || '',
          row_number: r.row_number,
          action: r.action,
          status: r.status,
          error_message: r.error_message || null,
          created_at: new Date().toISOString()
        }));

        const { error } = await supabase
          .from(SUPABASE_TABLES.campaignInfluencerImportRows)
          .insert(chunk);

        if (error) {
          console.warn('Failed recording chunk of import audit rows:', error.message || error);
          break; // Don't block whole import if audit table has an issue
        }
      }
    } catch (err) {
      console.warn('campaignInfluencerImportService.recordAuditRows exception:', err);
    }
  },

  /**
   * Marks import completed and records final counts
   */
  async completeImport(
    importId: string | null,
    counts: {
      newCount: number;
      updatedCount: number;
      archivedCount: number;
      totalRows: number;
      validRows: number;
      invalidRows: number;
    }
  ): Promise<void> {
    if (!importId) return;

    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.campaignInfluencerImports)
        .update({
          status: 'completed',
          new_influencers: counts.newCount,
          updated_influencers: counts.updatedCount,
          archived_influencers: counts.archivedCount,
          total_rows: counts.totalRows,
          valid_rows: counts.validRows,
          invalid_rows: counts.invalidRows,
          completed_at: new Date().toISOString()
        })
        .eq('id', importId);

      if (error) {
        console.warn('Failed updating import status to completed:', error.message || error);
      }
    } catch (err) {
      console.warn('campaignInfluencerImportService.completeImport exception:', err);
    }
  },

  /**
   * Marks import failed and logs error
   */
  async failImport(
    importId: string | null,
    errorMessage: string
  ): Promise<void> {
    if (!importId) return;

    try {
      const { error } = await supabase
        .from(SUPABASE_TABLES.campaignInfluencerImports)
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', importId);

      if (error) {
        console.warn('Failed updating import status to failed:', error.message || error);
      }
    } catch (err) {
      console.warn('campaignInfluencerImportService.failImport exception:', err);
    }
  }
};
