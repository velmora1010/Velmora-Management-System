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
  state: string | null;
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

      // Generate manual ID since the table has no auto-increment sequence
      const { data: maxData } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .select('id')
        .not('id', 'is', null)
        .order('id', { ascending: false })
        .limit(1);

      const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
      const nextId = isNaN(maxId) ? 1 : maxId + 1;

      const finalPayload = {
        ...payload,
        id: nextId,
        product_photo_url,
        dispatch_photo_url,
        dispatch_status: 'Dispatched',
        created_at: new Date().toISOString()
      };

      const { influencer_code, ...dbPayload } = finalPayload;

      const { error: dispatchError } = await supabase
        .from(SUPABASE_TABLES.influencerDispatch)
        .insert([dbPayload]);

      if (dispatchError) throw dispatchError;

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
