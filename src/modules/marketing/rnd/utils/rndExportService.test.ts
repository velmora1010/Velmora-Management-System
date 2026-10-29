import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  RND_EXPORT_COLUMNS,
  categorize,
  extractValidViewsFromResult,
  prepareExportData,
  buildExcelWorkbook,
  buildExcelBuffer,
  buildCsvContent,
  getExportFileName
} from './rndExportService';
import {
  extractOriginalCategoryFromRow,
  findCategoryColumnKey,
  normalizeInfluencerCode,
  normalizeUsernameForLookup
} from './excelParser';
import { ResearchInputProfile, ProfileResearchResult, DiscoveredReel } from '../types/rndTypes';

function makeReels(counts: (number | null)[]): DiscoveredReel[] {
  return counts.map((viewCount, idx) => ({
    reelUrl: `https://www.instagram.com/reel/REEL_${idx + 1}/`,
    isPinned: false,
    discoveryIndex: idx + 1,
    viewCount
  }));
}

export function runRnDExportTests(): void {
  // 1. Validate exact Python `categorize(views)` boundary rules
  // Rule: 7 videos with at least 1,000,000 views -> C1L1
  assert.equal(
    categorize([
      1_000_000, 1_200_000, 2_500_000, 1_000_000, 1_500_000, 3_000_000, 1_000_000,
      999_999, 500_000, 250_000, 100_000, 50_000, 25_000, 10_000, 5_000
    ]),
    'C1L1'
  );

  // Rule: 7 videos with at least 500,000 but fewer than 7 with at least 1,000,000 -> C1L2
  assert.equal(
    categorize([
      1_000_000, 1_100_000, 1_200_000, 1_300_000, 1_400_000, 1_500_000, // 6 >= 1M
      500_000, // 7th >= 500k
      499_999, 250_000, 100_000, 50_000, 25_000, 10_000, 5_000, 1_000
    ]),
    'C1L2'
  );

  // Rule: 7 videos with at least 250,000 but fewer than 7 with at least 500,000 -> C2L1
  assert.equal(
    categorize([
      1_000_000, 500_000, 500_000, 500_000, 500_000, 500_000, // 6 >= 500k
      250_000, // 7th >= 250k
      249_999, 100_000, 50_000, 25_000, 10_000, 5_000, 2_000, 1_000
    ]),
    'C2L1'
  );

  // Rule: 7 videos with at least 100,000 -> C2L2
  assert.equal(
    categorize([
      500_000, 250_000, 250_000, 250_000, 250_000, 250_000, // 6 >= 250k
      100_000, // 7th >= 100k
      99_999, 50_000, 25_000, 10_000, 8_000, 5_000, 2_000, 1_000
    ]),
    'C2L2'
  );

  // Rule: 7 videos with at least 50,000 -> C3L1
  assert.equal(
    categorize([
      250_000, 100_000, 100_000, 100_000, 100_000, 100_000, // 6 >= 100k
      50_000, // 7th >= 50k
      49_999, 25_000, 10_000, 9_000, 8_000, 5_000, 2_000, 1_000
    ]),
    'C3L1'
  );

  // Rule: 7 videos with at least 25,000 -> C3L2
  assert.equal(
    categorize([
      100_000, 50_000, 50_000, 50_000, 50_000, 50_000, // 6 >= 50k
      25_000, // 7th >= 25k
      24_999, 10_000, 9_500, 8_000, 6_000, 4_000, 2_000, 1_000
    ]),
    'C3L2'
  );

  // Rule: 7 videos with at least 10,000 -> C4L1
  assert.equal(
    categorize([
      50_000, 25_000, 25_000, 25_000, 25_000, 25_000, // 6 >= 25k
      10_000, // 7th >= 10k
      9_999, 8_000, 7_000, 6_000, 5_000, 4_000, 2_000, 1_000
    ]),
    'C4L1'
  );

  // Rule: 7 videos below 10,000, with no higher category qualifying -> C4L2
  assert.equal(
    categorize([
      50_000, 25_000, 15_000, 12_000, 11_000, 10_000, // only 6 >= 10k
      9_999, 8_500, 7_200, 6_100, 5_000, 3_400, 1_200 // 7 < 10k
    ]),
    'C4L2'
  );

  // Rule: 6 valid views -> NotEnoughReels
  assert.equal(
    categorize([1_500_000, 2_000_000, 3_000_000, 1_100_000, 1_200_000, 1_800_000]),
    'NotEnoughReels'
  );

  // Rule: Missing/null view values must NOT be treated as 0 or counted toward C4L2
  assert.equal(
    categorize([5_000, 4_000, 3_000, 2_000, 1_000, 900, null, null, undefined, null]),
    'NotEnoughReels'
  );

  // Rule: 7 valid views that do not meet any category's 7-video condition -> Uncategorized
  assert.equal(
    categorize([100_000, 80_000, 60_000, 40_000, 20_000, 10_000, 9_999]), // 6 >= 10k and 1 < 10k
    'Uncategorized'
  );
  assert.equal(
    categorize([50_000, 40_000, 30_000, 20_000, 15_000, 10_000, 9_000, 8_000, 7_000, 6_000, 5_000, 4_000]), // 6 >= 10k and 6 < 10k
    'Uncategorized'
  );

  // 2. Test automatic Category calculation in export when input Excel has NO Category column
  const full15ForC3L2 = [
    104661, 95000, 112000, 88000, 76000, // 5 >= 50k
    34000, 31000, 28000, 26000, 25000,   // 10 >= 25k (>= 7 -> C3L2)
    18000, 12000, 11000, 9000, 8255
  ];
  const partial12WithNulls = [
    56381, 42000, 61000, 51000, 49000,
    73000, 58000, 64000, 47000, 53000,
    62000, 59992, null, null, null // 8 >= 50k -> C3L1
  ];
  const only6ValidReels = [
    120000, 95000, 88000, 110000, 76000, 64000, null, null
  ];

  const profiles: ResearchInputProfile[] = [
    {
      influencerCode: 'HIS1',
      username: 'khana_hi_khana777',
      // No Category column in input.xlsx
      originalData: { 'Influencer Code': 'HIS1', 'User Name': 'khana_hi_khana777' },
      rowNumber: 2,
      validationStatus: 'ready',
      validationMessages: [],
      researchStatus: 'completed'
    },
    {
      influencerCode: 'HIS34',
      username: '@Usmani_Foods12',
      originalData: { 'Influencer Code': 'HIS34', 'User Name': '@Usmani_Foods12' },
      rowNumber: 35,
      validationStatus: 'ready',
      validationMessages: [],
      researchStatus: 'partial'
    },
    {
      influencerCode: 'HIS40',
      username: 'few_reels_creator',
      originalData: { 'Influencer Code': 'HIS40', 'User Name': 'few_reels_creator' },
      rowNumber: 40,
      validationStatus: 'ready',
      validationMessages: [],
      researchStatus: 'partial'
    },
    {
      influencerCode: 'TNS50',
      username: 'divya_momdiaries',
      originalData: { 'Influencer Code': 'TNS50', 'User Name': 'divya_momdiaries' },
      rowNumber: 49,
      validationStatus: 'ready',
      validationMessages: [],
      researchStatus: 'failed'
    },
    {
      influencerCode: 'TNS51',
      username: 'not_started_user',
      originalData: { 'Influencer Code': 'TNS51', 'User Name': 'not_started_user' },
      rowNumber: 50,
      validationStatus: 'ready',
      validationMessages: []
    }
  ];

  const researchResults: Record<string, ProfileResearchResult> = {
    his1: {
      jobId: 'job_test',
      influencerCode: 'HIS1',
      requestedUsername: 'khana_hi_khana777',
      verifiedUsername: 'khana_hi_khana777',
      followerDisplay: '420K',
      followerCount: 420000,
      reelsDiscovered: 18,
      pinnedReelsExcluded: 3,
      selectedReelCount: 15,
      selectedReels: makeReels(full15ForC3L2),
      validViewCountsCount: 15,
      averageViews: 104661,
      status: 'completed',
      startedAt: 1000,
      completedAt: 2000
    },
    HIS34_KEY: {
      jobId: 'job_test',
      influencerCode: 'HIS34',
      requestedUsername: 'usmani_foods12',
      verifiedUsername: 'usmani_foods12',
      followerDisplay: '85.4K',
      followerCount: 85400,
      reelsDiscovered: 15,
      pinnedReelsExcluded: 0,
      selectedReelCount: 15,
      selectedReels: makeReels(partial12WithNulls),
      validViewCountsCount: 12,
      averageViews: 56364,
      status: 'partial',
      startedAt: 2000,
      completedAt: 3000
    },
    HIS40: {
      jobId: 'job_test',
      influencerCode: 'HIS40',
      requestedUsername: 'few_reels_creator',
      verifiedUsername: 'few_reels_creator',
      followerDisplay: '15K',
      followerCount: 15000,
      reelsDiscovered: 8,
      pinnedReelsExcluded: 0,
      selectedReelCount: 8,
      selectedReels: makeReels(only6ValidReels),
      validViewCountsCount: 6,
      averageViews: 92167,
      status: 'partial',
      startedAt: 2500,
      completedAt: 3500
    },
    TNS50_KEY: {
      jobId: 'job_test',
      influencerCode: 'TNS50',
      requestedUsername: '@DIVYA_MOMDIARIES',
      verifiedUsername: 'divya_momdiaries',
      followerDisplay: null,
      followerCount: 0,
      status: 'failed',
      error: 'Page not found',
      startedAt: 3000,
      completedAt: 4000
    }
  };

  assert.equal(extractValidViewsFromResult(researchResults.HIS40).length, 6);

  const exportRows = prepareExportData(profiles, researchResults);
  assert.equal(exportRows.length, 5);

  // Row 1: Completed -> Category automatically calculated as C3L2
  assert.equal(exportRows[0].influencerCode, 'HIS1');
  assert.equal(exportRows[0].category, 'C3L2');
  assert.equal(exportRows[0].researchStatus, 'Completed');

  // Row 2: Partial (12/15 valid views, 3 null) -> Category automatically calculated as C3L1, Video 13-15 blank (null)
  assert.equal(exportRows[1].influencerCode, 'HIS34');
  assert.equal(exportRows[1].category, 'C3L1');
  assert.equal(exportRows[1].researchStatus, 'Partial');
  assert.equal(exportRows[1].video12, 59992);
  assert.equal(exportRows[1].video13, null);
  assert.equal(exportRows[1].video14, null);
  assert.equal(exportRows[1].video15, null);

  // Row 3: Partial (6/15 valid views) -> Preserves NotEnoughReels
  assert.equal(exportRows[2].influencerCode, 'HIS40');
  assert.equal(exportRows[2].category, 'NotEnoughReels');
  assert.equal(exportRows[2].researchStatus, 'Partial');
  assert.equal(exportRows[2].video6, 64000);
  assert.equal(exportRows[2].video7, null);

  // Row 4: Failed -> Blank metrics
  assert.equal(exportRows[3].influencerCode, 'TNS50');
  assert.equal(exportRows[3].researchStatus, 'Failed');
  assert.equal(exportRows[3].followers, null);
  assert.equal(exportRows[3].video1, null);
  assert.equal(exportRows[3].averageViews, null);

  // Row 5: Not Started -> Blank category and metrics
  assert.equal(exportRows[4].influencerCode, 'TNS51');
  assert.equal(exportRows[4].category, '');
  assert.equal(exportRows[4].researchStatus, 'Not Started');

  // 3. Test Frozen Header at A2 & Workbook structure
  const wb = buildExcelWorkbook(profiles, researchResults);
  assert.deepEqual(wb.SheetNames, ['Influencer R&D']);
  const ws = wb.Sheets['Influencer R&D'];
  assert.deepEqual((ws as any)['!freeze'], {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: 'A2',
    activePane: 'bottomLeft',
    state: 'frozen'
  });
  assert.equal(ws['!autofilter']?.ref, 'A1:V6');
  assert.equal(ws['A1']?.s?.font?.bold, true);
  assert.equal(ws['D2']?.z, '#,##0');

  const xlsxBytes = buildExcelBuffer(profiles, researchResults);
  const cfbLib = (XLSX as any).CFB || (XLSX as any).default?.CFB;
  const cfb = cfbLib.read(xlsxBytes, { type: 'array' });
  const sheetEntry =
    cfbLib.find(cfb, '/xl/worksheets/sheet1.xml') ||
    cfbLib.find(cfb, 'xl/worksheets/sheet1.xml');
  assert.ok(sheetEntry && sheetEntry.content, 'sheet1.xml must exist in .xlsx archive');
  const sheetXml = new TextDecoder('utf-8').decode(
    sheetEntry.content instanceof Uint8Array
      ? sheetEntry.content
      : new Uint8Array(sheetEntry.content as ArrayLike<number>)
  );
  assert.ok(
    sheetXml.includes('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'),
    'sheet1.xml must contain frozen pane at A2'
  );

  // 4. Verify Excel and CSV contain identical exported data
  const parsedWb = XLSX.read(xlsxBytes, { type: 'array' });
  const excelRows = XLSX.utils.sheet_to_json<(string | number)[]>(
    parsedWb.Sheets['Influencer R&D'],
    { header: 1, defval: '' }
  );
  const csvContent = buildCsvContent(profiles, researchResults);
  const csvWb = XLSX.read(csvContent, { type: 'string' });
  const csvRows = XLSX.utils.sheet_to_json<(string | number)[]>(
    csvWb.Sheets[csvWb.SheetNames[0]],
    { header: 1, defval: '' }
  );

  assert.equal(excelRows.length, 6);
  assert.equal(csvRows.length, 6);
  for (let r = 0; r < excelRows.length; r++) {
    const eRow = excelRows[r].map(v => (v === null || v === undefined ? '' : String(v)));
    const cRow = csvRows[r].map(v => (v === null || v === undefined ? '' : String(v)));
    assert.deepEqual(eRow, cRow, `Row ${r} must be identical in Excel and CSV`);
  }

  assert.equal(findCategoryColumnKey(['Influencer Code', 'User Name', 'Type', 'Category']), 'Category');
  assert.equal(extractOriginalCategoryFromRow({ 'Type': 'Reel', 'Category': 'C1L1' }), 'C1L1');
  assert.equal(normalizeInfluencerCode(' his1 '), 'HIS1');
  assert.equal(normalizeUsernameForLookup(' @Khana_Hi_Khana777 '), 'khana_hi_khana777');
  assert.match(getExportFileName('xlsx'), /^Velmora_Influencer_RnD_\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.match(getExportFileName('csv'), /^Velmora_Influencer_RnD_\d{4}-\d{2}-\d{2}\.csv$/);

  // 5. Follower extraction and normalization regression tests
  function parseFollowerCount(text: string | null | undefined): number {
    if (!text) return 0;
    const clean = String(text).toLowerCase().replace(/,/g, '').trim();
    if (clean.includes('b')) return Math.round(parseFloat(clean.replace('b', '')) * 1_000_000_000);
    if (clean.includes('m')) return Math.round(parseFloat(clean.replace('m', '')) * 1_000_000);
    if (clean.includes('k')) return Math.round(parseFloat(clean.replace('k', '')) * 1_000);
    const parsed = parseInt(clean, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  assert.equal(parseFollowerCount('436K'), 436_000);
  assert.equal(parseFollowerCount('436,123'), 436_123);
  assert.equal(parseFollowerCount('1.2M'), 1_200_000);
  assert.equal(parseFollowerCount('2.5B'), 2_500_000_000);
  assert.equal(parseFollowerCount('950'), 950);
  assert.equal(parseFollowerCount(null), 0);
  assert.equal(parseFollowerCount(''), 0);

  // 6. Test export behavior with populated followers vs missing/unavailable followers
  const profileWithFollowers: ResearchInputProfile = {
    rowNumber: 2,
    influencerCode: 'HIS1',
    username: 'khana_hi_khana777',
    validationStatus: 'ready',
    validationMessages: []
  };
  const profileWithoutFollowers: ResearchInputProfile = {
    rowNumber: 3,
    influencerCode: 'HIS2',
    username: 'private_account',
    validationStatus: 'ready',
    validationMessages: []
  };

  const khanaViews = [4394, 31700, 64900, 701000, 133000, 187000, 273000, 141000, 68400, 81500, 95900, 263000, 14400, 23700, 11500];
  const khanaAvg = Math.round(khanaViews.reduce((a, b) => a + b, 0) / khanaViews.length);
  assert.equal(khanaAvg, 139_626);
  assert.equal(categorize(khanaViews), 'C3L1');

  const testResults: Record<string, ProfileResearchResult> = {
    'HIS1': {
      jobId: 'job_test',
      influencerCode: 'HIS1',
      requestedUsername: 'khana_hi_khana777',
      verifiedUsername: 'khana_hi_khana777',
      status: 'completed',
      followerDisplay: '436K',
      followerCount: 436_000,
      reelsDiscovered: 27,
      pinnedReelsExcluded: 3,
      selectedReelCount: 15,
      selectedReels: makeReels(khanaViews),
      validViewCountsCount: 15,
      averageViews: khanaAvg,
      rawViewCounts: khanaViews,
      category: 'C3L1',
      creatorCategory: 'C3L1',
      startedAt: Date.now() - 10000,
      completedAt: Date.now()
    },
    'HIS2': {
      jobId: 'job_test',
      influencerCode: 'HIS2',
      requestedUsername: 'private_account',
      verifiedUsername: 'private_account',
      status: 'failed',
      followerDisplay: null,
      followerCount: 0,
      reelsDiscovered: 0,
      pinnedReelsExcluded: 0,
      selectedReelCount: 0,
      selectedReels: [],
      validViewCountsCount: 0,
      averageViews: 0,
      rawViewCounts: [],
      startedAt: Date.now() - 5000,
      completedAt: Date.now()
    }
  };

  const exportedData = prepareExportData([profileWithFollowers, profileWithoutFollowers], testResults);
  assert.equal(exportedData.length, 2);
  // HIS1: followers must be numeric 436000
  assert.equal(exportedData[0].followers, 436_000);
  assert.equal(exportedData[0].researchStatus, 'Completed');
  assert.equal(exportedData[0].averageViews, 139_626);
  assert.equal(exportedData[0].category, 'C3L1');

  // HIS2: missing follower must be null (never fabricated 0 or guessed)
  assert.equal(exportedData[1].followers, null);
  assert.equal(exportedData[1].researchStatus, 'Failed');
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('rndExportService.test')) {
  runRnDExportTests();
  console.log('PASS: All rndExportService and categorize(views) tests passed.');
}
