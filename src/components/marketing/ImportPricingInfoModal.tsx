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
  Check
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import toast from 'react-hot-toast';

interface ImportPricingInfoModalProps {
  campaign: Campaign;
  existingInfluencers: CampaignInfluencer[];
  onClose: () => void;
  onSuccess: () => void;
}

export interface ParsedPricingRow {
  code: string;
  username: string;
  totalVideos: number;
  finalPrice: number;
  videoPricingList: { combination: string; amount: number }[];
  isValid: boolean;
  reason?: string;
  matchedInfluencerId?: string | number;
}

export const ImportPricingInfoModal: React.FC<ImportPricingInfoModalProps> = ({
  campaign,
  existingInfluencers,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<ParsedPricingRow[]>([]);
  const [validationError, setValidationError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanStr = (val: any): string => {
    if (val === undefined || val === null) return '';
    return String(val).trim();
  };

  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    let str = String(val).trim().toUpperCase().replace(/₹/g, '').replace(/,/g, '').trim();
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
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!matrix || matrix.length < 2) {
          setValidationError('File is empty or has no data rows');
          setParsedRecords([]);
          return;
        }

        const headerRow: string[] = (matrix[0] || []).map(h => cleanStr(h));
        const normHeaders = headerRow.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        // 1. Find Influencer Code column index
        let codeColIdx = normHeaders.findIndex(h => ['influencercode', 'code', 'influencer_code', 'snocode'].includes(h));
        if (codeColIdx === -1) {
          codeColIdx = normHeaders.findIndex(h => h.includes('code'));
        }

        if (codeColIdx === -1) {
          setValidationError('Required column missing: Influencer Code');
          setParsedRecords([]);
          return;
        }

        // 2. Find Username column index
        let usernameColIdx = normHeaders.findIndex(h => ['username', 'user_name', 'name'].includes(h));
        if (usernameColIdx === -1) {
          usernameColIdx = normHeaders.findIndex(h => h.includes('user') || h.includes('name'));
        }

        // 3. Find explicit Final Price column index (if any)
        let finalPriceColIdx = normHeaders.findIndex(h => ['finalprice', 'final_price', 'commercialquote', 'commercial_quote', 'totalprice', 'total_price'].includes(h));

        // 4. Find Video + Amount column pairs by position
        interface VideoPair {
          videoColIdx: number;
          amountColIdx: number;
          videoNum: number;
        }

        const pairs: VideoPair[] = [];

        for (let c = 0; c < headerRow.length; c++) {
          const normH = normHeaders[c];
          if (normH.startsWith('video') || (normH.startsWith('v') && /^v\d+$/.test(normH)) || normH.includes('video')) {
            const vMatch = normH.match(/\d+/);
            const vNum = vMatch ? parseInt(vMatch[0], 10) : (pairs.length + 1);

            let amtIdx = -1;
            if (c + 1 < headerRow.length && normHeaders[c + 1].includes('amount')) {
              amtIdx = c + 1;
            } else {
              for (let lookahead = c + 1; lookahead < headerRow.length; lookahead++) {
                if (normHeaders[lookahead].startsWith('video') || (normHeaders[lookahead].startsWith('v') && /^v\d+$/.test(normHeaders[lookahead]))) {
                  break;
                }
                if (normHeaders[lookahead].includes('amount')) {
                  amtIdx = lookahead;
                  break;
                }
              }
            }

            pairs.push({
              videoColIdx: c,
              amountColIdx: amtIdx,
              videoNum: vNum
            });
          }
        }

        const influencerCodeMap = new Map<string, CampaignInfluencer>();
        existingInfluencers.forEach(inf => {
          const c = (inf.code || (inf as any).influencer_code || '').trim().toUpperCase();
          if (c) {
            influencerCodeMap.set(c, inf);
          }
        });

        const rows: ParsedPricingRow[] = [];

        for (let r = 1; r < matrix.length; r++) {
          const rowData = matrix[r];
          if (!rowData || rowData.length === 0) continue;

          const rawCode = cleanStr(rowData[codeColIdx]).toUpperCase();
          if (!rawCode) continue;

          const matchedInf = influencerCodeMap.get(rawCode);
          const username = usernameColIdx !== -1 ? cleanStr(rowData[usernameColIdx]) : (matchedInf?.name || matchedInf?.influencer_name || '');

          const videoPricingList: { combination: string; amount: number }[] = [];
          let sumAmount = 0;

          for (const pair of pairs) {
            const combName = cleanStr(rowData[pair.videoColIdx]);
            const amtRaw = pair.amountColIdx !== -1 ? rowData[pair.amountColIdx] : '';
            const amtVal = parseNum(amtRaw);

            if (combName || amtVal > 0) {
              videoPricingList.push({
                combination: combName || `Video ${pair.videoNum}`,
                amount: amtVal
              });
              sumAmount += amtVal;
            }
          }

          const explicitFinalPrice = finalPriceColIdx !== -1 ? parseNum(rowData[finalPriceColIdx]) : 0;
          const finalPrice = explicitFinalPrice > 0 ? explicitFinalPrice : sumAmount;
          const totalVideos = videoPricingList.length;

          rows.push({
            code: rawCode,
            username,
            totalVideos,
            finalPrice,
            videoPricingList,
            isValid: true,
            matchedInfluencerId: matchedInf ? matchedInf.id : undefined,
            reason: matchedInf ? undefined : 'Unmatched Influencer Code'
          });
        }

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

  const handleConfirmImport = async () => {
    setStep('importing');
    setIsSaving(true);

    try {
      const validRecords = parsedRecords.filter(r => r.isValid && r.matchedInfluencerId !== undefined);
      let updatedCount = 0;

      for (const rec of validRecords) {
        const infId = rec.matchedInfluencerId!;

        // Fetch existing pricing for this influencer
        const { data: existingPricing } = await supabase
          .from(SUPABASE_TABLES.influencerPricing)
          .select('*')
          .eq('influencer_id', infId)
          .single();

        const video1Amt = rec.videoPricingList[0]?.amount || rec.finalPrice || 0;
        const video2Amt = rec.videoPricingList[1]?.amount || 0;
        const v1c = rec.totalVideos >= 1 ? 1 : 0;
        const v2c = rec.totalVideos >= 2 ? rec.totalVideos - 1 : 0;

        const prodPricingObj = {
          videos: rec.videoPricingList.map((v, i) => ({
            combination: v.combination,
            amount: v.amount,
            products: []
          }))
        };

        const pricingPayload: Record<string, any> = {
          influencer_id: infId,
          video1_count: v1c,
          video1_price: video1Amt,
          video2_count: v2c,
          video2_price: video2Amt,
          total_videos: rec.totalVideos,
          final_price: rec.finalPrice,
          product_pricing: prodPricingObj
        };

        if (existingPricing?.id) {
          await supabase
            .from(SUPABASE_TABLES.influencerPricing)
            .update(pricingPayload)
            .eq('id', existingPricing.id);
        } else {
          const { data: maxData } = await supabase
            .from(SUPABASE_TABLES.influencerPricing)
            .select('id')
            .order('id', { ascending: false })
            .limit(1);

          const maxId = maxData && maxData.length > 0 ? Number(maxData[0].id) : 0;
          pricingPayload.id = isNaN(maxId) ? 1 : maxId + 1;

          await supabase
            .from(SUPABASE_TABLES.influencerPricing)
            .insert([pricingPayload]);
        }

        updatedCount++;
      }

      logActivity(
        'Marketing',
        'Pricing Info Imported',
        `Imported Pricing Info for ${updatedCount} influencers in ${campaign.campaign_name}.`
      );

      setStep('done');
      toast.success(`Pricing Info imported successfully! ${updatedCount} influencers updated`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Pricing import failed: ${err.message || String(err)}`);
      setStep('preview');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Upload size={18} className="text-purple-400" />
              Import Pricing Info
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Upload pricing data for existing influencers by Influencer Code
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
                <h4 className="text-sm font-semibold text-slate-200 mb-1">Upload Pricing Spreadsheet</h4>
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
                <p className="font-semibold text-slate-300">Expected File Headers:</p>
                <p>• <span className="text-purple-300 font-mono">Influencer Code</span> (Required matching key)</p>
                <p>• <span className="text-slate-300 font-mono">Video 1 ... Video 15</span>, <span className="text-slate-300 font-mono">Amount 1 ... Amount 15</span> or <span className="text-slate-300 font-mono">Final Price</span></p>
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
              {/* Summary */}
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-white text-base mb-3 flex items-center justify-between">
                  <span>Ready to Import Pricing</span>
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
              <div className="border border-slate-800 rounded-lg overflow-x-auto max-h-56">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Username</th>
                      <th className="p-2.5">Total Videos</th>
                      <th className="p-2.5">Final Price</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {parsedRecords.slice(0, 50).map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono font-bold text-slate-200">{r.code || '—'}</td>
                        <td className="p-2.5 text-slate-300">{r.username || '—'}</td>
                        <td className="p-2.5 text-slate-300">{r.totalVideos}</td>
                        <td className="p-2.5 font-bold text-purple-300">₹{r.finalPrice.toLocaleString()}</td>
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
                  Confirm Import
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-8 space-y-6 text-center">
              <Loader2 size={40} className="animate-spin text-purple-500 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-white mb-1">Importing Pricing Info...</h4>
                <p className="text-xs text-slate-400">Updating pricing records for matched influencers</p>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="py-6 space-y-6 text-center">
              <div className="w-16 h-16 bg-green-950/60 border border-green-800/40 rounded-full flex items-center justify-center mx-auto text-green-400">
                <Check size={32} />
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-1">Pricing Info Imported Successfully</h4>
                <p className="text-xs text-slate-400">{matchedCount} influencers updated with new pricing data.</p>
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
