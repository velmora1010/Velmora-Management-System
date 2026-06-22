import { useState } from 'react';
import { supabase } from '../../lib/supabase';

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

      const finalPayload = {
        ...payload,
        product_photo_url,
        dispatch_photo_url,
        dispatch_status: 'Dispatched'
      };

      const { data: insertedDispatch, error: dispatchError } = await supabase
        .from('influencer_dispatch_details')
        .insert([finalPayload])
        .select()
        .single();

      if (dispatchError) throw dispatchError;

      const trackingPayload = {
        dispatch_id: insertedDispatch.id,
        influencer_id: insertedDispatch.influencer_id,
        campaign_id: insertedDispatch.campaign_id,
        current_step: 1,
        delivered_confirmed: false,
        pay_advance_completed: false,
        reference_video_received: false,
        expected_delivery_completed: false,
        draft_received: false,
        payment_remaining_completed: false,
        final_post_completed: false
      };

      const { error: trackingError } = await supabase
        .from('influencer_status_tracking')
        .insert([trackingPayload]);

      if (trackingError) {
        console.error('Error setting up status tracking:', trackingError);
        // We don't fail the dispatch if tracking fails, but we log it (as in legacy)
      }

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
