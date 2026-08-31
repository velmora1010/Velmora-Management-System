import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Loader2,
  FileCheck,
  AlertCircle,
  Trash2,
  Check
} from 'lucide-react';
import type { Campaign, CampaignInfluencer, InfluencerPlatformDetail } from '../../types';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import toast from 'react-hot-toast';

interface UploadPlatformDetailsModalProps {
  campaign: Campaign;
  existingInfluencers: CampaignInfluencer[];
  initialInfluencerCode?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export type PlatformKey = 'Instagram' | 'YouTube' | 'Facebook';

export interface SelectedPlatformFile {
  platform: PlatformKey;
  file: File;
  headers: string[];
  rows: Record<string, any>[];
  parsedRecords: ParsedPlatformRow[];
  validationError?: string;
}

export interface ParsedPlatformRow {
  platform: PlatformKey;
  code: string;
  username: string;
  followers: number;
  category: string;
  average: number | null;
  videoViews: number[];
  isValid: boolean;
  reason?: string;
  matchedInfluencerId?: string | number;
}

export interface SummaryStats {
  instagramCount: number;
  youtubeCount: number;
  facebookCount: number;
  totalRecords: number;
  matchedCount: number;
  unmatchedCodes: string[];
  invalidCount: number;
}

export const UploadPlatformDetailsModal: React.FC<UploadPlatformDetailsModalProps> = ({
  campaign,
  existingInfluencers,
  initialInfluencerCode,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'uploading' | 'done'>('upload');
  
  // Selected files per platform
  const [instaFile, setInstaFile] = useState<SelectedPlatformFile | null>(null);
  const [ytFile, setYtFile] = useState<SelectedPlatformFile | null>(null);
  const [fbFile, setFbFile] = useState<SelectedPlatformFile | null>(null);

  // File input refs
  const instaInputRef = useRef<HTMLInputElement>(null);
  const ytInputRef = useRef<HTMLInputElement>(null);
  const fbInputRef = useRef<HTMLInputElement>(null);

  // Progress state during upload
  const [uploadProgress, setUploadProgress] = useState<{
    Instagram: number;
    YouTube: number;
    Facebook: number;
  }>({
    Instagram: 0,
    YouTube: 0,
    Facebook: 0
  });

  const [isSaving, setIsSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState<PlatformKey>('Instagram');

  // Helper string cleaner
  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  };

  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    let str = String(val).trim().toUpperCase().replace(/,/g, '');
    if (str.endsWith('M')) {
      const n = parseFloat(str.slice(0, -1));
      return isNaN(n) ? 0 : Math.round(n * 1000000);
    }
    if (str.endsWith('K')) {
      const n = parseFloat(str.slice(0, -1));
      return isNaN(n) ? 0 : Math.round(n * 1000);
    }
    const n = parseFloat(str);
    return isNaN(n) ? 0 : Math.round(n);
  };

  // Flexible Header Matching
  const findColumnKey = (rowKeys: string[], possibleNames: string[]): string | null => {
    for (const key of rowKeys) {
      const normKey = key.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      for (const target of possibleNames) {
        const normTarget = target.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (normKey === normTarget) {
          return key;
        }
      }
    }
    return null;
  };

  const parseFileForPlatform = async (file: File, platform: PlatformKey): Promise<SelectedPlatformFile> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheet];
          const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (!rawData || rawData.length === 0) {
            resolve({
              platform,
              file,
              headers: [],
              rows: [],
              parsedRecords: [],
              validationError: 'File is empty or has no data rows'
            });
            return;
          }

          const headers = Object.keys(rawData[0] || {});
          
          // Header detection according to Excel spec
          const codeKey = findColumnKey(headers, ['influencer code', 'influencercode', 'influencer_code', 'code', 's no code']);
          const usernameKey = findColumnKey(headers, ['user name', 'username', 'user_name', 'handle', 'profile link']);
          const followersKey = findColumnKey(headers, ['followers count', 'followers_count', 'followerscount', 'followers', 'subscribers']);
          const categoryKey = findColumnKey(headers, ['creator category', 'creator_category', 'creatorcategory', 'performance code', 'performance_code', 'category']);
          const averageKey = findColumnKey(headers, ['average views', 'average_views', 'averageviews', 'average', 'avg views', 'avg']);

          if (!codeKey) {
            resolve({
              platform,
              file,
              headers,
              rows: rawData,
              parsedRecords: [],
              validationError: 'Required column missing: Influencer Code'
            });
            return;
          }

          const influencerCodeMap = new Map<string, CampaignInfluencer>();
          existingInfluencers.forEach(inf => {
            if (inf.code) {
              influencerCodeMap.set(inf.code.trim().toUpperCase(), inf);
            }
          });

          const parsedRecords: ParsedPlatformRow[] = rawData.map(row => {
            const rawCode = cleanStr(row[codeKey]).toUpperCase();
            if (!rawCode) {
              return {
                platform,
                code: '',
                username: '',
                followers: 0,
                category: '',
                average: null,
                videoViews: Array(15).fill(0),
                isValid: false,
                reason: 'Missing Influencer Code'
              };
            }

            const matchedInf = influencerCodeMap.get(rawCode);
            const username = usernameKey ? cleanStr(row[usernameKey]) : (matchedInf?.name || matchedInf?.influencer_name || '');
            const followers = followersKey ? parseNum(row[followersKey]) : 0;
            const rawCat = categoryKey ? cleanStr(row[categoryKey]).toUpperCase() : '';
            const category = ['C1L1','C1L2','C2L1','C2L2','C3L1','C3L2','C4L1','C4L2'].includes(rawCat) ? rawCat : (rawCat || '');
            const averageVal = averageKey && row[averageKey] !== '' && row[averageKey] !== null && row[averageKey] !== undefined
              ? parseNum(row[averageKey])
              : null;

            // Video 1 to Video 15
            const videoViews: number[] = Array(15).fill(0);
            for (let v = 1; v <= 15; v++) {
              const vKey = findColumnKey(headers, [`video ${v}`, `video_${v}`, `video${v}`, `v${v}`, `video_views_${v}`]);
              if (vKey && row[vKey] !== undefined && row[vKey] !== null && row[vKey] !== '') {
                videoViews[v - 1] = parseNum(row[vKey]);
              }
            }

            return {
              platform,
              code: rawCode,
              username,
              followers,
              category,
              average: averageVal,
              videoViews,
              isValid: true,
              matchedInfluencerId: matchedInf ? matchedInf.id : undefined,
              reason: matchedInf ? undefined : 'Unmatched Influencer Code'
            };
          });

          resolve({
            platform,
            file,
            headers,
            rows: rawData,
            parsedRecords
          });
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, platform: PlatformKey) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      const parsedData = await parseFileForPlatform(selectedFile, platform);
      if (platform === 'Instagram') setInstaFile(parsedData);
      else if (platform === 'YouTube') setYtFile(parsedData);
      else if (platform === 'Facebook') setFbFile(parsedData);
      toast.success(`${platform} file loaded!`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Error parsing ${platform} file: ${err.message || String(err)}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleRemoveFile = (platform: PlatformKey) => {
    if (platform === 'Instagram') setInstaFile(null);
    else if (platform === 'YouTube') setYtFile(null);
    else if (platform === 'Facebook') setFbFile(null);
  };

  // Calculate Summary Statistics
  const getSummaryStats = (): SummaryStats => {
    const allParsedFiles = [instaFile, ytFile, fbFile].filter(Boolean) as SelectedPlatformFile[];
    let instaCount = 0;
    let youtubeCount = 0;
    let facebookCount = 0;
    let totalRecords = 0;
    let invalidCount = 0;

    const unmatchedCodesSet = new Set<string>();
    const matchedInfluencerIdsSet = new Set<string | number>();

    allParsedFiles.forEach(pf => {
      if (pf.platform === 'Instagram') instaCount = pf.parsedRecords.length;
      if (pf.platform === 'YouTube') youtubeCount = pf.parsedRecords.length;
      if (pf.platform === 'Facebook') facebookCount = pf.parsedRecords.length;

      pf.parsedRecords.forEach(r => {
        totalRecords++;
        if (!r.code) {
          invalidCount++;
        } else if (r.matchedInfluencerId !== undefined) {
          matchedInfluencerIdsSet.add(r.matchedInfluencerId);
        } else {
          unmatchedCodesSet.add(r.code);
        }
      });
    });

    return {
      instagramCount: instaCount,
      youtubeCount,
      facebookCount,
      totalRecords,
      matchedCount: matchedInfluencerIdsSet.size,
      unmatchedCodes: Array.from(unmatchedCodesSet),
      invalidCount
    };
  };

  const stats = getSummaryStats();
  const hasValidFiles = Boolean(
    (instaFile && !instaFile.validationError) || 
    (ytFile && !ytFile.validationError) || 
    (fbFile && !fbFile.validationError)
  );

  const readyFilesCount = [instaFile, ytFile, fbFile].filter(f => f && !f.validationError).length;
  const notUploadedCount = 3 - readyFilesCount;

  const handleProceedToPreview = () => {
    if (!hasValidFiles) {
      toast.error('Please select at least one valid platform file');
      return;
    }
    if (instaFile) setPreviewTab('Instagram');
    else if (ytFile) setPreviewTab('YouTube');
    else if (fbFile) setPreviewTab('Facebook');
    
    setStep('preview');
  };

  // Execute Merge & Database Save
  const handleConfirmImport = async () => {
    setStep('uploading');
    setIsSaving(true);

    try {
      const selectedFiles = [
        { key: 'Instagram' as PlatformKey, data: instaFile },
        { key: 'YouTube' as PlatformKey, data: ytFile },
        { key: 'Facebook' as PlatformKey, data: fbFile }
      ].filter(item => item.data !== null && !item.data.validationError);

      const influencerUpdatesMap = new Map<string | number, {
        influencer: CampaignInfluencer;
        newPlatforms: Map<PlatformKey, ParsedPlatformRow>;
      }>();

      existingInfluencers.forEach(inf => {
        const infCode = inf.code?.trim().toUpperCase();
        if (!infCode) return;

        selectedFiles.forEach(item => {
          const rec = item.data!.parsedRecords.find(r => r.code === infCode && r.isValid && r.matchedInfluencerId !== undefined);
          if (rec) {
            if (!influencerUpdatesMap.has(inf.id)) {
              influencerUpdatesMap.set(inf.id, {
                influencer: inf,
                newPlatforms: new Map<PlatformKey, ParsedPlatformRow>()
              });
            }
            influencerUpdatesMap.get(inf.id)!.newPlatforms.set(item.key, rec);
          }
        });
      });

      // Update Database per file & influencer
      for (const item of selectedFiles) {
        const platformName = item.key;
        const records = item.data!.parsedRecords.filter(r => r.isValid && r.matchedInfluencerId !== undefined);
        let recCount = 0;

        for (const rec of records) {
          const infId = rec.matchedInfluencerId!;
          
          const { data: existingPlats } = await supabase
            .from(SUPABASE_TABLES.influencerPlatform)
            .select('*')
            .eq('influencer_id', infId);

          const matchedPlatRow = (existingPlats || []).find(p => p.platform.toLowerCase() === platformName.toLowerCase());

          const platformPayload: Record<string, any> = {
            influencer_id: infId,
            platform: platformName,
            username: rec.username || matchedPlatRow?.username || '',
            followers_count: rec.followers || matchedPlatRow?.followers_count || 0,
            video_views: rec.videoViews,
            performance_code: rec.category || matchedPlatRow?.performance_code || '',
            average: rec.average !== null ? rec.average : (matchedPlatRow?.average || null)
          };

          if (matchedPlatRow?.id) {
            let { error } = await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .update(platformPayload)
              .eq('id', matchedPlatRow.id);

            if (error && error.message?.includes('average')) {
              const safePayload = { ...platformPayload };
              delete safePayload.average;
              await supabase.from(SUPABASE_TABLES.influencerPlatform).update(safePayload).eq('id', matchedPlatRow.id);
            }
          } else {
            const { data: maxData } = await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .select('id')
              .order('id', { ascending: false })
              .limit(1);

            const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
            platformPayload.id = isNaN(maxId) ? 1 : maxId + 1;

            let { error } = await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .insert([platformPayload]);

            if (error && error.message?.includes('average')) {
              const safePayload = { ...platformPayload };
              delete safePayload.average;
              await supabase.from(SUPABASE_TABLES.influencerPlatform).insert([safePayload]);
            }
          }

          recCount++;
          const fileProgress = Math.round((recCount / records.length) * 100);
          setUploadProgress(prev => ({ ...prev, [platformName]: fileProgress }));
        }

        setUploadProgress(prev => ({ ...prev, [platformName]: 100 }));
      }

      // Update Platform Availability automatically for affected influencers
      for (const [infId, entry] of Array.from(influencerUpdatesMap.entries())) {
        const { influencer } = entry;
        
        const { data: allPlats } = await supabase
          .from(SUPABASE_TABLES.influencerPlatform)
          .select('platform, username, followers_count, video_views')
          .eq('influencer_id', infId);

        const activePlatforms = (allPlats || []).filter(p => {
          const hasUsername = Boolean(p.username && p.username.trim());
          const hasFollowers = Number(p.followers_count) > 0;
          const hasViews = Array.isArray(p.video_views) && p.video_views.some((v: any) => Number(v) > 0);
          return hasUsername || hasFollowers || hasViews;
        }).map(p => p.platform.toLowerCase());

        const hasInsta = activePlatforms.includes('instagram');
        const hasYoutube = activePlatforms.includes('youtube');
        const hasFb = activePlatforms.includes('facebook');

        let newAvailability = 'All';
        if (hasInsta && hasYoutube && hasFb) newAvailability = 'Instagram and Youtube and Facebook';
        else if (hasInsta && hasYoutube) newAvailability = 'Instagram and Youtube';
        else if (hasInsta && hasFb) newAvailability = 'Instagram and Facebook';
        else if (hasYoutube && hasFb) newAvailability = 'Youtube and Facebook';
        else if (hasInsta) newAvailability = 'Instagram';
        else if (hasYoutube) newAvailability = 'Youtube';
        else if (hasFb) newAvailability = 'Facebook';

        await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .update({ auto_dm: influencer.auto_dm })
          .eq('id', infId);
      }

      logActivity(
        'Marketing',
        'Platform Details Imported',
        `Imported platform details for ${stats.matchedCount} influencers in ${campaign.campaign_name}.`
      );

      setStep('done');
      toast.success('Platform Details imported successfully!');
    } catch (err: any) {
      console.error('Import Error:', err);
      toast.error(`Import failed: ${err.message || String(err)}`);
      setStep('preview');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Upload size={18} className="text-purple-400" />
              Import Platform Details
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload platform data for existing influencers by Influencer Code
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* STEP 1: UPLOAD FILES */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* INSTAGRAM DROPZONE */}
                <div className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col justify-between transition-colors ${
                  instaFile?.validationError ? 'border-red-500/50' : instaFile ? 'border-purple-500/60 bg-purple-950/10' : 'border-slate-700 hover:border-slate-600'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block"></span>
                        Instagram
                      </span>
                      {instaFile && !instaFile.validationError ? (
                        <span className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-bold">
                          ✓ Ready
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          — Not uploaded
                        </span>
                      )}
                    </div>

                    {!instaFile ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-700 rounded-lg p-3 hover:border-purple-500/50 transition-colors">
                        <FileSpreadsheet size={28} className="mx-auto text-slate-500 mb-2" />
                        <p className="text-xs text-slate-300 font-medium mb-1">Upload Instagram File</p>
                        <p className="text-[10px] text-slate-500 mb-3">Supported: Excel / CSV</p>
                        <input 
                          type="file" 
                          ref={instaInputRef} 
                          accept=".xlsx,.xls,.csv" 
                          onChange={(e) => handleFileSelect(e, 'Instagram')} 
                          className="hidden" 
                        />
                        <button 
                          onClick={() => instaInputRef.current?.click()}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Choose File
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs">
                          <p className="font-semibold text-slate-200 truncate">{instaFile.file.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{(instaFile.file.size / 1024).toFixed(1)} KB • {instaFile.parsedRecords.length} Rows</p>
                          {instaFile.validationError && (
                            <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1 font-medium">
                              <AlertCircle size={12} /> {instaFile.validationError}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleRemoveFile('Instagram')}
                            className="flex-1 py-1.5 bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700 rounded text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* YOUTUBE DROPZONE */}
                <div className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col justify-between transition-colors ${
                  ytFile?.validationError ? 'border-red-500/50' : ytFile ? 'border-purple-500/60 bg-purple-950/10' : 'border-slate-700 hover:border-slate-600'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                        YouTube
                      </span>
                      {ytFile && !ytFile.validationError ? (
                        <span className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-bold">
                          ✓ Ready
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          — Not uploaded
                        </span>
                      )}
                    </div>

                    {!ytFile ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-700 rounded-lg p-3 hover:border-purple-500/50 transition-colors">
                        <FileSpreadsheet size={28} className="mx-auto text-slate-500 mb-2" />
                        <p className="text-xs text-slate-300 font-medium mb-1">Upload YouTube File</p>
                        <p className="text-[10px] text-slate-500 mb-3">Supported: Excel / CSV</p>
                        <input 
                          type="file" 
                          ref={ytInputRef} 
                          accept=".xlsx,.xls,.csv" 
                          onChange={(e) => handleFileSelect(e, 'YouTube')} 
                          className="hidden" 
                        />
                        <button 
                          onClick={() => ytInputRef.current?.click()}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Choose File
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs">
                          <p className="font-semibold text-slate-200 truncate">{ytFile.file.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{(ytFile.file.size / 1024).toFixed(1)} KB • {ytFile.parsedRecords.length} Rows</p>
                          {ytFile.validationError && (
                            <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1 font-medium">
                              <AlertCircle size={12} /> {ytFile.validationError}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleRemoveFile('YouTube')}
                            className="flex-1 py-1.5 bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700 rounded text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* FACEBOOK DROPZONE */}
                <div className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col justify-between transition-colors ${
                  fbFile?.validationError ? 'border-red-500/50' : fbFile ? 'border-purple-500/60 bg-purple-950/10' : 'border-slate-700 hover:border-slate-600'
                }`}>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-100 text-sm flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                        Facebook
                      </span>
                      {fbFile && !fbFile.validationError ? (
                        <span className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-bold">
                          ✓ Ready
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          — Not uploaded
                        </span>
                      )}
                    </div>

                    {!fbFile ? (
                      <div className="text-center py-6 border-2 border-dashed border-slate-700 rounded-lg p-3 hover:border-purple-500/50 transition-colors">
                        <FileSpreadsheet size={28} className="mx-auto text-slate-500 mb-2" />
                        <p className="text-xs text-slate-300 font-medium mb-1">Upload Facebook File</p>
                        <p className="text-[10px] text-slate-500 mb-3">Supported: Excel / CSV</p>
                        <input 
                          type="file" 
                          ref={fbInputRef} 
                          accept=".xlsx,.xls,.csv" 
                          onChange={(e) => handleFileSelect(e, 'Facebook')} 
                          className="hidden" 
                        />
                        <button 
                          onClick={() => fbInputRef.current?.click()}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          Choose File
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg text-xs">
                          <p className="font-semibold text-slate-200 truncate">{fbFile.file.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{(fbFile.file.size / 1024).toFixed(1)} KB • {fbFile.parsedRecords.length} Rows</p>
                          {fbFile.validationError && (
                            <p className="text-[11px] text-red-400 mt-1 flex items-center gap-1 font-medium">
                              <AlertCircle size={12} /> {fbFile.validationError}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleRemoveFile('Facebook')}
                            className="flex-1 py-1.5 bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 border border-slate-700 rounded text-xs transition-colors flex items-center justify-center gap-1"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs text-slate-400 font-medium">
                <span>{readyFilesCount} {readyFilesCount === 1 ? 'file' : 'files'} ready • {notUploadedCount} not uploaded</span>
                <span>Influencer Code primary matching enabled</span>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button 
                  onClick={onClose}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleProceedToPreview}
                  disabled={!hasValidFiles}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"
                >
                  Validate & Preview
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & CONFIRMATION ("Ready to Import") */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white text-base mb-3 flex items-center justify-between">
                  <span>Ready to Import</span>
                  <span className="text-xs bg-purple-950/60 text-purple-300 border border-purple-800/40 px-3 py-1 rounded-full font-mono">
                    {stats.matchedCount} Matched Influencers
                  </span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Total Rows</span>
                    <span className="text-base font-bold text-slate-100">{stats.totalRecords}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Matched Influencers</span>
                    <span className="text-base font-bold text-green-400">{stats.matchedCount}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Unmatched Codes</span>
                    <span className={`text-base font-bold ${stats.unmatchedCodes.length > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                      {stats.unmatchedCodes.length}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Skipped/Invalid</span>
                    <span className="text-base font-bold text-slate-400">{stats.invalidCount}</span>
                  </div>
                </div>

                {/* Unmatched Codes Warning */}
                {stats.unmatchedCodes.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-300">
                    <p className="font-semibold flex items-center gap-1.5 mb-1 text-amber-200">
                      <AlertTriangle size={14} /> Unmatched Influencer Codes ({stats.unmatchedCodes.length}):
                    </p>
                    <p className="text-[11px] text-amber-300/80 font-mono mb-1">
                      {stats.unmatchedCodes.slice(0, 10).join(', ')}
                      {stats.unmatchedCodes.length > 10 ? ` ...and ${stats.unmatchedCodes.length - 10} more` : ''}
                    </p>
                    <p className="text-[10px] text-amber-400/70">
                      These influencer codes do not exist in the current campaign and will be skipped.
                    </p>
                  </div>
                )}
              </div>

              {/* Data Preview Table */}
              <div>
                <div className="flex border-b border-slate-800 mb-3 gap-2">
                  {instaFile && (
                    <button
                      onClick={() => setPreviewTab('Instagram')}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                        previewTab === 'Instagram' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      Instagram ({instaFile.parsedRecords.length})
                    </button>
                  )}
                  {ytFile && (
                    <button
                      onClick={() => setPreviewTab('YouTube')}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                        previewTab === 'YouTube' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      YouTube ({ytFile.parsedRecords.length})
                    </button>
                  )}
                  {fbFile && (
                    <button
                      onClick={() => setPreviewTab('Facebook')}
                      className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
                        previewTab === 'Facebook' ? 'border-purple-500 text-purple-300' : 'border-transparent text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      Facebook ({fbFile.parsedRecords.length})
                    </button>
                  )}
                </div>

                {/* Table Data */}
                {(() => {
                  const activeFile = previewTab === 'Instagram' ? instaFile : previewTab === 'YouTube' ? ytFile : fbFile;
                  if (!activeFile) return null;

                  return (
                    <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-56">
                      <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-800/80 text-slate-400 font-semibold sticky top-0">
                          <tr>
                            <th className="p-2.5">Code</th>
                            <th className="p-2.5">Username</th>
                            <th className="p-2.5">Followers</th>
                            <th className="p-2.5">Creator Category</th>
                            <th className="p-2.5">Average Views</th>
                            <th className="p-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {activeFile.parsedRecords.slice(0, 50).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="p-2.5 font-mono font-bold text-slate-200">{r.code || '—'}</td>
                              <td className="p-2.5 text-slate-300">{r.username || '—'}</td>
                              <td className="p-2.5 text-slate-300">{r.followers ? r.followers.toLocaleString() : '—'}</td>
                              <td className="p-2.5 font-mono text-purple-300">{r.category || '—'}</td>
                              <td className="p-2.5 text-slate-300">{r.average !== null ? r.average.toLocaleString() : '—'}</td>
                              <td className="p-2.5">
                                {r.matchedInfluencerId !== undefined ? (
                                  <span className="text-[10px] bg-green-950/50 text-green-400 border border-green-800/30 px-2 py-0.5 rounded font-bold">
                                    Matched
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-800/30 px-2 py-0.5 rounded font-bold">
                                    Unmatched
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Actions Footer */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button 
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmImport}
                  disabled={stats.matchedCount === 0 || isSaving}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm Import
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: UPLOADING PROGRESS */}
          {step === 'uploading' && (
            <div className="py-8 space-y-6 text-center">
              <Loader2 size={40} className="animate-spin text-purple-500 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-white mb-1">Importing Platform Details...</h4>
                <p className="text-xs text-slate-400">Merging platform data with existing influencer records</p>
              </div>

              <div className="max-w-md mx-auto space-y-4 text-left">
                {instaFile && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-300">Instagram</span>
                      <span className="text-purple-400">{uploadProgress.Instagram}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${uploadProgress.Instagram}%` }}></div>
                    </div>
                  </div>
                )}
                {ytFile && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-300">YouTube</span>
                      <span className="text-purple-400">{uploadProgress.YouTube}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${uploadProgress.YouTube}%` }}></div>
                    </div>
                  </div>
                )}
                {fbFile && (
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-300">Facebook</span>
                      <span className="text-purple-400">{uploadProgress.Facebook}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${uploadProgress.Facebook}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETED SUMMARY */}
          {step === 'done' && (
            <div className="py-6 space-y-6 text-center">
              <div className="w-16 h-16 bg-green-950/60 border border-green-800/40 rounded-full flex items-center justify-center mx-auto text-green-400">
                <Check size={32} />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-1">Import Complete!</h4>
                <p className="text-xs text-slate-400">Platform Details imported successfully across matched influencers.</p>
              </div>

              <div className="max-w-sm mx-auto bg-slate-800/60 p-4 rounded-xl border border-slate-700 text-left text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Instagram:</span>
                  <span className={instaFile ? 'text-green-400 font-semibold' : 'text-slate-500'}>
                    {instaFile ? `✓ ${stats.instagramCount} updated` : '— Not uploaded'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-medium">YouTube:</span>
                  <span className={ytFile ? 'text-green-400 font-semibold' : 'text-slate-500'}>
                    {ytFile ? `✓ ${stats.youtubeCount} updated` : '— Not uploaded'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-300 font-medium">Facebook:</span>
                  <span className={fbFile ? 'text-green-400 font-semibold' : 'text-slate-500'}>
                    {fbFile ? `✓ ${stats.facebookCount} updated` : '— Not uploaded'}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
