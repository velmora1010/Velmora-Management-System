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
  HelpCircle
} from 'lucide-react';
import type { Campaign, CampaignInfluencer } from '../../types';
import { useCampaignInfluencers, notifyInfluencerChange } from '../../hooks/marketing/useCampaignInfluencers';
import { supabase } from '../../lib/supabase';
import { SUPABASE_TABLES } from '../../config/supabaseTables';
import { logActivity } from '../../services/activityService';
import toast from 'react-hot-toast';

interface BulkInfluencerImportModalProps {
  campaign: Campaign;
  existingInfluencers: CampaignInfluencer[];
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  code: string;
  name: string; // Influencer Name
  userId: string; // Username / User ID
  phone: string | null;
  altPhone: string | null;
  upi: string | null;
  city: string | null;
  state: string | null;
  address: string | null; // Complete Address
  languages: string | null;
  autoDm: boolean | null;
  profileImg: string | null;
  status: 'New' | 'Existing' | 'Invalid';
  reason?: string;
  existingId?: string | number;
}

interface ColumnMapping {
  codeCol: string;
  nameCol: string;
  userIdCol: string;
  phoneCol: string;
  altPhoneCol: string;
  upiCol: string;
  cityCol: string;
  stateCol: string;
  addressCol: string;
  languagesCol: string;
  autoDmCol: string;
  profileImgCol: string;
}

export const BulkInfluencerImportModal: React.FC<BulkInfluencerImportModalProps> = ({
  campaign,
  existingInfluencers,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    codeCol: '',
    nameCol: '',
    userIdCol: '',
    phoneCol: '',
    altPhoneCol: '',
    upiCol: '',
    cityCol: '',
    stateCol: '',
    addressCol: '',
    languagesCol: '',
    autoDmCol: '',
    profileImgCol: ''
  });
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normalize string helper
  const normalize = (str: any): string => {
    if (str === undefined || str === null) return '';
    if (typeof str === 'number') {
      return String(Math.floor(str)).trim();
    }
    return String(str).trim().replace(/\.0$/, '');
  };

  // Robust State Normalizer
  const normalizeState = (input?: string | null): string | null => {
    if (!input || !input.trim()) return null;
    const allStates = [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
      "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
      "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
      "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
      "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
      "Andaman and Nicobar Islands", "Chandigarh",
      "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
      "Ladakh", "Lakshadweep", "Puducherry"
    ];
    const clean = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = allStates.find(s => s.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
    return found || input.trim();
  };

  // Robust Language Normalizer
  const normalizeLanguages = (input?: string | null): string[] => {
    if (!input || !input.trim()) return [];
    const knownLangs = [
      "English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam",
      "Marathi", "Bengali", "Gujarati", "Punjabi", "Magahi", "Odia",
      "Rajasthani", "Haryanvi", "Bhojpuri", "Other"
    ];
    const parts = input.split(/[,/;|]+/).map(s => s.trim()).filter(Boolean);
    return parts.map(p => {
      const clean = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      const found = knownLangs.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
      return found || p;
    });
  };

  // Robust column auto-detection using header variations
  const autoDetectColumns = (headers: string[]): ColumnMapping => {
    let codeCol = '';
    let nameCol = '';
    let userIdCol = '';
    let phoneCol = '';
    let altPhoneCol = '';
    let upiCol = '';
    let cityCol = '';
    let stateCol = '';
    let addressCol = '';
    let languagesCol = '';
    let autoDmCol = '';
    let profileImgCol = '';

    headers.forEach(h => {
      const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

      // 1. Code
      if (!codeCol && (clean === 'influencercode' || clean === 'code' || clean === 'infcode' || clean === 'codeid')) {
        codeCol = h;
      }
      // 2. User Name / User ID / Handle
      else if (!userIdCol && (clean === 'username' || clean === 'userid' || clean === 'user' || clean === 'handle' || clean === 'userhandle' || clean === 'user_name' || clean === 'user_id')) {
        userIdCol = h;
      }
      // 3. Influencer Name / Name
      else if (!nameCol && (clean === 'influencername' || clean === 'name' || clean === 'fullname' || clean === 'influencer_name')) {
        nameCol = h;
      }
      // 4. Phone Number / Mobile Number
      else if (!phoneCol && (clean === 'phonenumber' || clean === 'phone' || clean === 'mobile' || clean === 'mobilenumber' || clean === 'contact' || clean === 'contactnumber')) {
        phoneCol = h;
      }
      // 5. Alternative Number / Alt Phone
      else if (!altPhoneCol && (clean === 'alternativenumber' || clean === 'altnumber' || clean === 'alternatephone' || clean === 'altphone' || clean === 'alternatemobilenumber')) {
        altPhoneCol = h;
      }
      // 6. UPI Number / UPI ID
      else if (!upiCol && (clean === 'upinumber' || clean === 'upi' || clean === 'upiid' || clean === 'upihandle')) {
        upiCol = h;
      }
      // 7. City
      else if (!cityCol && (clean === 'city' || clean === 'district' || clean === 'town')) {
        cityCol = h;
      }
      // 8. State
      else if (!stateCol && (clean === 'state' || clean === 'statename' || clean === 'province')) {
        stateCol = h;
      }
      // 9. Complete Address / Address
      else if (!addressCol && (clean === 'completeaddress' || clean === 'address' || clean === 'fulladdress' || clean === 'streetaddress' || clean === 'locationaddress' || clean === 'location')) {
        addressCol = h;
      }
      // 10. Languages
      else if (!languagesCol && (clean === 'languages' || clean === 'language' || clean === 'lang' || clean === 'targetlanguages' || clean === 'spokenlanguages')) {
        languagesCol = h;
      }
      // 11. Auto DM Tool
      else if (!autoDmCol && (clean === 'autodmtool' || clean === 'autodm' || clean === 'dmtool' || clean === 'autodmstatus')) {
        autoDmCol = h;
      }
      // 12. Profile Image / Photo
      else if (!profileImgCol && (clean === 'influencerprofileimage' || clean === 'profileimage' || clean === 'profilephoto' || clean === 'profileurl' || clean === 'imageurl' || clean === 'photo')) {
        profileImgCol = h;
      }
    });

    // Secondary pass for ambiguous headers
    if (!userIdCol || !nameCol) {
      headers.forEach(h => {
        const clean = h.trim().toLowerCase();
        if (!userIdCol && (clean.includes('user') || clean.includes('username') || clean.includes('user id'))) {
          userIdCol = h;
        }
        if (!nameCol && (clean.includes('influencer name') || (clean.includes('name') && !clean.includes('user')))) {
          nameCol = h;
        }
      });
    }

    return { codeCol, nameCol, userIdCol, phoneCol, altPhoneCol, upiCol, cityCol, stateCol, addressCol, languagesCol, autoDmCol, profileImgCol };
  };

  // Process rows into ParsedRow objects based on column mapping
  const processRowsWithMapping = (rows: Record<string, any>[], map: ColumnMapping) => {
    const existingCodeMap = new Map<string, CampaignInfluencer>();
    existingInfluencers.forEach(i => {
      if (i.code) existingCodeMap.set(normalize(i.code).toLowerCase(), i);
      if (i.name) existingCodeMap.set(normalize(i.name).toLowerCase(), i);
    });

    const seenCodesInFile = new Set<string>();

    const parsed: ParsedRow[] = rows.map((row) => {
      const code = normalize(row[map.codeCol]);
      const name = normalize(row[map.nameCol]);
      const userId = normalize(row[map.userIdCol]);

      let phone: string | null = normalize(row[map.phoneCol]);
      if (phone === '' || phone.toLowerCase() === 'null' || phone.toLowerCase() === 'undefined' || phone === '—') phone = null;

      let altPhone: string | null = normalize(row[map.altPhoneCol]);
      if (altPhone === '' || altPhone.toLowerCase() === 'null' || altPhone.toLowerCase() === 'undefined' || altPhone === '—') altPhone = null;

      let upi: string | null = normalize(row[map.upiCol]);
      if (upi === '' || upi.toLowerCase() === 'null' || upi.toLowerCase() === 'undefined' || upi === '—') upi = null;

      let city: string | null = normalize(row[map.cityCol]);
      if (city === '' || city.toLowerCase() === 'null' || city.toLowerCase() === 'undefined' || city === '—') city = null;

      let state: string | null = normalize(row[map.stateCol]);
      if (state === '' || state.toLowerCase() === 'null' || state.toLowerCase() === 'undefined' || state === '—') state = null;

      let address: string | null = normalize(row[map.addressCol]);
      if (address === '' || address.toLowerCase() === 'null' || address.toLowerCase() === 'undefined' || address === '—') address = null;

      let languages: string | null = normalize(row[map.languagesCol]);
      if (languages === '' || languages.toLowerCase() === 'null' || languages.toLowerCase() === 'undefined' || languages === '—') languages = null;

      let rawAutoDm = row[map.autoDmCol];
      let autoDm: boolean | null = null;
      if (typeof rawAutoDm === 'boolean') autoDm = rawAutoDm;
      else if (typeof rawAutoDm === 'string' && rawAutoDm.trim() !== '') {
        const lower = rawAutoDm.trim().toLowerCase();
        if (['true', 'yes', '1', 'enable', 'enabled'].includes(lower)) autoDm = true;
        else if (['false', 'no', '0', 'disable', 'disabled'].includes(lower)) autoDm = false;
      }

      let profileImg: string | null = normalize(row[map.profileImgCol]);
      if (profileImg === '' || profileImg.toLowerCase() === 'null' || profileImg.toLowerCase() === 'undefined' || profileImg === '—') profileImg = null;

      // Validation
      if (!code && !name && !userId) {
        return {
          code: code || '—',
          name: name || '—',
          userId: userId || '—',
          phone,
          altPhone,
          upi,
          city,
          state,
          address,
          languages,
          autoDm,
          profileImg,
          status: 'Invalid',
          reason: 'Row is empty'
        };
      }

      if (!code) {
        return {
          code: '—',
          name: name || '—',
          userId: userId || '—',
          phone,
          altPhone,
          upi,
          city,
          state,
          address,
          languages,
          autoDm,
          profileImg,
          status: 'Invalid',
          reason: 'Missing required Influencer Code'
        };
      }

      const lowerCode = code.toLowerCase();
      if (seenCodesInFile.has(lowerCode)) {
        return {
          code,
          name: name || userId || '—',
          userId: userId || name || '—',
          phone,
          altPhone,
          upi,
          city,
          state,
          address,
          languages,
          autoDm,
          profileImg,
          status: 'Invalid',
          reason: 'Duplicate Influencer Code in file'
        };
      }
      seenCodesInFile.add(lowerCode);

      if (!name && !userId) {
        return {
          code,
          name: '—',
          userId: '—',
          phone,
          altPhone,
          upi,
          city,
          state,
          address,
          languages,
          autoDm,
          profileImg,
          status: 'Invalid',
          reason: 'Missing required Influencer Name and User ID'
        };
      }

      const effectiveName = name || userId;
      const effectiveUserId = userId || name;
      const lowerUser = effectiveUserId.toLowerCase();

      const existingRecord = existingCodeMap.get(lowerCode) || existingCodeMap.get(lowerUser);

      if (existingRecord) {
        return {
          code,
          name: effectiveName,
          userId: effectiveUserId,
          phone: phone || (existingRecord.phone_number || null),
          altPhone: altPhone || (existingRecord.alternative_number || null),
          upi: upi || (existingRecord.upi_number || null),
          city: city || (existingRecord.city || null),
          state: state || (existingRecord.state || null),
          address: address || (existingRecord.complete_address || null),
          languages: languages || (Array.isArray(existingRecord.languages) ? existingRecord.languages.join(', ') : null),
          autoDm: autoDm ?? (existingRecord.auto_dm ?? null),
          profileImg: profileImg || (existingRecord.profile_file_url || null),
          status: 'Existing',
          reason: 'Influencer already exists in this campaign',
          existingId: existingRecord.id
        };
      }

      return {
        code,
        name: effectiveName,
        userId: effectiveUserId,
        phone,
        altPhone,
        upi,
        city,
        state,
        address,
        languages,
        autoDm,
        profileImg,
        status: 'New'
      };
    });

    setParsedRows(parsed);
  };

  // Parse Excel / CSV files
  const parseExcelOrCsv = async (selectedFile: File) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!jsonRows || jsonRows.length === 0) {
        toast.error('The selected file contains no data rows.');
        setIsProcessing(false);
        return;
      }

      const headers = Object.keys(jsonRows[0] || {});
      setRawHeaders(headers);
      setRawRows(jsonRows);

      const detected = autoDetectColumns(headers);
      setMapping(detected);

      if (detected.codeCol && (detected.nameCol || detected.userIdCol)) {
        processRowsWithMapping(jsonRows, detected);
        setStep('preview');
      } else {
        setStep('mapping');
      }
    } catch (err: any) {
      console.error('Failed to parse file:', err);
      toast.error('Failed to parse file. Please verify file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Parse PDF files
  const parsePdf = async (selectedFile: File) => {
    setIsProcessing(true);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let fullTextLines: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        const linesMap: Record<number, string[]> = {};
        for (const item of textContent.items as any[]) {
          const y = Math.round(item.transform[5]);
          if (!linesMap[y]) linesMap[y] = [];
          linesMap[y].push(item.str);
        }

        const sortedYKeys = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
        for (const y of sortedYKeys) {
          const lineStr = linesMap[y].join(' ').trim();
          if (lineStr) fullTextLines.push(lineStr);
        }
      }

      if (fullTextLines.length === 0) {
        toast.error('Could not extract readable text from PDF file.');
        setIsProcessing(false);
        return;
      }

      const extractedRows: Record<string, any>[] = [];
      for (const line of fullTextLines) {
        const lower = line.toLowerCase();
        if (lower.includes('code') && lower.includes('name')) continue;

        const parts = line.split(/[\t,|]|\s{2,}/).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 3) {
          extractedRows.push({
            'Influencer Code': parts[0],
            'User Name': parts[1],
            'Influencer Name': parts[2],
            'Phone Number': parts[3] || '',
            'Languages': parts[4] || '',
            'State': parts[5] || ''
          });
        }
      }

      if (extractedRows.length === 0) {
        toast.error('Could not detect structured Code, User Name, and Influencer Name records in PDF.');
        setIsProcessing(false);
        return;
      }

      const headers = ['Influencer Code', 'User Name', 'Influencer Name', 'Phone Number', 'Languages', 'State', 'Complete Address'];
      setRawHeaders(headers);
      setRawRows(extractedRows);
      const map: ColumnMapping = {
        codeCol: 'Influencer Code',
        userIdCol: 'User Name',
        nameCol: 'Influencer Name',
        phoneCol: 'Phone Number',
        altPhoneCol: '',
        upiCol: '',
        cityCol: '',
        stateCol: 'State',
        addressCol: 'Complete Address',
        languagesCol: 'Languages',
        autoDmCol: '',
        profileImgCol: ''
      };
      setMapping(map);
      processRowsWithMapping(extractedRows, map);
      setStep('preview');
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      toast.error('Unable to parse PDF. Please convert PDF to Excel/CSV for best results.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const ext = selected.name.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      parsePdf(selected);
    } else if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
      parseExcelOrCsv(selected);
    } else {
      toast.error('Unsupported file format. Please select an Excel (.xlsx, .xls), CSV, or PDF file.');
    }
  };

  const handleMappingConfirm = () => {
    if (!mapping.codeCol || (!mapping.nameCol && !mapping.userIdCol)) {
      toast.error('Please select column mappings for Code and Name / User ID.');
      return;
    }
    processRowsWithMapping(rawRows, mapping);
    setStep('preview');
  };

  const getMaxId = async (tableName: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('id')
        .order('id', { ascending: false })
        .limit(1);

      if (error) {
        console.error(`Error getting max ID for ${tableName}:`, error);
        return 0;
      }

      if (data && data.length > 0) {
        const val = Number(data[0].id);
        return isNaN(val) ? 0 : val;
      }
    } catch (err) {
      console.error(`Error in getMaxId for ${tableName}:`, err);
    }
    return 0;
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r.status === 'New');
    const existingRows = parsedRows.filter(r => r.status === 'Existing');
    const invalidCount = parsedRows.filter(r => r.status === 'Invalid').length;

    if (validRows.length === 0 && existingRows.length === 0) {
      toast.error('No valid rows to import.');
      return;
    }

    setStep('importing');
    setIsProcessing(true);

    let insertedCount = 0;
    let updatedCount = 0;

    try {
      // 1. Insert New Influencers
      if (validRows.length > 0) {
        let nextIdVal = await getMaxId(SUPABASE_TABLES.influencersInfo);

        const newRecords = validRows.map(row => {
          nextIdVal++;
          const langArray = normalizeLanguages(row.languages);
          const normStateVal = normalizeState(row.state);

          return {
            id: nextIdVal,
            campaign_id: campaign.id,
            code: row.code,
            influencer_name: row.name,
            name: row.userId,
            phone_number: row.phone || null,
            alternative_number: row.altPhone || null,
            upi_number: row.upi || null,
            city: row.city || null,
            state: normStateVal || null,
            complete_address: row.address || null,
            languages: langArray,
            auto_dm: row.autoDm ?? false,
            profile_file_url: row.profileImg || null,
            is_archived: 'false',
            created_at: new Date().toISOString()
          };
        });

        const { error: insertErr } = await supabase
          .from(SUPABASE_TABLES.influencersInfo)
          .insert(newRecords);

        if (insertErr) {
          console.error('Failed inserting bulk influencers:', insertErr);
          throw new Error(`Failed to insert influencers: ${insertErr.message || JSON.stringify(insertErr)}`);
        }

        insertedCount = newRecords.length;
      }

      // 2. Safe Update for Existing Influencers (Never overwrite non-empty DB value with empty Excel cell!)
      for (const row of existingRows) {
        if (row.existingId) {
          const existingRec = existingInfluencers.find(i => String(i.id) === String(row.existingId));
          const updates: Record<string, any> = {};

          if (row.name && row.name.trim() !== '') updates.influencer_name = row.name;
          if (row.userId && row.userId.trim() !== '') updates.name = row.userId;
          if (row.phone && row.phone.trim() !== '') updates.phone_number = row.phone;
          if (row.altPhone && row.altPhone.trim() !== '') updates.alternative_number = row.altPhone;
          if (row.upi && row.upi.trim() !== '') updates.upi_number = row.upi;
          if (row.city && row.city.trim() !== '') updates.city = row.city;

          const normStateVal = normalizeState(row.state);
          if (normStateVal && normStateVal.trim() !== '') updates.state = normStateVal;

          if (row.address && row.address.trim() !== '') updates.complete_address = row.address;

          const normLangs = normalizeLanguages(row.languages);
          if (normLangs.length > 0) updates.languages = normLangs;

          if (row.autoDm !== null && row.autoDm !== undefined) updates.auto_dm = row.autoDm;
          if (row.profileImg && row.profileImg.trim() !== '') updates.profile_file_url = row.profileImg;

          if (Object.keys(updates).length > 0) {
            const { error: updateErr } = await supabase
              .from(SUPABASE_TABLES.influencersInfo)
              .update(updates)
              .eq('id', row.existingId);

            if (updateErr) {
              console.error('Error updating existing influencer:', updateErr);
            } else {
              updatedCount++;
            }
          }
        }
      }

      // Log activity
      logActivity(
        'Marketing',
        'Bulk Influencer Import',
        `Imported ${insertedCount} new influencers (${existingRows.length} already existed, ${invalidCount} skipped) into ${campaign.campaign_name}.`
      );

      toast.success(
        `Import completed: ${insertedCount} new influencers imported, ${existingRows.length} already existed, ${invalidCount} skipped.`
      );

      notifyInfluencerChange(campaign.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Bulk import error:', err);
      toast.error(err.message || 'Failed to complete bulk import.');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const newCount = parsedRows.filter(r => r.status === 'New').length;
  const existingCount = parsedRows.filter(r => r.status === 'Existing').length;
  const invalidCount = parsedRows.filter(r => r.status === 'Invalid').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Import Influencers</h3>
              <p className="text-xs text-slate-400">Campaign: <span className="text-purple-300 font-semibold">{campaign.campaign_name}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-purple-500/50 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-10 text-center transition-all cursor-pointer group flex flex-col items-center justify-center min-h-[240px]"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xls,.xlsx,.csv,.pdf"
                  className="hidden"
                />
                
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-3 text-purple-400">
                    <Loader2 size={36} className="animate-spin" />
                    <span className="text-sm font-semibold">Parsing file data...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload size={28} />
                    </div>
                    <h4 className="text-base font-bold text-white mb-1">Click or drag Excel / CSV / PDF file to upload</h4>
                    <p className="text-xs text-slate-400 max-w-md mb-4">
                      Supports <span className="text-purple-300 font-medium">.xlsx, .xls, .csv, and .pdf</span> files containing Code, User Name, Influencer Name, Phone Number, Languages, and State.
                    </p>
                    <span className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-md transition-colors">
                      Browse File
                    </span>
                  </>
                )}
              </div>

              {/* Requirements Callout */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                <h5 className="font-bold text-slate-300 flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-purple-400" /> Recognized File Columns
                </h5>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-slate-400">
                  <li><strong className="text-slate-300">Influencer Code</strong> (e.g. DDS1, OD5188) — Required</li>
                  <li><strong className="text-slate-300">User Name</strong> (e.g. DINESH_11) — Required</li>
                  <li><strong className="text-slate-300">Influencer Name</strong> (e.g. DINESH) — Required</li>
                  <li><strong className="text-slate-300">Phone Number</strong> (e.g. 9876543210) — Optional</li>
                  <li><strong className="text-slate-300">Languages</strong> (e.g. TAMIL, ODIA) — Optional</li>
                  <li><strong className="text-slate-300">State</strong> (e.g. TAMIL NADU, TELANGANA) — Optional</li>
                  <li><strong className="text-slate-300">Complete Address / Address</strong> (e.g. Abc) — Optional</li>
                  <li><strong className="text-slate-300">City</strong> — Optional</li>
                  <li><strong className="text-slate-300">Alternative Number</strong> — Optional</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-sm font-bold text-white mb-1">Select Column Mapping</h4>
                <p className="text-xs text-slate-400">Map the columns from your uploaded file to the influencer fields.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Influencer Code <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={mapping.codeCol}
                    onChange={(e) => setMapping(m => ({ ...m, codeCol: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500"
                  >
                    <option value="">Select Column</option>
                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    User Name <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={mapping.userIdCol}
                    onChange={(e) => setMapping(m => ({ ...m, userIdCol: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500"
                  >
                    <option value="">Select Column</option>
                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Influencer Name <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={mapping.nameCol}
                    onChange={(e) => setMapping(m => ({ ...m, nameCol: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500"
                  >
                    <option value="">Select Column</option>
                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Phone Number <span className="text-slate-500">(Optional)</span>
                  </label>
                  <select
                    value={mapping.phoneCol}
                    onChange={(e) => setMapping(m => ({ ...m, phoneCol: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500"
                  >
                    <option value="">None / Skip</option>
                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Languages <span className="text-slate-500">(Optional)</span>
                  </label>
                  <select
                    value={mapping.languagesCol}
                    onChange={(e) => setMapping(m => ({ ...m, languagesCol: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500"
                  >
                    <option value="">None / Skip</option>
                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    State <span className="text-slate-500">(Optional)</span>
                  </label>
                  <select
                    value={mapping.stateCol}
                    onChange={(e) => setMapping(m => ({ ...m, stateCol: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500"
                  >
                    <option value="">None / Skip</option>
                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Complete Address / Address <span className="text-slate-500">(Optional)</span>
                  </label>
                  <select
                    value={mapping.addressCol}
                    onChange={(e) => setMapping(m => ({ ...m, addressCol: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-purple-500"
                  >
                    <option value="">None / Skip</option>
                    {rawHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Back
                </button>
                <button
                  onClick={handleMappingConfirm}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md"
                >
                  Continue to Preview
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & CONFIRM */}
          {(step === 'preview' || step === 'importing') && (
            <div className="space-y-6">
              
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 block uppercase">Total Rows</span>
                  <span className="text-lg font-bold text-white">{parsedRows.length}</span>
                </div>
                <div className="bg-green-950/30 border border-green-800/40 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-green-400 block uppercase">New Influencers</span>
                  <span className="text-lg font-bold text-green-300">{newCount}</span>
                </div>
                <div className="bg-yellow-950/30 border border-yellow-800/40 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-yellow-400 block uppercase">Existing (Will Update)</span>
                  <span className="text-lg font-bold text-yellow-300">{existingCount}</span>
                </div>
                <div className="bg-red-950/30 border border-red-800/40 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-red-400 block uppercase">Invalid Rows</span>
                  <span className="text-lg font-bold text-red-300">{invalidCount}</span>
                </div>
              </div>

              {/* Column Mapping Status Banner */}
              {rawHeaders.length > 0 && (
                <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl text-xs space-y-1.5">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="font-bold text-slate-300">Mapped Columns:</span>
                    {Object.entries(mapping).map(([key, col]) => {
                      if (!col) return null;
                      return (
                        <span key={key} className="px-2 py-0.5 bg-purple-900/40 border border-purple-700/50 text-purple-200 rounded text-[11px]">
                          {col}
                        </span>
                      );
                    })}
                  </div>
                  {rawHeaders.filter(h => !Object.values(mapping).includes(h)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="font-bold text-slate-400">Unmapped Columns (Ignored):</span>
                      {rawHeaders.filter(h => !Object.values(mapping).includes(h)).map(h => (
                        <span key={h} className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-400 rounded text-[11px]">
                          {h} (Unmapped)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 sticky top-0 text-[11px] font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Code</th>
                        <th className="p-3">Influencer Name</th>
                        <th className="p-3">User ID</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Languages</th>
                        <th className="p-3">State</th>
                        <th className="p-3">Complete Address</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 font-semibold text-purple-300">{row.code}</td>
                          <td className="p-3 text-white font-sans">{row.name}</td>
                          <td className="p-3 text-slate-300">@{row.userId}</td>
                          <td className="p-3 text-slate-400">{row.phone || '—'}</td>
                          <td className="p-3 text-slate-300 font-sans">{row.languages || '—'}</td>
                          <td className="p-3 text-slate-300 font-sans">{row.state || '—'}</td>
                          <td className="p-3 text-slate-300 font-sans">{row.address || '—'}</td>
                          <td className="p-3 font-sans">
                            {row.status === 'New' && (
                              <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-bold rounded-full inline-flex items-center gap-1">
                                <CheckCircle2 size={10} /> New - Will Create
                              </span>
                            )}
                            {row.status === 'Existing' && (
                              <span className="px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold rounded-full inline-flex items-center gap-1" title={row.reason}>
                                <AlertCircle size={10} /> Existing - Will Update
                              </span>
                            )}
                            {row.status === 'Invalid' && (
                              <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-bold rounded-full inline-flex items-center gap-1" title={row.reason}>
                                <AlertTriangle size={10} /> {row.reason || 'Invalid'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  onClick={() => setStep('upload')}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Choose Different File
                </button>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    disabled={isProcessing}
                    className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isProcessing || (newCount === 0 && existingCount === 0)}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Importing...
                      </>
                    ) : (
                      <>
                        <FileCheck size={14} /> Import {newCount} Influencer{newCount !== 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
