import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import { shipmentAttemptService } from '../../services/shipmentAttemptService';
import { normalizeToLocalDateKey } from '../../utils/marketingUtils';

export interface DispatchPayload {
  influencer_id: string | number;
  campaign_id: string | number;
  creator_name: string;
  phone_number: string | null;
  alternative_phone_number: string | null;
  address: string | null;
  city?: string | null;
  state: string | null;
  pincode?: string | null;
  languages?: string | string[] | null;
  campaign_name: string | null;
  product_name: string | null;
  selected_products: any[];
  total_products: number;
  total_product_value: number | null;
  total_weight: string | null;
  product_photo_url: string | null;
  courier_partner: string | null;
  dispatch_photo_url: string | null;
  tracking_id: string | null;
  dispatch_date: string;
  expected_delivery_date: string | null;
  dispatch_status: string;
  influencer_code?: string | null;
  order_id?: string | null;
  is_re_dispatch?: boolean;
}

export interface DispatchResult {
  success: boolean;
  error?: string;
}

export const useDispatch = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `dispatch/${fileName}`;

      const { error } = await supabase.storage
        .from('influencer-profiles')
        .upload(filePath, file);

      if (error) throw error;

      const { data: publicData } = supabase.storage
        .from('influencer-profiles')
        .getPublicUrl(filePath);

      return publicData.publicUrl;
    } catch (err) {
      console.error('Error uploading dispatch photo:', err);
      throw err;
    }
  };

  const dispatchInfluencer = async (
    payload: DispatchPayload,
    productPhotoFile: File | null,
    dispatchPhotoFile: File | null
  ): Promise<DispatchResult> => {
    if (isSubmitting) {
      return { success: false, error: 'A dispatch operation is already in progress.' };
    }

    setIsSubmitting(true);
    setError(null);
    try {
      let product_photo_url = payload.product_photo_url;
      let dispatch_photo_url = payload.dispatch_photo_url;

      if (productPhotoFile) {
        product_photo_url = await uploadPhoto(productPhotoFile);
      }
      if (dispatchPhotoFile) {
        dispatch_photo_url = await uploadPhoto(dispatchPhotoFile);
      }

      const numericInfluencerId = Number(payload.influencer_id);
      const numericCampaignId = Number(payload.campaign_id);
      const isDispatchConfirmed = (payload.dispatch_status || 'Dispatched').toLowerCase() === 'dispatched';

      const normalizedDispatchDate = payload.dispatch_date 
        ? (normalizeToLocalDateKey(payload.dispatch_date) || payload.dispatch_date)
        : null;

      const normalizedExpectedDate = payload.expected_delivery_date 
        ? (normalizeToLocalDateKey(payload.expected_delivery_date) || payload.expected_delivery_date)
        : null;

      // Fields strictly belonging to influencer_dispatch_details_rows table
      // (order_id is NOT a column here; it belongs to shipment_attempts)
      const dispatchDbFields: Record<string, any> = {
        influencer_id: numericInfluencerId,
        campaign_id: numericCampaignId,
        creator_name: payload.creator_name,
        phone_number: payload.phone_number || null,
        alternative_phone_number: payload.alternative_phone_number || null,
        address: payload.address || null,
        state: payload.state || null,
        campaign_name: payload.campaign_name || null,
        product_name: payload.product_name || null,
        selected_products: payload.selected_products || [],
        total_products: Math.round(Number(payload.total_products) || 0),
        total_product_value: payload.total_product_value != null ? Math.round(Number(payload.total_product_value)) : null,
        total_weight: payload.total_weight || null,
        product_photo_url: product_photo_url || null,
        courier_partner: payload.courier_partner || null,
        dispatch_photo_url: dispatch_photo_url || null,
        tracking_id: payload.tracking_id || null,
        dispatch_date: normalizedDispatchDate,
        expected_delivery_date: normalizedExpectedDate,
        dispatch_status: payload.dispatch_status || 'Dispatched'
      };

      // When officially dispatching (or re-dispatching), clear historical issue remarks on the dispatch row
      if (isDispatchConfirmed || payload.is_re_dispatch) {
        dispatchDbFields.remarks = null;
      }

      // Check if dispatch record already exists for this influencer and campaign
      const { data: existingDispatch, error: checkError } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('id')
        .eq('influencer_id', numericInfluencerId)
        .eq('campaign_id', numericCampaignId)
        .maybeSingle();

      if (checkError) {
        console.error('Error querying existing dispatch record:', {
          code: checkError.code,
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint
        });
        throw checkError;
      }

      if (existingDispatch && existingDispatch.id) {
        // Update existing dispatch record
        const { error: updateError } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .update(dispatchDbFields)
          .eq('id', existingDispatch.id);

        if (updateError) {
          console.error('Error updating influencer_dispatch_details_rows:', {
            code: updateError.code,
            message: updateError.message,
            details: updateError.details,
            hint: updateError.hint
          });
          throw updateError;
        }
      } else {
        // Insert new record with manual incremented ID
        const { data: maxData, error: maxError } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .not('id', 'is', null)
          .order('id', { ascending: false })
          .limit(1);

        if (maxError) {
          console.warn('Error fetching max id for influencer_dispatch_details_rows:', maxError);
        }

        const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
        const nextId = isNaN(maxId) ? 1 : maxId + 1;

        const { error: insertError } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .insert([{
            ...dispatchDbFields,
            id: nextId,
            created_at: new Date().toISOString()
          }]);

        if (insertError) {
          console.error('Error inserting into influencer_dispatch_details_rows:', {
            code: insertError.code,
            message: insertError.message,
            details: insertError.details,
            hint: insertError.hint
          });
          throw insertError;
        }
      }

      // Canonical influencer info sync: address, city, state, pincode, phone, altPhone, languages
      const influencerUpdates: Record<string, any> = {};
      if (payload.address !== undefined) influencerUpdates.complete_address = payload.address;
      if (payload.city !== undefined) influencerUpdates.city = payload.city;
      if (payload.state !== undefined) influencerUpdates.state = payload.state;
      if (payload.pincode !== undefined) influencerUpdates.pincode = payload.pincode;
      if (payload.phone_number !== undefined) influencerUpdates.phone_number = payload.phone_number;
      if (payload.alternative_phone_number !== undefined) influencerUpdates.alternative_number = payload.alternative_phone_number;
      if (payload.languages !== undefined) {
        influencerUpdates.languages = Array.isArray(payload.languages)
          ? payload.languages
          : typeof payload.languages === 'string'
          ? payload.languages.split(',').map(s => s.trim()).filter(Boolean)
          : null;
      }

      if (Object.keys(influencerUpdates).length > 0) {
        const { error: infErr } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .update(influencerUpdates)
          .eq('id', numericInfluencerId);

        if (infErr) {
          console.warn('Warning updating influencers_info_rows:', infErr);
        }
      }

      // Synchronize with shipment_attempts table
      try {
        const existingAttempts = await shipmentAttemptService.getShipmentAttempts(numericCampaignId, numericInfluencerId);
        const prevAttempt = existingAttempts.length > 0 ? existingAttempts[existingAttempts.length - 1] : null;

        const isReDispatch = Boolean(
          payload.is_re_dispatch || 
          (prevAttempt && prevAttempt.issue_reported)
        );

        if (prevAttempt && isReDispatch) {
          // A product issue was previously reported -> Create a replacement attempt (Attempt N+1, RE_DISPATCH)
          await shipmentAttemptService.createReDispatchAttempt({
            campaign_id: numericCampaignId,
            influencer_id: numericInfluencerId,
            influencer_code: payload.influencer_code || '',
            courier: payload.courier_partner,
            awb_number: payload.tracking_id,
            order_id: payload.order_id,
            dispatch_date: normalizedDispatchDate,
            estimated_delivery_date: normalizedExpectedDate
          });
        } else if (!prevAttempt) {
          // Initial attempt
          await shipmentAttemptService.createInitialShipmentAttempt({
            campaign_id: numericCampaignId,
            influencer_id: numericInfluencerId,
            influencer_code: payload.influencer_code || '',
            courier: payload.courier_partner,
            awb_number: payload.tracking_id,
            order_id: payload.order_id,
            dispatch_date: normalizedDispatchDate,
            estimated_delivery_date: normalizedExpectedDate
          });
        } else {
          // Update the current attempt's details (courier, awb, dispatch date)
          await supabaseAdmin
            .from(SUPABASE_TABLES.shipmentAttempts)
            .update({
              courier: payload.courier_partner || prevAttempt.courier,
              awb_number: payload.tracking_id || prevAttempt.awb_number,
              order_id: payload.order_id || prevAttempt.order_id,
              dispatch_date: normalizedDispatchDate || prevAttempt.dispatch_date,
              estimated_delivery_date: normalizedExpectedDate || prevAttempt.estimated_delivery_date,
              shipment_status: payload.tracking_id ? 'In Transit' : 'Pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', prevAttempt.id);
        }

        shipmentAttemptService.notifyUpdates(numericCampaignId);
      } catch (attErr: any) {
        console.warn('Error syncing shipment attempt in useDispatch:', {
          code: attErr?.code,
          message: attErr?.message,
          details: attErr?.details,
          hint: attErr?.hint,
          raw: attErr
        });
      }

      // Non-blocking activity logging
      logActivity(
        'Logistics',
        'Order Dispatched',
        `Order for influencer "${payload.creator_name || 'Unknown'}" was dispatched with tracking ID ${payload.tracking_id || 'N/A'}.`
      );

      return { success: true };
    } catch (err: any) {
      console.error('Error dispatching influencer:', {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        raw: err
      });
      const errorObj = err instanceof Error ? err : new Error(err?.message || String(err));
      setError(errorObj);
      return { 
        success: false, 
        error: err?.message || 'Failed to save dispatch details. Please check and try again.' 
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    dispatchInfluencer,
    isSubmitting,
    error
  };
};

