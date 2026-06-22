import React, { useState } from 'react';
import type { Campaign } from '../../types';
import { useCampaignStatusTracking } from '../../hooks/marketing/useCampaignStatusTracking';
import type { StatusTrackingRecord } from '../../hooks/marketing/useCampaignStatusTracking';
import { MapPin, Phone, RefreshCcw, Clock, Package, Video, CreditCard, PenTool, CheckCircle, X, UploadCloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface CampaignStatusTrackingProps {
  campaign: Campaign;
  onBack: () => void;
}

export const CampaignStatusTracking: React.FC<CampaignStatusTrackingProps> = ({ campaign, onBack }) => {
  const { trackingRecords, isLoading, refresh, saveMilestone } = useCampaignStatusTracking(campaign.id);
  const [activeModal, setActiveModal] = useState<{ recordId: string, stageId: string } | null>(null);

  const toggleModal = (recordId: string, stageId: string) => {
    setActiveModal({ recordId, stageId });
  };

  const getWorkflowStages = (record: StatusTrackingRecord) => {
    const hasRework = record.draft_approval_status === 'Not Approved';
    
    let stages = [
      { id: 'delivered', label: 'Delivered', icon: Package, completed: record.delivered_confirmed, formKey: 'delivered' },
      { id: 'payAdvance', label: 'Pay Advance', icon: CreditCard, completed: record.pay_advance_completed, formKey: 'payAdvance' },
      { id: 'refVideos', label: 'Send Reference Videos', icon: Video, completed: record.reference_video_received, formKey: 'refVideos' },
      { id: 'expTimeline', label: 'Expected Delivery Timeline', icon: Clock, completed: record.expected_delivery_completed, formKey: 'expTimeline' },
      { id: 'draft', label: 'Draft', icon: PenTool, completed: record.draft_received, formKey: 'draft' }
    ];

    if (hasRework) {
      stages.push({ id: 'reExpTimeline', label: 'Re-Expected Delivery Timeline', icon: Clock, completed: !!record.re_draft_expected_date, formKey: 'reExpTimeline' });
      stages.push({ id: 'reDraft', label: 'Re-Draft', icon: PenTool, completed: !!record.re_draft_approval_status, formKey: 'reDraft' });
    }

    stages.push({ id: 'payRemaining', label: 'Pay Remaining Payment', icon: CreditCard, completed: record.payment_remaining_completed, formKey: 'payRemaining' });
    stages.push({ id: 'finalPost', label: 'Final Post Date', icon: CheckCircle, completed: record.final_post_completed, formKey: 'finalPost' });

    return stages;
  };

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[700px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50 gap-4">
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Clock size={20} className="text-emerald-400" />
          Status Tracking: {campaign.campaign_name}
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors" title="Refresh Data">
            <RefreshCcw size={16} />
          </button>
          <button onClick={onBack} className="px-4 py-2 border border-slate-600 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors text-sm">
            Back to Overview
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-900/50 scroll-smooth">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-slate-500">
            <RefreshCcw size={24} className="animate-spin mr-2" /> Loading tracking records...
          </div>
        ) : trackingRecords.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-slate-500 italic">
            <div className="text-4xl mb-4 opacity-50">🛤️</div>
            <h3 className="text-slate-300 text-lg mb-2 font-semibold">No active tracking records.</h3>
            <p className="text-sm">Dispatch an influencer first to begin status tracking.</p>
          </div>
        ) : (
          <div className="space-y-6" id="st-cards-container">
            {trackingRecords.map(record => {
              const dispatch = record.dispatch as any;
              const avatarUrl = dispatch.influencer_avatar;
              const dispatchId = dispatch.influencer_code || record.dispatch_id;
              
              const stages = getWorkflowStages(record);
              const currentStageIndex = record.current_step || 0;

              return (
                <div key={record.id} id={`st-card-${record.dispatch_id}`} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                  {/* Card Header (Profile & Basic Info) */}
                  <div className="bg-slate-800/80 p-4 border-b border-slate-700 grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                    
                    {/* Creator Identity */}
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full overflow-hidden shrink-0 border border-slate-600 bg-slate-900 flex items-center justify-center">
                         {avatarUrl ? (
                           <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                         ) : (
                           <span className="text-slate-500 font-bold text-lg">{dispatch.influencer_name?.charAt(0) || '?'}</span>
                         )}
                      </div>
                      <div>
                        <h3 className="text-slate-100 font-bold text-lg leading-tight">{dispatch.influencer_name}</h3>
                        <span className="text-slate-400 text-xs font-mono">ID: {dispatchId}</span>
                      </div>
                    </div>

                    {/* Creator Details */}
                    <div className="col-span-1 lg:col-span-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Phone size={14} className="text-slate-500" />
                        <span>{dispatch.phone_number || '-'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-300">
                        <MapPin size={14} className="text-slate-500" />
                        <span className="truncate">{dispatch.address || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal Timeline Workflow Section */}
                  <div className="p-6 overflow-hidden">
                    <h4 className="text-white font-bold text-lg mb-8">Workflow Progress</h4>
                    
                    <div className="w-full overflow-x-auto pb-12" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      <div className="flex items-center min-w-max mx-auto px-4 justify-center">
                        {stages.map((stage, idx) => {
                          const isCompleted = idx < currentStageIndex || stage.completed;

                          const circleClass = isCompleted 
                            ? "bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.6)]" 
                            : "bg-slate-700 text-slate-400";
                          
                          const lineClass = isCompleted ? "bg-emerald-500" : "bg-slate-700";
                          const textClass = isCompleted ? "text-emerald-500" : "text-slate-400";

                          return (
                            <React.Fragment key={stage.id}>
                              <div 
                                className="flex flex-col items-center relative cursor-pointer group" 
                                onClick={() => toggleModal(record.id, stage.id)}
                              >
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-300 ${circleClass} group-hover:ring-2 ring-white ring-offset-2 ring-offset-slate-800`}>
                                  {idx + 1}
                                </div>
                                <div className={`absolute top-14 text-center text-[11px] font-semibold w-28 leading-tight ${textClass}`}>
                                  {stage.label}
                                </div>
                              </div>
                              
                              {idx !== stages.length - 1 && (
                                <div className={`h-[2px] w-12 sm:w-16 mx-1 transition-colors duration-300 ${lineClass}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    {/* Active Modal Form Area */}
                    {activeModal?.recordId === record.id && (() => {
                      const activeStageIdx = stages.findIndex(s => s.id === activeModal.stageId);
                      if (activeStageIdx === -1) return null;
                      const activeStage = stages[activeStageIdx];
                      const isCompleted = activeStageIdx < currentStageIndex || activeStage.completed;

                      return (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in relative">
                            {/* Modal Header */}
                            <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-800/50">
                              <h5 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                <activeStage.icon size={24} className="text-emerald-400" /> {activeStage.label}
                              </h5>
                              <button 
                                onClick={() => setActiveModal(null)} 
                                className="text-slate-400 hover:text-slate-200 transition-colors p-1 bg-slate-800 rounded-lg border border-slate-600 hover:border-slate-500"
                              >
                                <X size={20} />
                              </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6">
                              <div className="w-full">
                                {activeStage.formKey === 'delivered' && (
                                  <DeliveredForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} />
                                )}
                                {activeStage.formKey === 'payAdvance' && (
                                  <PayAdvanceForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} />
                                )}
                                {activeStage.formKey === 'refVideos' && (
                                  <ReferenceVideosForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} />
                                )}
                                {activeStage.formKey === 'expTimeline' && (
                                  <ExpectedTimelineForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} isRework={false} />
                                )}
                                {activeStage.formKey === 'draft' && (
                                  <DraftForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} isRework={false} />
                                )}
                                {activeStage.formKey === 'reExpTimeline' && (
                                  <ExpectedTimelineForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} isRework={true} />
                                )}
                                {activeStage.formKey === 'reDraft' && (
                                  <DraftForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} isRework={true} />
                                )}
                                {activeStage.formKey === 'payRemaining' && (
                                  <PayRemainingForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} />
                                )}
                                {activeStage.formKey === 'finalPost' && (
                                  <FinalPostForm record={record} onSave={async (data: any) => { await saveMilestone(record.id, data); setActiveModal(null); }} />
                                )}
                              </div>
                            </div>
                            
                            {/* Modal Footer actions (Mark Complete handled inside sub-forms mostly, but we can add an overarching one if needed, though forms usually have Save buttons) */}
                            <div className="p-6 pt-0 flex justify-between items-center border-t border-slate-700 bg-slate-800/30 mt-4 h-16">
                              <span className="text-slate-400 text-sm">
                                {isCompleted ? 'Status: Completed' : 'Status: Pending'}
                              </span>
                              {!isCompleted && (
                                <button 
                                  onClick={async () => {
                                    const newStep = activeStageIdx + 1;
                                    await saveMilestone(record.id, { 
                                      current_step: newStep,
                                      [activeStage.formKey === 'delivered' ? 'delivered_confirmed' : 
                                       activeStage.formKey === 'payAdvance' ? 'pay_advance_completed' : 
                                       activeStage.formKey === 'refVideos' ? 'reference_video_received' : 
                                       activeStage.formKey === 'expTimeline' ? 'expected_delivery_completed' :
                                       activeStage.formKey === 'draft' ? 'draft_received' :
                                       activeStage.formKey === 'payRemaining' ? 'payment_remaining_completed' :
                                       activeStage.formKey === 'finalPost' ? 'final_post_completed' : 'updated_at'
                                      ]: true 
                                    });
                                    setActiveModal(null);
                                  }}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                                >
                                  Mark as Complete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Sub-Form Components (Parity with script.js st-timeline-two-cols) --- //

const DeliveredForm = ({ record, onSave }: any) => {
  const [photo, setPhoto] = useState(record.delivery_photo_url || '');
  const [confirmed, setConfirmed] = useState(record.delivered_confirmed || false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSave = async () => {
    setIsUploading(true);
    let finalUrl = photo;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dispatch/${fileName}`;

        const { error } = await supabase.storage.from('influencer-profiles').upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabase.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setPhoto(finalUrl);
      } catch (err) {
        console.error('Error uploading photo:', err);
        setIsUploading(false);
        return; // Don't save if upload failed
      }
    }

    await onSave({ delivery_photo_url: finalUrl, delivered_confirmed: confirmed });
    setIsUploading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 space-y-6">
      
      <div className="flex items-center gap-3 bg-slate-800 p-4 rounded-lg border border-slate-700">
        <input 
          type="checkbox" 
          id="delivered-confirmed"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="w-5 h-5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-800" 
        />
        <label htmlFor="delivered-confirmed" className="text-sm font-medium text-slate-200 cursor-pointer">
          Yes, the package has been delivered and confirmed by the creator.
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
          Delivery Proof Photo
        </label>
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-4 text-center relative hover:border-emerald-500 transition-colors bg-slate-800/50 min-h-[200px] flex items-center justify-center">
          {preview ? (
            <div className="relative w-full aspect-video">
              <img src={preview} alt="Delivery Proof" className="w-full h-full object-contain rounded" />
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center">
              <UploadCloud className="text-slate-500 mb-3" size={32} />
              <span className="text-sm text-slate-300 font-medium mb-1">Click to upload delivery photo</span>
              <span className="text-xs text-slate-500">PNG, JPG up to 5MB</span>
            </div>
          )}
          <input 
            type="file" 
            accept="image/*" 
            onChange={handlePhotoUpload} 
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
          />
        </div>
      </div>
      
      <div className="flex items-end justify-end pt-2 border-t border-slate-800">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          {isUploading ? 'Saving...' : 'Save Delivery Details'}
        </button>
      </div>
    </div>
  );
};

const PayAdvanceForm = ({ record, onSave }: any) => {
  const [gpay, setGpay] = useState(record.advance_gpay_number || '');
  const [total, setTotal] = useState(record.advance_total_amount || '');
  const [advance, setAdvance] = useState(record.advance_paid_amount || '');
  
  const [photo, setPhoto] = useState(record.pay_advance_photo_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSave = async () => {
    setIsUploading(true);
    let finalUrl = photo;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dispatch/${fileName}`;

        const { error } = await supabase.storage.from('influencer-profiles').upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabase.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setPhoto(finalUrl);
      } catch (err) {
        console.error('Error uploading photo:', err);
        setIsUploading(false);
        return; // Don't save if upload failed
      }
    }

    await onSave({ 
      advance_gpay_number: gpay, 
      advance_total_amount: total, 
      advance_paid_amount: advance, 
      pay_advance_photo_url: finalUrl 
    });
    setIsUploading(false);
  };

  return (
    <div className="bg-[#1B2130] rounded-lg p-6 flex flex-col h-full space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        
        {/* Left Side: Inputs & Upload Button */}
        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">GPay Number</label>
            <input type="text" value={gpay} onChange={e=>setGpay(e.target.value)} className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Total Amount</label>
            <input type="text" value={total} onChange={e=>setTotal(e.target.value)} className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Advance Amount</label>
            <input type="text" value={advance} onChange={e=>setAdvance(e.target.value)} className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
          </div>
          
          <div className="pt-2">
            <div className="relative w-32 h-24 border border-dashed border-indigo-500/40 rounded-xl bg-[#1e2536] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors">
              <UploadCloud className="text-indigo-400 mb-1" size={18} />
              <span className="text-[10px] text-indigo-300 font-medium text-center px-2">Upload Screenshot</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
          </div>
        </div>

        {/* Right Side: Image Preview */}
        <div className="flex flex-col items-center justify-center h-full">
          {preview ? (
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-[#151923] rounded-xl border border-slate-700/50 flex items-center justify-center p-2 mb-2 overflow-hidden shadow-lg">
                <img src={preview} alt="Screenshot Preview" className="max-w-full max-h-full object-contain rounded-md" />
              </div>
              <span className="text-xs text-slate-400">Screenshot Preview</span>
            </div>
          ) : (
             <div className="flex flex-col items-center opacity-50">
                <div className="w-48 h-48 bg-[#151923] rounded-xl border border-slate-700/30 flex flex-col items-center justify-center p-2 mb-2">
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-2"><UploadCloud className="text-slate-500" size={20}/></div>
                  <span className="text-xs text-slate-500">No Image Selected</span>
                </div>
             </div>
          )}
        </div>

      </div>

      {/* Footer Action */}
      <div className="flex justify-end pt-4 mt-2">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {isUploading ? 'Saving...' : 'Save Details'}
        </button>
      </div>
    </div>
  );
};

const ReferenceVideosForm = ({ record, onSave }: any) => {
  const [concept, setConcept] = useState(record.ref_concept || '');
  const [script, setScript] = useState(record.ref_script || '');
  const [keypoints, setKeypoints] = useState(record.ref_keypoints || '');
  const [offer, setOffer] = useState(record.ref_offer || '');
  const [link, setLink] = useState(record.ref_link || '');
  const [callReq, setCallReq] = useState(record.ref_call_explanation_required || false);
  const [vids, setVids] = useState<string[]>(record.reference_videos_list?.length ? record.reference_videos_list : ['']);
  
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div><label className="block text-xs text-slate-400 mb-1">Campaign Concept</label><input type="text" value={concept} onChange={e=>setConcept(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white" /></div>
        <div><label className="block text-xs text-slate-400 mb-1">Offer to Mention</label><input type="text" value={offer} onChange={e=>setOffer(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white" /></div>
        <div className="col-span-1 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">Proposed Script</label><textarea value={script} onChange={e=>setScript(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white h-20" /></div>
        <div className="col-span-1 md:col-span-2"><label className="block text-xs text-slate-400 mb-1">Key Points</label><textarea value={keypoints} onChange={e=>setKeypoints(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white h-20" /></div>
        <div><label className="block text-xs text-slate-400 mb-1">Creator Product Link</label><input type="text" value={link} onChange={e=>setLink(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white" /></div>
        <div className="flex items-center mt-6">
          <label className="flex items-center cursor-pointer gap-2">
            <input type="checkbox" checked={callReq} onChange={e=>setCallReq(e.target.checked)} className="rounded border-slate-700 bg-slate-800 text-emerald-500 w-5 h-5" />
            <span className="text-sm text-slate-300">Call Explanation Required</span>
          </label>
        </div>
      </div>
      
      <div className="border-t border-slate-800 pt-4">
        <label className="block text-xs text-slate-400 mb-2 uppercase">Reference Video Links</label>
        {vids.map((v, i) => (
          <input key={i} type="text" value={v} onChange={e => { const nv = [...vids]; nv[i] = e.target.value; setVids(nv); }} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white mb-2" placeholder="Video URL..." />
        ))}
        <button onClick={() => setVids([...vids, ''])} className="text-emerald-400 text-xs mt-1 hover:underline">+ Add More</button>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={() => onSave({ ref_concept: concept, ref_script: script, ref_keypoints: keypoints, ref_offer: offer, ref_link: link, ref_call_explanation_required: callReq, reference_videos_list: vids })} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm transition-colors">Save Details</button>
      </div>
    </div>
  );
};

const ExpectedTimelineForm = ({ record, onSave, isRework }: any) => {
  const dateKey = isRework ? 're_draft_expected_date' : 'draft_expected_date';
  const timeKey = isRework ? 're_draft_expected_time' : 'draft_expected_time';
  const [date, setDate] = useState(record[dateKey] || '');
  const [time, setTime] = useState(record[timeKey] || '');
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div><label className="block text-xs text-slate-400 mb-1">Expected Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white" /></div>
        <div><label className="block text-xs text-slate-400 mb-1">Expected Time</label><input type="time" value={time} onChange={e=>setTime(e.target.value)} className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2 text-sm text-white" /></div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => onSave({ [dateKey]: date, [timeKey]: time })} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm transition-colors">Save Details</button>
      </div>
    </div>
  );
};

const DraftForm = ({ record, onSave, isRework }: any) => {
  const vUrl = isRework ? 're_draft_video_url' : 'draft_video_url';
  const status = isRework ? 're_draft_approval_status' : 'draft_approval_status';
  const timing = isRework ? 're_draft_timing_status' : 'draft_timing_status';
  const corrections = isRework ? 're_draft_corrections_required' : 'draft_corrections_required';
  const fLink = isRework ? 're_draft_final_product_link' : 'draft_final_product_link';
  const fDesc = isRework ? 're_draft_final_description' : 'draft_final_description';

  const expDate = isRework ? record.re_draft_expected_date : record.draft_expected_date;
  const expTime = isRework ? record.re_draft_expected_time : record.draft_expected_time;

  const [vid, setVid] = useState(record[vUrl] || '');
  const [appStat, setAppStat] = useState(record[status] || '');
  const [corr, setCorr] = useState(record[corrections] || '');
  const [finalL, setFinalL] = useState(record[fLink] || '');
  const [finalD, setFinalD] = useState(record[fDesc] || '');
  
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [calculatedTiming, setCalculatedTiming] = useState(record[timing] || 'Not Submit');

  // Auto-calculate timing status
  React.useEffect(() => {
    if (!vid && !file) {
      setCalculatedTiming('Not Submit');
    } else {
      if (record[timing] && !file) {
        setCalculatedTiming(record[timing]);
      } else {
        if (expDate && expTime) {
          const expectedMs = new Date(`${expDate}T${expTime}`).getTime();
          const currentMs = new Date().getTime();
          const diffMs = currentMs - expectedMs;
          const tolerance = 5 * 60 * 1000;
          if (diffMs < -tolerance) setCalculatedTiming('Advance');
          else if (Math.abs(diffMs) <= tolerance) setCalculatedTiming('On Time');
          else setCalculatedTiming('Late');
        } else {
          setCalculatedTiming('On Time');
        }
      }
    }
  }, [vid, file, expDate, expTime, record, timing]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      // Create a temporary object URL for preview if it's a video
      setVid(URL.createObjectURL(selectedFile)); 
    }
  };

  const handleSave = async () => {
    if (appStat === 'Not Approved' && (!corr || corr.trim() === '')) {
      toast.error('Please enter correction instructions before rejecting a draft.');
      return;
    }

    setIsUploading(true);
    let finalUrl = vid;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `drafts/${fileName}`;

        const { error } = await supabase.storage.from('influencer-profiles').upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabase.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setVid(finalUrl);
      } catch (err) {
        console.error('Error uploading draft video:', err);
        setIsUploading(false);
        return;
      }
    }

    const data = { 
      [vUrl]: finalUrl, 
      [status]: appStat, 
      [timing]: calculatedTiming, 
      [corrections]: corr, 
      [fLink]: finalL, 
      [fDesc]: finalD 
    };
    
    // Automatically prepare the rework fields if "Not Approved"
    if (appStat === 'Not Approved' && !isRework) {
      data['re_draft_expected_date'] = record.re_draft_expected_date || '';
    } else if (appStat === 'Approved' && !isRework) {
      data['re_draft_expected_date'] = null;
      data['re_draft_expected_time'] = null;
      data['re_draft_video_url'] = null;
      data['re_draft_approval_status'] = null;
      data['re_draft_timing_status'] = null;
      data['re_draft_corrections_required'] = null;
      data['re_draft_final_product_link'] = null;
      data['re_draft_final_description'] = null;
    }

    await onSave(data);
    setIsUploading(false);
  };

  return (
    <div className="bg-[#151923] p-8 min-h-[500px] flex flex-col justify-between">
      <div className="space-y-8 max-w-4xl mx-auto w-full">
        
        {/* Upload Section */}
        <div className="flex justify-center gap-6">
          <div className="relative w-40 h-32 border border-dashed border-indigo-500/40 rounded-xl bg-[#1e2536] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors">
            <UploadCloud className="text-indigo-400 mb-2" size={24} />
            <span className="text-xs text-indigo-300 font-medium">Upload Draft</span>
            <input 
              type="file" 
              accept="video/*,image/*" 
              onChange={handleFileUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            />
          </div>
          <div className="w-40 h-32 border border-dashed border-slate-700/50 rounded-xl bg-[#1a1f2c] flex flex-col items-center justify-center">
            {vid && vid.startsWith('blob:') ? (
               <span className="text-xs text-emerald-400 font-medium px-4 text-center break-all">File Selected for Upload</span>
            ) : vid ? (
               <span className="text-xs text-slate-400 font-medium px-4 text-center break-all text-ellipsis overflow-hidden line-clamp-3">Draft Uploaded</span>
            ) : (
               <span className="text-xs text-slate-500 font-medium">No Video</span>
            )}
          </div>
        </div>

        {/* Status Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-slate-800 pb-8">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-3 tracking-wider uppercase">Approval Status</label>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setAppStat('Approved')}
                className={`px-5 py-2 rounded-full text-xs font-semibold border transition-colors ${appStat === 'Approved' ? 'bg-[#151923] text-white border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'}`}
              >
                Approved
              </button>
              <button 
                onClick={() => setAppStat('Not Approved')}
                className={`px-5 py-2 rounded-full text-xs font-semibold border transition-colors ${appStat === 'Not Approved' ? 'bg-[#151923] text-white border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'bg-transparent text-slate-400 border-slate-700 hover:border-slate-500'}`}
              >
                Not Approved
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-3 tracking-wider uppercase">Timing Status</label>
            <div className="grid grid-cols-2 gap-3">
              {['Advance', 'On Time', 'Late', 'Not Submit'].map((ts) => (
                <div key={ts} className={`flex items-center gap-2 p-2 rounded-lg border ${calculatedTiming === ts ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-transparent border-slate-800 opacity-60'}`}>
                  <input type="checkbox" checked={calculatedTiming === ts} readOnly className="w-4 h-4 rounded-sm border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0" />
                  <span className={`text-xs ${calculatedTiming === ts ? 'text-indigo-400 font-medium' : 'text-slate-500'}`}>{ts}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Section based on Approval Status */}
        {appStat === 'Not Approved' && (
          <div className="animate-fade-in">
            <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-wider uppercase">What Correction Required</label>
            <textarea 
              value={corr} 
              onChange={e=>setCorr(e.target.value)} 
              placeholder="Enter corrections required..."
              className="w-full bg-[#1e2536] border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 min-h-[100px]" 
            />
          </div>
        )}

        {appStat === 'Approved' && (
          <div className="animate-fade-in space-y-4">
            <h6 className="text-sm font-bold text-white mb-4">Approved Details</h6>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-wider uppercase">Final Product Link</label>
                <input 
                  type="text" 
                  value={finalL} 
                  onChange={e=>setFinalL(e.target.value)} 
                  placeholder="Enter product link"
                  className="w-full bg-[#1e2536] border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-wider uppercase">Final Description</label>
                <input 
                  type="text" 
                  value={finalD} 
                  onChange={e=>setFinalD(e.target.value)} 
                  placeholder="Enter final description"
                  className="w-full bg-[#1e2536] border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-indigo-500" 
                />
              </div>
            </div>
          </div>
        )}
        
      </div>
      
      <div className="flex justify-end pt-8 mt-auto w-full max-w-4xl mx-auto">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-[#6b7bf6] hover:bg-indigo-500 text-white px-8 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
        >
          {isUploading ? 'Saving...' : 'Save Details'}
        </button>
      </div>
    </div>
  );
};

const PayRemainingForm = ({ record, onSave }: any) => {
  const totalAmount = record.pricing?.final_price || 0;
  const advancePaid = parseFloat(record.advance_paid_amount || '0');
  const remainingPayment = totalAmount - advancePaid;

  const [photo, setPhoto] = useState(record.payment_remaining_photo_url || '');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(photo || null);

  const isPaid = !!preview;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSave = async () => {
    setIsUploading(true);
    let finalUrl = photo;

    if (file) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `dispatch/${fileName}`;

        const { error } = await supabase.storage.from('influencer-profiles').upload(filePath, file);
        if (error) throw error;

        const { data: publicData } = supabase.storage.from('influencer-profiles').getPublicUrl(filePath);
        finalUrl = publicData.publicUrl;
        setPhoto(finalUrl);
      } catch (err) {
        console.error('Error uploading photo:', err);
        setIsUploading(false);
        return;
      }
    }

    await onSave({ 
      payment_remaining_photo_url: finalUrl,
      payment_remaining_completed: !!finalUrl 
    });
    setIsUploading(false);
  };

  return (
    <div className="bg-[#1B2130] rounded-lg p-6 flex flex-col h-full space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        
        {/* Left Side: Inputs & Upload Button */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-slate-400 tracking-wider uppercase">Total Amount</label>
              <div className="flex items-center gap-2 bg-[#151923] px-2 py-1 rounded-md border border-slate-700/50">
                <input type="checkbox" checked={isPaid} readOnly className="w-3.5 h-3.5 rounded-sm border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">PAID</span>
              </div>
            </div>
            <input type="text" value={Number(totalAmount).toFixed(2)} readOnly className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none opacity-80 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Advance Paid</label>
            <input type="text" value={Number(advancePaid).toFixed(2)} readOnly className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-white focus:outline-none opacity-80 cursor-not-allowed" />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1 tracking-wider uppercase">Remaining Payment</label>
            <input type="text" value={Number(remainingPayment).toFixed(2)} readOnly className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-3 py-2 text-sm text-emerald-400 font-bold focus:outline-none opacity-90 cursor-not-allowed" />
          </div>
          
          <div className="pt-2">
            <div className="relative w-32 h-24 border border-dashed border-indigo-500/40 rounded-xl bg-[#1e2536] flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 transition-colors">
              <UploadCloud className="text-indigo-400 mb-1" size={18} />
              <span className="text-[10px] text-indigo-300 font-medium text-center px-2">Upload Proof</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
            </div>
          </div>
        </div>

        {/* Right Side: Image Preview */}
        <div className="flex flex-col items-center justify-center h-full">
          {preview ? (
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 bg-[#151923] rounded-xl border border-slate-700/50 flex items-center justify-center p-2 mb-2 overflow-hidden shadow-lg">
                <img src={preview} alt="Proof Preview" className="max-w-full max-h-full object-contain rounded-md" />
              </div>
              <span className="text-xs text-slate-400">Proof Preview</span>
            </div>
          ) : (
             <div className="flex flex-col items-center opacity-50">
                <div className="w-48 h-48 bg-[#151923] rounded-xl border border-slate-700/30 flex flex-col items-center justify-center p-2 mb-2">
                  <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-2"><UploadCloud className="text-slate-500" size={20}/></div>
                  <span className="text-xs text-slate-500">No Image Selected</span>
                </div>
             </div>
          )}
        </div>

      </div>

      {/* Footer Action */}
      <div className="flex justify-end pt-4 mt-2">
        <button 
          onClick={handleSave} 
          disabled={isUploading}
          className="bg-[#6b7bf6] hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {isUploading ? 'Saving...' : 'Save Details'}
        </button>
      </div>
    </div>
  );
};

const FinalPostForm = ({ record, onSave }: any) => {
  const isRework = record.draft_approval_status === 'Not Approved' || record.re_draft_approval_status;
  const draftDateKey = isRework ? 're_draft_expected_date' : 'draft_expected_date';
  const draftTimeKey = isRework ? 're_draft_expected_time' : 'draft_expected_time';
  
  const expectedDate = record[draftDateKey];
  const expectedTime = record[draftTimeKey];
  
  const formattedExpectedDate = expectedDate && expectedTime 
    ? new Date(`${expectedDate}T${expectedTime}`).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(',', ' •')
    : 'Not Set';

  const finalProductLink = isRework ? record.re_draft_final_product_link : record.draft_final_product_link;

  const [link, setLink] = useState(record.final_post_link || finalProductLink || '');
  const [dt, setDt] = useState(record.final_post_actual_datetime || '');
  const [confirmedLive, setConfirmedLive] = useState(record.final_post_completed || false);
  
  let status = 'PENDING';
  let statusColor = 'text-slate-500';
  
  if (dt && expectedDate && expectedTime) {
    const actual = new Date(dt).getTime();
    const expected = new Date(`${expectedDate}T${expectedTime}`).getTime();
    const diffMs = actual - expected;
    const tolerance = 5 * 60 * 1000;
    
    if (diffMs < -tolerance) {
      status = 'ADVANCE';
      statusColor = 'text-emerald-500';
    } else if (Math.abs(diffMs) <= tolerance) {
      status = 'ON TIME';
      statusColor = 'text-blue-500';
    } else {
      status = 'LATE';
      statusColor = 'text-red-500';
    }
  }

  const canConfirm = !!link && !!dt;

  return (
    <div className="bg-[#1B2130] rounded-lg p-6 flex flex-col space-y-6">
      
      {/* Draft Delivery Status Header */}
      <div className="flex items-center justify-between bg-[#151923] border border-slate-700/50 rounded-lg px-4 py-3">
        <span className="text-[11px] font-bold text-slate-400">
          Draft Delivery: <span className="text-slate-300 ml-1">{formattedExpectedDate}</span>
        </span>
        {status !== 'PENDING' && (
          <span className={`text-[10px] font-bold tracking-wider ${statusColor}`}>
            {status}
          </span>
        )}
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-wider uppercase">Confirm Final Post Link</label>
          <input 
            type="text" 
            value={link} 
            onChange={e=>setLink(e.target.value)} 
            placeholder="Confirm Final Post Link"
            className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" 
          />
        </div>
        
        <div>
          <label className="block text-[11px] font-bold text-slate-400 mb-2 tracking-wider uppercase">Actual Posting Date/Time</label>
          <input 
            type="datetime-local" 
            value={dt} 
            onChange={e=>setDt(e.target.value)} 
            className="w-full bg-[#151923] border border-slate-700/50 rounded-md px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" 
          />
        </div>

        <div className="pt-2">
          <label className={`flex items-start gap-2 cursor-pointer ${!canConfirm ? 'opacity-50' : ''}`}>
            <input 
              type="checkbox" 
              checked={confirmedLive}
              disabled={!canConfirm}
              onChange={e=>setConfirmedLive(e.target.checked)} 
              className="mt-0.5 w-4 h-4 rounded-sm border-slate-700 bg-[#151923] text-indigo-500 focus:ring-0 disabled:cursor-not-allowed" 
            />
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Confirmed Live</span>
              <span className="text-[10px] text-slate-500">No posting timeline set in Step 4.</span>
            </div>
          </label>
        </div>
      </div>

      {/* Footer Action */}
      <div className="flex justify-end pt-4 mt-2">
        <button 
          onClick={() => onSave({ 
            final_post_link: link, 
            final_post_actual_datetime: dt,
            final_post_completed: confirmedLive 
          })} 
          className="bg-[#6b7bf6] hover:bg-indigo-500 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          Save Details
        </button>
      </div>
    </div>
  );
};
