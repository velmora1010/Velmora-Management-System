import * as XLSX from 'xlsx';
import { ResearchInputProfile, ResearchJob, ValidationStatus } from '../types/rndTypes';

// Helpers to identify column names
const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, '');

const INFLUENCER_CODE_HEADERS = ['influencercode', 'code', 'influencerid'];
const USERNAME_HEADERS = ['username', 'userid', 'instagramusername', 'instagramuserid', 'user'];
const NAME_HEADERS = ['name', 'influencername', 'fullname'];
const PHONE_HEADERS = ['phone', 'phonenumber', 'contact', 'mobile'];
const PROFILE_LINK_HEADERS = ['profilelink', 'link', 'url', 'instagramlink'];
const PLATFORM_HEADERS = ['platform', 'socialmedia'];

const findColumnKey = (headers: string[], matchers: string[]) => {
  return headers.find(h => matchers.includes(normalizeHeader(h)));
};

export const parseInfluencerExcel = async (file: File): Promise<ResearchJob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
          throw new Error('The uploaded Excel file is empty.');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Parse to array of objects with headers
        const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawRows.length === 0) {
          throw new Error('No data rows found in the Excel file.');
        }

        // Extract headers from the first row object keys
        const headers = Object.keys(rawRows[0]);
        
        const codeKey = findColumnKey(headers, INFLUENCER_CODE_HEADERS);
        const usernameKey = findColumnKey(headers, USERNAME_HEADERS);
        
        const nameKey = findColumnKey(headers, NAME_HEADERS);
        const phoneKey = findColumnKey(headers, PHONE_HEADERS);
        const profileLinkKey = findColumnKey(headers, PROFILE_LINK_HEADERS);
        const platformKey = findColumnKey(headers, PLATFORM_HEADERS);

        if (!codeKey) {
          throw new Error('Could not identify the "Influencer Code" column. Please ensure it exists.');
        }

        let totalProfiles = 0;
        let readyProfiles = 0;
        let warningProfiles = 0;
        let invalidProfiles = 0;
        let duplicateProfiles = 0;

        const profiles: ResearchInputProfile[] = [];
        const seenCodes = new Set<string>();
        const seenUsernames = new Set<string>();

        rawRows.forEach((row, index) => {
          // Check if row is completely empty
          const isRowEmpty = headers.every(h => {
            const val = row[h];
            return val === undefined || val === null || String(val).trim() === '';
          });

          if (isRowEmpty) return; // Skip empty rows completely

          totalProfiles++;
          const rowNumber = index + 2; // +1 for 0-index, +1 for header row

          const rawCode = String(row[codeKey] || '').trim();
          
          // Username could come from a specific column, or be missing
          let rawUsername = '';
          if (usernameKey) {
            rawUsername = String(row[usernameKey] || '').trim();
          }

          const name = nameKey ? String(row[nameKey] || '').trim() : undefined;
          const phone = phoneKey ? String(row[phoneKey] || '').trim() : undefined;
          const profileLink = profileLinkKey ? String(row[profileLinkKey] || '').trim() : undefined;
          const platform = platformKey ? String(row[platformKey] || '').trim() : undefined;

          const validationMessages: string[] = [];
          let validationStatus: ValidationStatus = 'ready';

          if (!rawCode) {
            validationMessages.push('Influencer Code is missing.');
            validationStatus = 'invalid';
          }
          if (!usernameKey) {
            if (validationStatus !== 'invalid') validationMessages.push('No Username column was detected in the file.');
            validationStatus = 'invalid';
          } else if (!rawUsername) {
            validationMessages.push('Username is missing.');
            validationStatus = 'invalid';
          }

          // Duplicate checks
          if (rawCode && seenCodes.has(rawCode)) {
            validationMessages.push(`Duplicate Influencer Code: ${rawCode}`);
            validationStatus = 'invalid';
            duplicateProfiles++;
          }
          if (rawUsername && seenUsernames.has(rawUsername)) {
            validationMessages.push(`Duplicate Username: ${rawUsername}`);
            if (validationStatus !== 'invalid') {
              validationStatus = 'invalid';
              duplicateProfiles++;
            }
          }

          if (rawCode) seenCodes.add(rawCode);
          if (rawUsername) seenUsernames.add(rawUsername);

          // Tally stats
          if (validationStatus === 'ready') readyProfiles++;
          if ((validationStatus as string) === 'warning') warningProfiles++;
          if (validationStatus === 'invalid') invalidProfiles++;

          profiles.push({
            influencerCode: rawCode,
            username: rawUsername,
            name,
            phone,
            profileLink,
            platform,
            rowNumber,
            validationStatus,
            validationMessages
          });
        });

        if (profiles.length === 0) {
          throw new Error('No valid influencer data found in the file.');
        }

        const jobId = `rnd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const status = (readyProfiles + warningProfiles > 0) ? 'ready' : 'invalid';

        resolve({
          jobId,
          fileName: file.name,
          createdAt: new Date().toISOString(),
          totalProfiles,
          readyProfiles,
          warningProfiles,
          invalidProfiles,
          duplicateProfiles,
          profiles,
          status
        });
      } catch (err: any) {
        reject(new Error(err.message || 'Failed to parse Excel file.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read the file.'));
    };

    reader.readAsArrayBuffer(file);
  });
};
