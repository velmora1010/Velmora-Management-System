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
import { calculateInstagramViewCode, calculateFacebookViewCode, calculateYoutubeViewCode } from '../../modules/marketing/AddCampaignInfluencer';
import { notifyInfluencerChange } from '../../hooks/marketing/useCampaignInfluencers';
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
  profileLink: string;
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

export const normalizePlatformName = (val: string): PlatformKey => {
  if (!val) return 'Instagram';
  const norm = val.toString().trim().toLowerCase().replace(/[^a-z]/g, '');
  if (norm === 'insta' || norm === 'instagram' || norm === 'ig') return 'Instagram';
  if (norm === 'yt' || norm === 'youtube' || norm === 'ytube') return 'YouTube';
  if (norm === 'fb' || norm === 'facebook') return 'Facebook';
  return 'Instagram';
};

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

  const normalizeHeader = (header: string): string => {
    return header
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  };

  // Flexible Header Matching
  const findColumnKey = (rowKeys: string[], possibleNames: string[]): string | null => {
    for (const key of rowKeys) {
      const normKey = normalizeHeader(key);
      for (const target of possibleNames) {
        const normTarget = normalizeHeader(target);
        if (normKey === normTarget) {
          return key;
        }
      }
    }
    return null;
  };

  const getAutoCreatorCategory = (platform: PlatformKey, videoViews: number[], followers: number): string => {
    let calcCode = 'Not Eligible';
    if (platform === 'Instagram') calcCode = calculateInstagramViewCode(videoViews).code;
    else if (platform === 'YouTube') calcCode = calculateYoutubeViewCode(videoViews).code;
    else if (platform === 'Facebook') calcCode = calculateFacebookViewCode(videoViews).code;

    if (calcCode && calcCode !== 'Not Eligible') {
      return calcCode;
    }

    if (followers >= 1000000) return 'C1L1';
    if (followers >= 500000) return 'C1L2';
    if (followers >= 250000) return 'C2L1';
    if (followers >= 100000) return 'C2L2';
    if (followers >= 50000) return 'C3L1';
    if (followers >= 25000) return 'C3L2';
    if (followers >= 10000) return 'C4L1';
    if (followers > 0) return 'C4L2';

    return 'C4L2';
  };

  const parseFileForPlatform = async (file: File, defaultPlatform: PlatformKey): Promise<SelectedPlatformFile> => {
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
              platform: defaultPlatform,
              file,
              headers: [],
              rows: [],
              parsedRecords: [],
              validationError: 'File is empty or has no data rows'
            });
            return;
          }

          const headers = Object.keys(rawData[0] || {});

          // Header detection according to spec
          const codeKey = findColumnKey(headers, ['influencer code', 'influencercode', 'influencer_code', 'code', 's no code', 'snocode', 'code number', 'codenumber', 'influencer']);
          const usernameKey = findColumnKey(headers, ['user name', 'username', 'user_name', 'instagram username', 'youtube username', 'facebook username', 'handle', 'name']);
          const profileLinkKey = findColumnKey(headers, ['profile link', 'profilelink', 'profile_link', 'url', 'link']);
          const followersKey = findColumnKey(headers, ['followers count', 'followers_count', 'followerscount', 'followers', 'follower count font', 'follower count', 'follower_count', 'subscribers', 'subs']);
          const categoryKey = findColumnKey(headers, ['creator category', 'creator_category', 'creatorcategory', 'performance code', 'performance_code', 'performancecode', 'category']);
          const averageKey = findColumnKey(headers, ['average views', 'average_views', 'averageviews', 'average', 'avg views', 'avg_views', 'avgviews', 'avg']);
          
          // Separate Platform vs Platform Agreed column detection
          const platformKey = findColumnKey(headers, ['platform', 'platform_name', 'platformname']);
          const platformAgreedKey = findColumnKey(headers, ['platform agreed', 'platform_agreed', 'platformagreed']);

          if (!codeKey) {
            resolve({
              platform: defaultPlatform,
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
            const codeVal = (inf.code || (inf as any).influencer_code || '').trim().toUpperCase();
            if (codeVal) {
              influencerCodeMap.set(codeVal, inf);
            }
          });

          const parsedRecords: ParsedPlatformRow[] = rawData.map(row => {
            const rawCode = cleanStr(row[codeKey]).toUpperCase();
            const rowPlatStr = platformKey ? cleanStr(row[platformKey]) : (platformAgreedKey ? cleanStr(row[platformAgreedKey]) : '');
            const rowPlatform = rowPlatStr ? normalizePlatformName(rowPlatStr) : defaultPlatform;

            if (!rawCode) {
              return {
                platform: rowPlatform,
                code: '',
                username: '',
                profileLink: '',
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
            const profileLink = profileLinkKey ? cleanStr(row[profileLinkKey]) : '';
            const followers = followersKey ? parseNum(row[followersKey]) : 0;

            // Video 1 to Video 15
            const videoViews: number[] = Array(15).fill(0);
            for (let v = 1; v <= 15; v++) {
              const vKey = findColumnKey(headers, [
                `video ${v}`, `video_${v}`, `video${v}`, `v${v}`, `video_views_${v}`,
                `video ${v} views`, `video ${v} view`, `video_${v}_views`, `video${v}views`, `video${v}view`,
                `video ${v} view count`, `video${v} views`, `video${v} view`
              ]);
              if (vKey && row[vKey] !== undefined && row[vKey] !== null && row[vKey] !== '') {
                videoViews[v - 1] = parseNum(row[vKey]);
              }
            }

            // Case A vs Case B for Creator Category
            const rawCat = categoryKey ? cleanStr(row[categoryKey]).toUpperCase() : '';
            const cleanCat = rawCat.replace(/[^A-Z0-9]/g, '');
            let category = '';
            if (['C1L1','C1L2','C2L1','C2L2','C3L1','C3L2','C4L1','C4L2'].includes(cleanCat)) {
              category = cleanCat;
            } else if (cleanCat === 'BELOW10K' || cleanCat === 'BELOW10000') {
              category = 'C4L2';
            } else if (rawCat) {
              category = rawCat;
            }
            
            if (!category) {
              category = getAutoCreatorCategory(rowPlatform, videoViews, followers);
            }

            // Average Views calculation if missing
            let averageVal = averageKey && row[averageKey] !== '' && row[averageKey] !== null && row[averageKey] !== undefined
              ? parseNum(row[averageKey])
              : null;

            if (averageVal === null) {
              const nonZeroViews = videoViews.filter(v => v > 0);
              if (nonZeroViews.length > 0) {
                averageVal = Math.round(nonZeroViews.reduce((a, b) => a + b, 0) / nonZeroViews.length);
              } else if (followers > 0) {
                averageVal = Math.round(followers * 0.1);
              } else {
                averageVal = 0;
              }
            }

            return {
              platform: rowPlatform,
              code: rawCode,
              username,
              profileLink,
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
            platform: defaultPlatform,
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
      const allParsedFiles = [instaFile, ytFile, fbFile].filter(Boolean) as SelectedPlatformFile[];
      const allRecordsToProcess: { record: ParsedPlatformRow; filePlatform: PlatformKey }[] = [];

      allParsedFiles.forEach(pf => {
        pf.parsedRecords.forEach(r => {
          if (r.isValid && r.matchedInfluencerId !== undefined) {
            allRecordsToProcess.push({ record: r, filePlatform: pf.platform });
          }
        });
      });

      let recCount = 0;
      const totalRecords = allRecordsToProcess.length;
      const affectedInfIds = new Set<string | number>();

      for (const item of allRecordsToProcess) {
        const rec = item.record;
        const infId = rec.matchedInfluencerId!;
        affectedInfIds.add(infId);
        const platformName = normalizePlatformName(rec.platform || item.filePlatform);

        const { data: existingPlats, error: fetchErr } = await supabase
          .from(SUPABASE_TABLES.influencerPlatform)
          .select('*')
          .eq('influencer_id', infId);

        if (fetchErr) {
          console.error(`[Platform Upload Error] Fetch failed for influencer ${infId}:`, fetchErr);
        }

        const targetPlatformNorm = normalizePlatformName(platformName);
        const matchedPlatRow = (existingPlats || []).find(p => normalizePlatformName(p.platform) === targetPlatformNorm);

        // Merge video views cleanly
        const existingViews = Array.isArray(matchedPlatRow?.video_views) ? matchedPlatRow.video_views : [];
        const mergedViews = rec.videoViews.map((v, i) => (v > 0 ? v : (Number(existingViews[i]) || 0)));

        const platformPayload: Record<string, any> = {
          influencer_id: infId,
          platform: platformName,
          username: rec.username || matchedPlatRow?.username || '',
          profile_link: rec.profileLink || matchedPlatRow?.profile_link || '',
          followers_count: rec.followers > 0 ? rec.followers : (matchedPlatRow?.followers_count || 0),
          video_views: mergedViews,
          performance_code: rec.category || matchedPlatRow?.performance_code || '',
          average: rec.average !== null ? rec.average : (matchedPlatRow?.average || null)
        };

        if (matchedPlatRow?.id) {
          let { error: updateErr } = await supabase
            .from(SUPABASE_TABLES.influencerPlatform)
            .update(platformPayload)
            .eq('id', matchedPlatRow.id);

          if (updateErr) {
            console.error(`[Platform Upload Error] Update failed for platform id ${matchedPlatRow.id}:`, updateErr);
            if (updateErr.message?.includes('average')) {
              const safePayload = { ...platformPayload };
              delete safePayload.average;
              const { error: err2 } = await supabase.from(SUPABASE_TABLES.influencerPlatform).update(safePayload).eq('id', matchedPlatRow.id);
              if (err2) console.error(`[Platform Upload Error] Fallback update failed:`, err2);
            }
          }
        } else {
          // Try inserting without explicit id first
          let { error: insertErr } = await supabase
            .from(SUPABASE_TABLES.influencerPlatform)
            .insert([platformPayload]);

          if (insertErr) {
            console.error(`[Platform Upload Error] Direct insert failed, trying with explicit ID:`, insertErr);
            const { data: maxData } = await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .select('id')
              .order('id', { ascending: false })
              .limit(1);

            const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
            platformPayload.id = isNaN(maxId) ? 1 : maxId + 1;

            let { error: insertErr2 } = await supabase
              .from(SUPABASE_TABLES.influencerPlatform)
              .insert([platformPayload]);

            if (insertErr2 && insertErr2.message?.includes('average')) {
              const safePayload = { ...platformPayload };
              delete safePayload.average;
              delete safePayload.id;
              const { error: err3 } = await supabase.from(SUPABASE_TABLES.influencerPlatform).insert([safePayload]);
              if (err3) console.error(`[Platform Upload Error] Fallback insert failed:`, err3);
            }
          }
        }

        // Sync influencersInfo table & views_data JSON
        const matchedInf = existingInfluencers.find(i => String(i.id) === String(infId));
        if (matchedInf) {
          const currentLangs = Array.isArray(matchedInf.languages) ? matchedInf.languages : [];
          let viewsDataObj: any = { platform_views: {}, post_dates: [] };
          const existingViewsData = currentLangs.find((l: any) => typeof l === 'string' && l.startsWith('views_data:'));
          if (existingViewsData) {
            try {
              viewsDataObj = JSON.parse(existingViewsData.substring('views_data:'.length));
            } catch (e) {}
          }
          if (!viewsDataObj.platform_views) viewsDataObj.platform_views = {};

          viewsDataObj.platform_views[platformName] = {
            username: rec.username || matchedPlatRow?.username || '',
            followers: rec.followers > 0 ? rec.followers : (matchedPlatRow?.followers_count || 0),
            views: mergedViews,
            profile_link: rec.profileLink || matchedPlatRow?.profile_link || '',
            creator_category: rec.category || matchedPlatRow?.performance_code || '',
            average: rec.average !== null ? rec.average : (matchedPlatRow?.average || null)
          };

          const updatedLangs = currentLangs.filter((l: any) => typeof l !== 'string' || !l.startsWith('views_data:'));
          updatedLangs.push(`views_data:${JSON.stringify(viewsDataObj)}`);

          const updatePayload: Record<string, any> = {
            languages: updatedLangs
          };
          if (rec.username && (!matchedInf.influencer_name || !matchedInf.name || matchedInf.name === matchedInf.code)) {
            updatePayload.influencer_name = rec.username;
            updatePayload.name = rec.username;
          }

          await supabase
            .from(SUPABASE_TABLES.influencersInfo)
            .update(updatePayload)
            .eq('id', infId);
        }

        recCount++;
        const fileProgress = totalRecords > 0 ? Math.round((recCount / totalRecords) * 100) : 100;
        setUploadProgress(prev => ({ ...prev, [platformName]: fileProgress }));
      }

      // Update Platform Availability automatically for affected influencers
      for (const infId of Array.from(affectedInfIds)) {
        const { data: allPlats } = await supabase
          .from(SUPABASE_TABLES.influencerPlatform)
          .select('platform, username, followers_count, video_views')
          .eq('influencer_id', infId);

        const activePlatforms = (allPlats || []).filter(p => {
          const hasUsername = Boolean(p.username && p.username.trim());
          const hasFollowers = Number(p.followers_count) > 0;
          const hasViews = Array.isArray(p.video_views) && p.video_views.some((v: any) => Number(v) > 0);
          return hasUsername || hasFollowers || hasViews;
        }).map(p => normalizePlatformName(p.platform).toLowerCase());

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
          .update({ platform_availability: newAvailability })
          .eq('id', infId);
      }

      notifyInfluencerChange(campaign.id);

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

        {/* Modal Body */}
        <div className="p-6">
          {/* STEP 1: FILE SELECTION */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Instagram Dropzone */}
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-200 text-sm flex items-center gap-2">
                        Instagram
                      </span>
                      {instaFile && (
                        <span className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-mono">
                          Ready ({instaFile.parsedRecords.length})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-4">Upload Instagram platform stats Excel/CSV file</p>
                  </div>

                  <div>
                    <input 
                      type="file" 
                      ref={instaInputRef} 
                      accept=".xlsx,.xls,.csv" 
                      onChange={(e) => handleFileSelect(e, 'Instagram')} 
                      className="hidden" 
                    />
                    
                    {instaFile ? (
                      <div className="space-y-2">
                        <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs flex items-center justify-between">
                          <span className="font-medium text-slate-200 truncate max-w-[140px]">{instaFile.file.name}</span>
                          <button onClick={() => handleRemoveFile('Instagram')} className="text-slate-400 hover:text-red-400 ml-1">
                            <X size={14} />
                          </button>
                        </div>
                        {instaFile.validationError && (
                          <p className="text-[11px] text-red-400 flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {instaFile.validationError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => instaInputRef.current?.click()}
                        className="w-full py-2 bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Upload size={14} /> Upload Instagram File
                      </button>
                    )}
                  </div>
                </div>

                {/* YouTube Dropzone */}
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-200 text-sm flex items-center gap-2">
                        YouTube
                      </span>
                      {ytFile && (
                        <span className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-mono">
                          Ready ({ytFile.parsedRecords.length})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-4">Upload YouTube platform stats Excel/CSV file</p>
                  </div>

                  <div>
                    <input 
                      type="file" 
                      ref={ytInputRef} 
                      accept=".xlsx,.xls,.csv" 
                      onChange={(e) => handleFileSelect(e, 'YouTube')} 
                      className="hidden" 
                    />
                    
                    {ytFile ? (
                      <div className="space-y-2">
                        <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs flex items-center justify-between">
                          <span className="font-medium text-slate-200 truncate max-w-[140px]">{ytFile.file.name}</span>
                          <button onClick={() => handleRemoveFile('YouTube')} className="text-slate-400 hover:text-red-400 ml-1">
                            <X size={14} />
                          </button>
                        </div>
                        {ytFile.validationError && (
                          <p className="text-[11px] text-red-400 flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {ytFile.validationError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => ytInputRef.current?.click()}
                        className="w-full py-2 bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Upload size={14} /> Upload YouTube File
                      </button>
                    )}
                  </div>
                </div>

                {/* Facebook Dropzone */}
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-slate-200 text-sm flex items-center gap-2">
                        Facebook
                      </span>
                      {fbFile && (
                        <span className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-2 py-0.5 rounded font-mono">
                          Ready ({fbFile.parsedRecords.length})
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-4">Upload Facebook platform stats Excel/CSV file</p>
                  </div>

                  <div>
                    <input 
                      type="file" 
                      ref={fbInputRef} 
                      accept=".xlsx,.xls,.csv" 
                      onChange={(e) => handleFileSelect(e, 'Facebook')} 
                      className="hidden" 
                    />
                    
                    {fbFile ? (
                      <div className="space-y-2">
                        <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs flex items-center justify-between">
                          <span className="font-medium text-slate-200 truncate max-w-[140px]">{fbFile.file.name}</span>
                          <button onClick={() => handleRemoveFile('Facebook')} className="text-slate-400 hover:text-red-400 ml-1">
                            <X size={14} />
                          </button>
                        </div>
                        {fbFile.validationError && (
                          <p className="text-[11px] text-red-400 flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {fbFile.validationError}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => fbInputRef.current?.click()}
                        className="w-full py-2 bg-purple-600/90 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Upload size={14} /> Upload Facebook File
                      </button>
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
                      These codes do not exist in the current campaign and will be skipped.
                    </p>
                  </div>
                )}
              </div>

              {/* Platform Selector Tabs */}
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
                    <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-64">
                      <table className="w-full text-left text-xs text-slate-300 min-w-[1400px]">
                        <thead className="bg-slate-800/90 text-slate-400 font-semibold sticky top-0 z-20">
                          <tr>
                            <th className="p-2.5 sticky left-0 bg-slate-900 z-30 shadow-md">Code</th>
                            <th className="p-2.5 sticky left-16 bg-slate-900 z-30 shadow-md">Username</th>
                            <th className="p-2.5">Followers</th>
                            <th className="p-2.5">Creator Category</th>
                            <th className="p-2.5">Average Views</th>
                            {Array.from({ length: 15 }, (_, i) => (
                              <th key={i} className="p-2.5 whitespace-nowrap text-center">Video {i + 1}</th>
                            ))}
                            <th className="p-2.5 sticky right-0 bg-slate-900 z-30 shadow-md">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {activeFile.parsedRecords.slice(0, 50).map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="p-2.5 font-mono font-bold text-slate-200 sticky left-0 bg-slate-900 z-10">{r.code || '—'}</td>
                              <td className="p-2.5 text-slate-300 truncate max-w-[120px] sticky left-16 bg-slate-900 z-10" title={r.username}>{r.username || '—'}</td>
                              <td className="p-2.5 text-slate-300">{r.followers ? r.followers.toLocaleString() : '0'}</td>
                              <td className="p-2.5 font-mono text-purple-300">{r.category || '—'}</td>
                              <td className="p-2.5 text-slate-300">{r.average !== null ? r.average.toLocaleString() : '0'}</td>
                              {Array.from({ length: 15 }, (_, vIdx) => {
                                const val = r.videoViews?.[vIdx];
                                return (
                                  <td key={vIdx} className="p-2.5 text-center font-mono text-slate-300 text-[11px]">
                                    {val !== undefined && val !== null ? (val === 0 ? '0' : val.toLocaleString()) : '—'}
                                  </td>
                                );
                              })}
                              <td className="p-2.5 sticky right-0 bg-slate-900 z-10">
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

              {/* Action Bar */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button 
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition-colors"
                >
                  Back
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
                <p className="text-xs text-slate-400">Updating platform records in Supabase database</p>
              </div>
            </div>
          )}

          {/* STEP 4: DONE */}
          {step === 'done' && (
            <div className="py-6 space-y-6 text-center">
              <div className="w-16 h-16 bg-green-950/60 border border-green-800/40 rounded-full flex items-center justify-center mx-auto text-green-400">
                <Check size={32} />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-1">Import Successful!</h4>
                <p className="text-xs text-slate-400">{stats.matchedCount} influencer platform records updated.</p>
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
