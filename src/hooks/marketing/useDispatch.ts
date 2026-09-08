import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';

export interface DispatchPayload {
  influencer_id: string;
  campaign_id: string;
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
  ): Promise<boolean> => {
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

      // Fields belonging to influencer_dispatch_details_rows table
      const dispatchDbFields = {
        influencer_id: payload.influencer_id,
        campaign_id: payload.campaign_id,
        creator_name: payload.creator_name,
        phone_number: payload.phone_number,
        alternative_phone_number: payload.alternative_phone_number,
        address: payload.address,
        state: payload.state,
        campaign_name: payload.campaign_name,
        product_name: payload.product_name,
        selected_products: payload.selected_products,
        total_products: payload.total_products,
        total_product_value: payload.total_product_value,
        total_weight: payload.total_weight,
        product_photo_url,
        courier_partner: payload.courier_partner,
        dispatch_photo_url,
        tracking_id: payload.tracking_id,
        dispatch_date: payload.dispatch_date,
        expected_delivery_date: payload.expected_delivery_date,
        dispatch_status: payload.dispatch_status || 'Dispatched'
      };

      // Check if dispatch record already exists for this influencer and campaign
      const { data: existingDispatch } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('id')
        .eq('influencer_id', payload.influencer_id)
        .eq('campaign_id', payload.campaign_id)
        .maybeSingle();

      if (existingDispatch && existingDispatch.id) {
        // Update existing dispatch record
        const { error: updateError } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .update(dispatchDbFields)
          .eq('id', existingDispatch.id);

        if (updateError) throw updateError;
      } else {
        // Insert new record with manual incremented ID
        const { data: maxData } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .select('id')
          .not('id', 'is', null)
          .order('id', { ascending: false })
          .limit(1);

        const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
        const nextId = isNaN(maxId) ? 1 : maxId + 1;

        const { error: insertError } = await supabase
          .from(SUPABASE_TABLES.influencerDispatch)
          .insert([{
            ...dispatchDbFields,
            id: nextId,
            created_at: new Date().toISOString()
          }]);

        if (insertError) throw insertError;
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
        await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .update(influencerUpdates)
          .eq('id', payload.influencer_id);
      }

      // Non-blocking activity logging
      logActivity(
        'Logistics',
        'Order Dispatched',
        `Order for influencer "${payload.creator_name || 'Unknown'}" was dispatched with tracking ID ${payload.tracking_id || 'N/A'}.`
      );

      return true;
    } catch (err: unknown) {
      console.error('Error dispatching influencer:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return false;
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

