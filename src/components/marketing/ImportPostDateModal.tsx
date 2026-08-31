import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Loader2,
  AlertCircle,
  Check
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import toast from 'react-hot-toast';

interface ImportPostDateModalProps {
  campaign: Campaign;
  existingInfluencers: CampaignInfluencer[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface ParsedPostDateRow {
  code: string;
  username: string;
  videoDates: Record<number, string>; // video_number -> post_date string
  isValid: boolean;
  reason?: string;
  matchedInfluencerId?: string | number;
}

export const ImportPostDateModal: React.FC<ImportPostDateModalProps> = ({
  campaign,
  existingInfluencers,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedPostDateRow[]>([]);
  const [validationError, setValidationError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  };

  const normalizeDateStr = (val: any): string => {
    if (val === undefined || val === null || val === '') return '';
    
    // Date object
    if (val instanceof Date) {
      if (!isNaN(val.getTime())) {
        const day = String(val.getDate()).padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNames[val.getMonth()];
        const year = val.getFullYear();
        return `${day}-${month}-${year}`;
      }
    }

    // Number or numeric string (Excel serial date)
    const numVal = typeof val === 'number' ? val : (typeof val === 'string' && /^\d{5}$/.test(val.trim()) ? Number(val.trim()) : NaN);
    if (!isNaN(numVal)) {
      try {
        const parsedObj = XLSX.SSF.parse_date_code(numVal);
        if (parsedObj && parsedObj.y && parsedObj.m && parsedObj.d) {
          const day = String(parsedObj.d).padStart(2, '0');
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = monthNames[parsedObj.m - 1] || String(parsedObj.m).padStart(2, '0');
          const year = String(parsedObj.y);
          return `${day}-${month}-${year}`;
        }
      } catch (err) {}
    }

    const str = String(val).trim();
    if (!str || str === '—' || str === '-') return '';

    // Handle DD-MMM-YYYY (e.g. 22-Sep-2026 or 1-Oct-2026)
    if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
      const parts = str.split('-');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].substring(0, 1).toUpperCase() + parts[1].substring(1).toLowerCase();
      const year = parts[2];
      return `${day}-${month}-${year}`;
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY or YYYY-MM-DD
    const parts = str.split(/[-/.]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        const mStr = monthNames[mIdx] || parts[1].padStart(2, '0');
        return `${parts[2].padStart(2, '0')}-${mStr}-${parts[0]}`;
      } else if (parts[2].length === 4) {
        // DD-MM-YYYY
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const mIdx = parseInt(parts[1], 10) - 1;
        const mStr = isNaN(mIdx) ? parts[1] : (monthNames[mIdx] || parts[1].padStart(2, '0'));
        return `${parts[0].padStart(2, '0')}-${mStr}-${parts[2]}`;
      }
    }

    return str;
  };

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationError(undefined);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let targetSheetName = workbook.SheetNames.find(s => s.trim().toLowerCase() === 'post date' || s.trim().toLowerCase() === 'postdate');
        if (!targetSheetName) {
          targetSheetName = workbook.SheetNames[0];
        }

        const worksheet = workbook.Sheets[targetSheetName];
        const rawData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

        if (!rawData || rawData.length === 0) {
          setValidationError('File is empty or has no data rows');
          setParsedRecords([]);
          return;
        }

        const headers = Object.keys(rawData[0] || {});
        const codeKey = findColumnKey(headers, ['influencer code', 'influencercode', 'influencer_code', 'code', 's no code']);
        const usernameKey = findColumnKey(headers, ['user name', 'username', 'user_name', 'name']);

        if (!codeKey) {
          setValidationError('Required column missing: Influencer Code');
          setParsedRecords([]);
          return;
        }

        const influencerCodeMap = new Map<string, CampaignInfluencer>();
        existingInfluencers.forEach(inf => {
          const c = (inf.code || (inf as any).influencer_code || '').trim().toUpperCase();
          if (c) {
            influencerCodeMap.set(c, inf);
          }
        });

        const rows: ParsedPostDateRow[] = rawData.map(row => {
          const rawCode = cleanStr(row[codeKey]).toUpperCase();
          if (!rawCode) {
            return {
              code: '',
              username: '',
              videoDates: {},
              isValid: false,
              reason: 'Missing Influencer Code'
            };
          }

          const matchedInf = influencerCodeMap.get(rawCode);
          const username = usernameKey ? cleanStr(row[usernameKey]) : (matchedInf?.name || matchedInf?.influencer_name || '');
          
          const videoDates: Record<number, string> = {};

          for (let v = 1; v <= 15; v++) {
            const possibleNames = [
              `video ${v} post date`,
              `video_${v}_post_date`,
              `video${v}postdate`,
              `video ${v} postdate`,
              `video ${v} date`,
              `video_${v}_date`,
              `video${v}date`,
              `v${v} post date`,
              `v${v}postdate`,
              `v${v}date`,
              `post date ${v}`,
              `postdate ${v}`,
              `postdate${v}`,
              `post_date_${v}`,
              `pdate${v}`
            ];
            if (v === 1) {
              possibleNames.push('post date', 'postdate', 'post_date', 'date');
            }

            const dateKey = findColumnKey(headers, possibleNames);

            if (dateKey && row[dateKey] !== undefined && row[dateKey] !== null && String(row[dateKey]).trim() !== '') {
              const normDate = normalizeDateStr(row[dateKey]);
              if (normDate) {
                videoDates[v] = normDate;
                console.log(`[Post Date Import Debug] Influencer Code: ${rawCode}, Video ${v} Col: "${dateKey}", Raw: "${row[dateKey]}", Parsed: "${normDate}"`);
              }
            }
          }

          return {
            code: rawCode,
            username,
            videoDates,
            isValid: true,
            matchedInfluencerId: matchedInf ? matchedInf.id : undefined,
            reason: matchedInf ? undefined : 'Influencer Not Found'
          };
        });

        setParsedRecords(rows);
      } catch (err: any) {
        console.error(err);
        setValidationError(`Error parsing file: ${err.message || String(err)}`);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
    e.target.value = '';
  };

  const matchedCount = new Set(parsedRecords.filter(r => r.isValid && r.matchedInfluencerId !== undefined).map(r => r.matchedInfluencerId)).size;
  const unmatchedCodes = Array.from(new Set(parsedRecords.filter(r => r.isValid && r.matchedInfluencerId === undefined).map(r => r.code)));
  const invalidCount = parsedRecords.filter(r => !r.isValid).length;

  // Execute Database Sync
  const handleConfirmImport = async () => {
    setStep('importing');
    setIsSaving(true);

    try {
      const validRecords = parsedRecords.filter(r => r.isValid && r.matchedInfluencerId !== undefined);
      let updatedCount = 0;

      for (const rec of validRecords) {
        const infId = rec.matchedInfluencerId!;
        const numericId = typeof infId === 'number' ? infId : parseInt(String(infId), 10);

        const { data: existingPostDates } = await supabase
          .from(SUPABASE_TABLES.influencerPostDates)
          .select('*')
          .eq('influencer_id', numericId)
          .eq('campaign_id', campaign.id);

        const existingMap = new Map((existingPostDates || []).map(ep => [ep.video_number, ep]));
        let hasChanges = false;

        for (const [vNumStr, dateStr] of Object.entries(rec.videoDates)) {
          const vNum = Number(vNumStr);
          if (!dateStr || isNaN(vNum)) continue;

          const calculatedDraft = normalizeDateStr(dateStr) ? (() => {
            try {
              let dateObj: Date | null = null;
              const str = String(dateStr).trim();
              if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
                const parts = str.split('-');
                const day = parseInt(parts[0], 10);
                const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const monthIdx = monthNames.indexOf(parts[1].toLowerCase());
                const year = parseInt(parts[2], 10);
                if (monthIdx !== -1) dateObj = new Date(year, monthIdx, day);
              } else {
                dateObj = new Date(str);
              }
              if (dateObj && !isNaN(dateObj.getTime())) {
                const draftObj = new Date(dateObj);
                draftObj.setDate(draftObj.getDate() - 3);
                const day = String(draftObj.getDate()).padStart(2, '0');
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const month = monthNames[draftObj.getMonth()];
                const year = draftObj.getFullYear();
                return `${day}-${month}-${year}`;
              }
            } catch (e) {}
            return null;
          })() : null;

          const existingRow = existingMap.get(vNum);

          if (existingRow?.id) {
            if (existingRow.post_date !== dateStr || !existingRow.draft_date) {
              await supabase
                .from(SUPABASE_TABLES.influencerPostDates)
                .update({
                  post_date: dateStr,
                  draft_date: calculatedDraft || existingRow.draft_date || null,
                  updated_at: new Date().toISOString()
                })
                .eq('id', existingRow.id);
              hasChanges = true;
            }
          } else {
            let { error: insertErr } = await supabase
              .from(SUPABASE_TABLES.influencerPostDates)
              .insert([{
                influencer_id: numericId,
                campaign_id: campaign.id,
                video_number: vNum,
                post_date: dateStr,
                draft_date: calculatedDraft
              }]);

            if (insertErr) {
              const { data: maxData } = await supabase
                .from(SUPABASE_TABLES.influencerPostDates)
                .select('id')
                .order('id', { ascending: false })
                .limit(1);

              const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
              const newId = isNaN(maxId) ? 1 : maxId + 1;

              await supabase
                .from(SUPABASE_TABLES.influencerPostDates)
                .insert([{
                  id: newId,
                  influencer_id: numericId,
                  campaign_id: campaign.id,
                  video_number: vNum,
                  post_date: dateStr,
                  draft_date: calculatedDraft
                }]);
            }
            hasChanges = true;
          }
        }

        // Sync influencersInfo table & views_data JSON post_dates
        const { data: freshInf } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .select('languages')
          .eq('id', numericId)
          .maybeSingle();

        if (freshInf) {
          const currentLangs = Array.isArray(freshInf.languages) ? freshInf.languages : [];
          let viewsDataObj: any = { platform_views: {}, post_dates: [] };
          const existingViewsData = currentLangs.find((l: any) => typeof l === 'string' && l.startsWith('views_data:'));
          if (existingViewsData) {
            try {
              viewsDataObj = JSON.parse(existingViewsData.substring('views_data:'.length));
            } catch (e) {}
          }
          if (!Array.isArray(viewsDataObj.post_dates)) viewsDataObj.post_dates = [];

          for (const [vNumStr, dateStr] of Object.entries(rec.videoDates)) {
            const vNum = Number(vNumStr);
            if (!dateStr || isNaN(vNum)) continue;

            const calculatedDraft = normalizeDateStr(dateStr) ? (() => {
              try {
                let dateObj: Date | null = null;
                const str = String(dateStr).trim();
                if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
                  const parts = str.split('-');
                  const day = parseInt(parts[0], 10);
                  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                  const monthIdx = monthNames.indexOf(parts[1].toLowerCase());
                  const year = parseInt(parts[2], 10);
                  if (monthIdx !== -1) dateObj = new Date(year, monthIdx, day);
                } else {
                  dateObj = new Date(str);
                }
                if (dateObj && !isNaN(dateObj.getTime())) {
                  const draftObj = new Date(dateObj);
                  draftObj.setDate(draftObj.getDate() - 3);
                  const day = String(draftObj.getDate()).padStart(2, '0');
                  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const month = monthNames[draftObj.getMonth()];
                  const year = draftObj.getFullYear();
                  return `${day}-${month}-${year}`;
                }
              } catch (e) {}
              return null;
            })() : null;

            const existingDateIdx = viewsDataObj.post_dates.findIndex((pd: any) => Number(pd.video_number) === vNum);
            if (existingDateIdx !== -1) {
              viewsDataObj.post_dates[existingDateIdx].post_date = dateStr;
              if (calculatedDraft) viewsDataObj.post_dates[existingDateIdx].draft_date = calculatedDraft;
            } else {
              viewsDataObj.post_dates.push({ video_number: vNum, post_date: dateStr, draft_date: calculatedDraft });
            }
          }

          const updatedLangs = currentLangs.filter((l: any) => typeof l !== 'string' || !l.startsWith('views_data:'));
          updatedLangs.push(`views_data:${JSON.stringify(viewsDataObj)}`);

          await supabase
            .from(SUPABASE_TABLES.influencersInfo)
            .update({ languages: updatedLangs })
            .eq('id', numericId);
        }

        if (hasChanges || Object.keys(rec.videoDates).length > 0) {
          updatedCount++;
        }
      }

      logActivity(
        'Marketing',
        'Post Date Bulk Upload',
        `Imported Post Date details for ${updatedCount} influencers in ${campaign.campaign_name}.`
      );

      setStep('done');
      toast.success(`Post Date imported successfully! ${updatedCount} influencers updated`);
    } catch (err: any) {
      console.error('Post Date import error:', err);
      toast.error(`Post Date import failed: ${err.message || String(err)}`);
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
              POST DATE UPLOAD
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload Post Date Excel File for existing influencers by Influencer Code
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
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-purple-500/50 transition-colors bg-slate-800/40">
                <FileSpreadsheet size={40} className="mx-auto text-slate-500 mb-3" />
                <h4 className="text-sm font-semibold text-slate-200 mb-1">Upload Post Date Spreadsheet</h4>
                <p className="text-xs text-slate-400 mb-4">Supported formats: Excel (.xlsx, .xls) or CSV (.csv)</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept=".xlsx,.xls,.csv" 
                  onChange={handleFileSelect} 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm"
                >
                  <Upload size={14} /> Choose File
                </button>

                {file && (
                  <div className="mt-4 p-3 bg-slate-900 border border-slate-700 rounded-lg max-w-sm mx-auto text-xs text-left flex items-center justify-between">
                    <span className="font-medium text-slate-200 truncate">{file.name}</span>
                    <button onClick={() => { setFile(null); setParsedRecords([]); }} className="text-slate-400 hover:text-red-400 ml-2">
                      <X size={14} />
                    </button>
                  </div>
                )}

                {validationError && (
                  <p className="mt-3 text-xs text-red-400 font-medium flex items-center justify-center gap-1">
                    <AlertCircle size={14} /> {validationError}
                  </p>
                )}
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Expected File Headers (Sheet: Post Date):</p>
                <p>• <span className="text-purple-300 font-mono">Influencer Code</span> (Required matching key)</p>
                <p>• <span className="text-slate-300 font-mono">Video 1 ... Video 6</span>, <span className="text-slate-300 font-mono">Post Date ... Post Date 6</span></p>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button onClick={onClose} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={() => setStep('preview')} 
                  disabled={!file || parsedRecords.length === 0 || !!validationError}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors shadow-sm"
                >
                  Validate & Preview
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white text-base mb-3 flex items-center justify-between">
                  <span>Ready to Import Post Dates</span>
                  <span className="text-xs bg-purple-950/60 text-purple-300 border border-purple-800/40 px-3 py-1 rounded-full font-mono">
                    {matchedCount} Matched Influencers
                  </span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Total Rows</span>
                    <span className="text-base font-bold text-slate-100">{parsedRecords.length}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Matched</span>
                    <span className="text-base font-bold text-green-400">{matchedCount}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Unmatched Codes</span>
                    <span className={`text-base font-bold ${unmatchedCodes.length > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                      {unmatchedCodes.length}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Skipped/Invalid</span>
                    <span className="text-base font-bold text-slate-400">{invalidCount}</span>
                  </div>
                </div>

                {unmatchedCodes.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-300">
                    <p className="font-semibold flex items-center gap-1.5 mb-1 text-amber-200">
                      <AlertTriangle size={14} /> Unmatched Influencer Codes ({unmatchedCodes.length}):
                    </p>
                    <p className="text-[11px] text-amber-300/80 font-mono mb-1">
                      {unmatchedCodes.slice(0, 10).join(', ')}
                      {unmatchedCodes.length > 10 ? ` ...and ${unmatchedCodes.length - 10} more` : ''}
                    </p>
                    <p className="text-[10px] text-amber-400/70">
                      These codes do not exist in the current campaign and will be skipped.
                    </p>
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Username</th>
                      <th className="p-2.5">Video 1 Date</th>
                      <th className="p-2.5">Video 2 Date</th>
                      <th className="p-2.5">Video 3 Date</th>
                      <th className="p-2.5">Video 4 Date</th>
                      <th className="p-2.5">Video 5 Date</th>
                      <th className="p-2.5">Video 6 Date</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {parsedRecords.slice(0, 50).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-slate-200">{r.code || '—'}</td>
                        <td className="p-2.5 text-slate-300">{r.username || '—'}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{r.videoDates[1] || '—'}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{r.videoDates[2] || '—'}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{r.videoDates[3] || '—'}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{r.videoDates[4] || '—'}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{r.videoDates[5] || '—'}</td>
                        <td className="p-2.5 text-slate-300 font-mono">{r.videoDates[6] || '—'}</td>
                        <td className="p-2.5">
                          {r.matchedInfluencerId !== undefined ? (
                            <span className="text-[10px] bg-green-950/50 text-green-400 border border-green-800/30 px-2 py-0.5 rounded font-bold">
                              ✓ Matched
                            </span>
                          ) : (
                            <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-800/30 px-2 py-0.5 rounded font-bold">
                              ⚠ Unmatched
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button onClick={() => setStep('upload')} className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={handleConfirmImport}
                  disabled={matchedCount === 0 || isSaving}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm Upload
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-8 space-y-6 text-center">
              <Loader2 size={40} className="animate-spin text-purple-500 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-white mb-1">Importing Post Dates...</h4>
                <p className="text-xs text-slate-400">Updating Post Date records for matched influencers</p>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-6 space-y-6 text-center">
              <div className="w-16 h-16 bg-green-950/60 border border-green-800/40 rounded-full flex items-center justify-center mx-auto text-green-400">
                <Check size={32} />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-1">Upload Complete</h4>
                <p className="text-xs text-slate-400">{matchedCount} records processed & updated.</p>
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
