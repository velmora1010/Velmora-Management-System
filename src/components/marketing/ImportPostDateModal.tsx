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
  Trash2,
  Check,
  Calendar
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import toast from 'react-hot-toast';
import { isActiveStatus } from '../../utils/marketingUtils';
import { 
  parseToYMD, 
  calculateDraftDate, 
  formatDisplayDateLocal 
} from '../../utils/influencerDateUtils';
import { notifyInfluencerChange } from '../../hooks/marketing/useCampaignInfluencers';

interface ImportPostDateModalProps {
  campaign: Campaign;
  existingInfluencers: CampaignInfluencer[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface ParsedPostDateRow {
  code: string;
  username: string;
  videoDates: Record<number, string>; // video_number -> canonical 'YYYY-MM-DD'
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
  const [importProgress, setImportProgress] = useState<{ stage: string; percent: number }>({
    stage: '',
    percent: 0
  });
  const [importStats, setImportStats] = useState<{
    totalRows: number;
    matchedInfluencers: number;
    totalPostDatesSaved: number;
    unmatchedCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim();
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
        
        let targetSheetName = workbook.SheetNames.find(
          s => s.trim().toLowerCase() === 'post date' || s.trim().toLowerCase() === 'postdate'
        );
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
          if (isActiveStatus(inf.is_archived)) {
            const c = (inf.code || (inf as any).influencer_code || '').trim().toUpperCase();
            if (c) {
              influencerCodeMap.set(c, inf);
            }
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
              const ymd = parseToYMD(row[dateKey], 2026);
              if (ymd) {
                videoDates[v] = ymd;
              }
            }
          }

          const datesFound = Object.keys(videoDates).length;

          return {
            code: rawCode,
            username,
            videoDates,
            isValid: true,
            matchedInfluencerId: matchedInf ? matchedInf.id : undefined,
            reason: matchedInf 
              ? (datesFound > 0 ? undefined : 'No valid dates found') 
              : 'Influencer Not Found'
          };
        });

        setParsedRecords(rows);
      } catch (err: any) {
        console.error('Post Date Excel parse error:', err);
        setValidationError(`Error parsing file: ${err.message || String(err)}`);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
    e.target.value = '';
  };

  const validRecords = parsedRecords.filter(
    r => r.isValid && r.matchedInfluencerId !== undefined && Object.keys(r.videoDates).length > 0
  );
  const matchedCount = new Set(validRecords.map(r => r.matchedInfluencerId)).size;
  const unmatchedCodes = Array.from(new Set(
    parsedRecords.filter(r => r.isValid && r.matchedInfluencerId === undefined).map(r => r.code)
  ));
  const noDatesCount = parsedRecords.filter(
    r => r.isValid && r.matchedInfluencerId !== undefined && Object.keys(r.videoDates).length === 0
  ).length;
  const invalidCount = parsedRecords.filter(r => !r.isValid).length;
  const totalVideoDatesCount = validRecords.reduce((sum, r) => sum + Object.keys(r.videoDates).length, 0);

  // Execute Database Sync
  const handleConfirmImport = async () => {
    if (validRecords.length === 0) {
      toast.error('No matched records with dates to import');
      return;
    }

    setStep('importing');
    setIsSaving(true);
    setImportProgress({ stage: 'Connecting to database...', percent: 10 });

    const dbClient = supabaseAdmin || supabase;
    const campaignIdStr = String(campaign.id);

    try {
      setImportProgress({ stage: 'Fetching existing post dates & sequence...', percent: 20 });

      // 1. Bulk fetch existing post dates and max ID in parallel
      const [existingPostDatesRes, maxIdRes] = await Promise.all([
        dbClient.from(SUPABASE_TABLES.influencerPostDates).select('*').eq('campaign_id', campaignIdStr),
        dbClient.from(SUPABASE_TABLES.influencerPostDates).select('id').order('id', { ascending: false }).limit(1)
      ]);

      if (existingPostDatesRes.error) {
        throw new Error(`Failed to fetch existing post dates: ${existingPostDatesRes.error.message}`);
      }

      const existingMap = new Map<string, any>();
      (existingPostDatesRes.data || []).forEach(ep => {
        existingMap.set(`${ep.influencer_id}_${ep.video_number}`, ep);
      });

      let nextId = maxIdRes.data && maxIdRes.data[0]?.id ? Number(maxIdRes.data[0].id) : 0;
      if (isNaN(nextId)) nextId = 0;

      // 2. Prepare inserts, updates, and profile sync data in-memory
      const now = new Date().toISOString();
      const rowsToInsert: any[] = [];
      const rowsToUpdate: any[] = [];
      const influencerDateChanges = new Map<number, { video_number: number; post_date: string; draft_date: string }[]>();

      for (const rec of validRecords) {
        const infId = typeof rec.matchedInfluencerId === 'number' 
          ? rec.matchedInfluencerId 
          : parseInt(String(rec.matchedInfluencerId), 10);
        
        const dateEntries: { video_number: number; post_date: string; draft_date: string }[] = [];

        for (const [vNumStr, postDate] of Object.entries(rec.videoDates)) {
          const vNum = Number(vNumStr);
          if (!postDate || isNaN(vNum)) continue;

          const draftDate = calculateDraftDate(postDate, 2026);
          dateEntries.push({ video_number: vNum, post_date: postDate, draft_date: draftDate });

          const key = `${infId}_${vNum}`;
          const existing = existingMap.get(key);

          if (existing?.id) {
            if (existing.post_date !== postDate || existing.draft_date !== draftDate) {
              rowsToUpdate.push({
                id: existing.id,
                post_date: postDate,
                draft_date: draftDate,
                updated_at: now
              });
            }
          } else {
            nextId++;
            rowsToInsert.push({
              id: nextId,
              influencer_id: infId,
              campaign_id: campaignIdStr,
              video_number: vNum,
              post_date: postDate,
              draft_date: draftDate,
              created_at: now,
              updated_at: now
            });
          }
        }

        if (dateEntries.length > 0) {
          influencerDateChanges.set(infId, dateEntries);
        }
      }

      // 3. Batch insert new records in chunks of 100
      const INSERT_CHUNK_SIZE = 100;
      for (let i = 0; i < rowsToInsert.length; i += INSERT_CHUNK_SIZE) {
        const chunk = rowsToInsert.slice(i, i + INSERT_CHUNK_SIZE);
        const progressPercent = 25 + Math.round((i / (rowsToInsert.length || 1)) * 30);
        setImportProgress({
          stage: `Saving new post dates (${Math.min(i + INSERT_CHUNK_SIZE, rowsToInsert.length)} of ${rowsToInsert.length})...`,
          percent: progressPercent
        });
        const { error: insErr } = await dbClient
          .from(SUPABASE_TABLES.influencerPostDates)
          .insert(chunk);
        if (insErr) {
          throw new Error(`Database insert error: ${insErr.message}`);
        }
      }

      // 4. Update modified records in concurrent chunks of 10
      const UPDATE_CHUNK_SIZE = 10;
      for (let i = 0; i < rowsToUpdate.length; i += UPDATE_CHUNK_SIZE) {
        const chunk = rowsToUpdate.slice(i, i + UPDATE_CHUNK_SIZE);
        const progressPercent = 55 + Math.round((i / (rowsToUpdate.length || 1)) * 20);
        setImportProgress({
          stage: `Updating existing post dates (${Math.min(i + UPDATE_CHUNK_SIZE, rowsToUpdate.length)} of ${rowsToUpdate.length})...`,
          percent: progressPercent
        });
        await Promise.all(
          chunk.map(row => 
            dbClient
              .from(SUPABASE_TABLES.influencerPostDates)
              .update({
                post_date: row.post_date,
                draft_date: row.draft_date,
                updated_at: row.updated_at
              })
              .eq('id', row.id)
          )
        );
      }

      // 5. Synchronize influencersInfo table (views_data.post_dates) for calendar/list sync
      const infIdsToSync: number[] = [];
      influencerDateChanges.forEach((_, id) => {
        infIdsToSync.push(id);
      });

      if (infIdsToSync.length > 0) {
        setImportProgress({ stage: 'Synchronizing influencer view profiles...', percent: 80 });

        const allInfData: { id: number; languages: any }[] = [];
        for (let i = 0; i < infIdsToSync.length; i += 100) {
          const sliceIds = infIdsToSync.slice(i, i + 100);
          const { data: infSlice, error: fetchInfErr } = await dbClient
            .from(SUPABASE_TABLES.influencersInfo)
            .select('id, languages')
            .in('id', sliceIds);
          if (fetchInfErr) {
            console.warn('Could not fetch languages for batch:', fetchInfErr);
          } else if (infSlice) {
            allInfData.push(...infSlice);
          }
        }

        const infDataMap = new Map(allInfData.map(d => [d.id, d.languages]));
        const infUpdates: { id: number; languages: any[] }[] = [];

        influencerDateChanges.forEach((newDates, infId) => {
          const currentLangs = Array.isArray(infDataMap.get(infId)) ? infDataMap.get(infId) : [];
          let viewsDataObj: any = { platform_views: {}, post_dates: [] };
          const existingViewsData = currentLangs.find((l: any) => typeof l === 'string' && l.startsWith('views_data:'));
          if (existingViewsData) {
            try {
              viewsDataObj = JSON.parse(existingViewsData.substring('views_data:'.length));
            } catch (e) {}
          }
          if (!Array.isArray(viewsDataObj.post_dates)) viewsDataObj.post_dates = [];

          for (const d of newDates) {
            const existingIdx = viewsDataObj.post_dates.findIndex((pd: any) => Number(pd.video_number) === d.video_number);
            if (existingIdx !== -1) {
              viewsDataObj.post_dates[existingIdx].post_date = d.post_date;
              viewsDataObj.post_dates[existingIdx].draft_date = d.draft_date;
            } else {
              viewsDataObj.post_dates.push({ video_number: d.video_number, post_date: d.post_date, draft_date: d.draft_date });
            }
          }

          const updatedLangs = currentLangs.filter((l: any) => typeof l !== 'string' || !l.startsWith('views_data:'));
          updatedLangs.push(`views_data:${JSON.stringify(viewsDataObj)}`);
          infUpdates.push({ id: infId, languages: updatedLangs });
        });

        for (let i = 0; i < infUpdates.length; i += 10) {
          const chunk = infUpdates.slice(i, i + 10);
          await Promise.all(
            chunk.map(u => 
              dbClient
                .from(SUPABASE_TABLES.influencersInfo)
                .update({ languages: u.languages })
                .eq('id', u.id)
            )
          );
        }
      }

      setImportProgress({ stage: 'Finalizing...', percent: 100 });

      // 6. Log activity and broadcast updates
      logActivity(
        'Marketing',
        'Post Date Bulk Upload',
        `Imported Post Date details for ${validRecords.length} influencers (${rowsToInsert.length + rowsToUpdate.length} video dates) in ${campaign.campaign_name}.`
      );

      notifyInfluencerChange(campaign.id);

      setImportStats({
        totalRows: parsedRecords.length,
        matchedInfluencers: validRecords.length,
        totalPostDatesSaved: rowsToInsert.length + rowsToUpdate.length,
        unmatchedCount: unmatchedCodes.length
      });

      setStep('done');
      toast.success(`Post Dates imported! ${validRecords.length} influencers updated.`);
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
              <Calendar size={18} className="text-purple-400" />
              POST DATE UPLOAD
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload Post Date Excel File for existing influencers by Influencer Code
            </p>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Upload size={14} /> Choose File
                </button>

                {file && (
                  <div className="mt-4 p-3.5 bg-emerald-950/30 border border-emerald-800/50 rounded-xl max-w-md mx-auto text-xs text-left flex items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-emerald-900/40 rounded-lg shrink-0">
                        <FileSpreadsheet className="text-emerald-400" size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-100 truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={10} /> {(file.size / 1024).toFixed(1)} KB • {parsedRecords.length} records parsed
                        </div>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => { setFile(null); setParsedRecords([]); }} 
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
                      title="Remove File"
                    >
                      <Trash2 size={14} />
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
                <p className="font-semibold text-slate-300">Expected File Headers (Sheet: Post Date or Sheet1):</p>
                <p>• <span className="text-purple-300 font-mono">Influencer Code</span> (Required matching key)</p>
                <p>• <span className="text-slate-300 font-mono">Video 1 Post Date ... Video 6 Post Date</span> (or Post Date 1...)</p>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button 
                  onClick={onClose} 
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setStep('preview')} 
                  disabled={!file || parsedRecords.length === 0 || !!validationError}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h4 className="font-bold text-white text-base">
                    Ready to Import Post Dates
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-purple-950/60 text-purple-300 border border-purple-800/40 px-3 py-1 rounded-full font-mono">
                      {matchedCount} Matched Influencers
                    </span>
                    <span className="text-xs bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-3 py-1 rounded-full font-mono">
                      {totalVideoDatesCount} Dates Found
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Total Rows</span>
                    <span className="text-base font-bold text-slate-100">{parsedRecords.length}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Matched & Valid</span>
                    <span className="text-base font-bold text-green-400">{matchedCount}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Unmatched Codes</span>
                    <span className={`text-base font-bold ${unmatchedCodes.length > 0 ? 'text-amber-400' : 'text-slate-100'}`}>
                      {unmatchedCodes.length}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700/80">
                    <span className="text-slate-400 block text-[11px]">Empty / No Dates</span>
                    <span className="text-base font-bold text-slate-400">{noDatesCount + invalidCount}</span>
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
                    {parsedRecords.slice(0, 60).map((r, idx) => {
                      const isMatched = r.matchedInfluencerId !== undefined;
                      const hasDates = Object.keys(r.videoDates).length > 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono font-bold text-slate-200">{r.code || '—'}</td>
                          <td className="p-2.5 text-slate-300 truncate max-w-[120px]">{r.username || '—'}</td>
                          <td className="p-2.5 text-slate-300 font-mono">{formatDisplayDateLocal(r.videoDates[1])}</td>
                          <td className="p-2.5 text-slate-300 font-mono">{formatDisplayDateLocal(r.videoDates[2])}</td>
                          <td className="p-2.5 text-slate-300 font-mono">{formatDisplayDateLocal(r.videoDates[3])}</td>
                          <td className="p-2.5 text-slate-300 font-mono">{formatDisplayDateLocal(r.videoDates[4])}</td>
                          <td className="p-2.5 text-slate-300 font-mono">{formatDisplayDateLocal(r.videoDates[5])}</td>
                          <td className="p-2.5 text-slate-300 font-mono">{formatDisplayDateLocal(r.videoDates[6])}</td>
                          <td className="p-2.5">
                            {isMatched ? (
                              hasDates ? (
                                <span className="text-[10px] bg-green-950/50 text-green-400 border border-green-800/30 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                  ✓ Matched
                                </span>
                              ) : (
                                <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-medium whitespace-nowrap">
                                  No Dates
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] bg-amber-950/50 text-amber-400 border border-amber-800/30 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                ⚠ Unmatched
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {parsedRecords.length > 60 && (
                <p className="text-[11px] text-slate-500 text-right italic">
                  Showing first 60 of {parsedRecords.length} rows
                </p>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button 
                  onClick={() => setStep('upload')} 
                  className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg text-sm transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button 
                  onClick={handleConfirmImport}
                  disabled={matchedCount === 0 || isSaving}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Confirm Upload ({matchedCount} Influencers)
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-12 px-4 space-y-6 text-center max-w-md mx-auto">
              <Loader2 size={44} className="animate-spin text-purple-500 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-white mb-1">Importing Post Dates...</h4>
                <p className="text-xs text-slate-400">{importProgress.stage || 'Updating Post Date records for matched influencers'}</p>
              </div>

              {/* Live Progress Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                <div 
                  className="bg-purple-600 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${importProgress.percent}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Please keep this window open while records are being safely committed to the database.
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 space-y-6 text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-emerald-950/60 border border-emerald-800/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-lg">
                <Check size={32} />
              </div>

              <div>
                <h4 className="text-xl font-bold text-white mb-1">Upload Complete</h4>
                <p className="text-xs text-slate-400">
                  Successfully imported and synchronized Post Dates.
                </p>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 text-left space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Matched Influencers Updated:</span>
                  <span className="font-bold text-emerald-400">{importStats?.matchedInfluencers ?? matchedCount}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span className="text-slate-400">Total Video Post Dates Saved:</span>
                  <span className="font-bold text-purple-300">{importStats?.totalPostDatesSaved ?? totalVideoDatesCount}</span>
                </div>
                {importStats && importStats.unmatchedCount > 0 && (
                  <div className="flex justify-between py-1 border-b border-slate-700/50">
                    <span className="text-slate-400">Unmatched Codes Skipped:</span>
                    <span className="font-bold text-amber-400">{importStats.unmatchedCount}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-bold text-green-400">Active & Synchronized</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
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
