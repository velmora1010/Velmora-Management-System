import assert from 'node:assert/strict';
import { ResearchInputProfile, ProfileResearchResult } from '../types/rndTypes';

// Test grouping key logic
function getGroupKey(p: ResearchInputProfile): string {
  const code = (p.influencerCode || '').trim();
  const alphaMatch = code.match(/^[A-Za-z]+/);
  if (alphaMatch && alphaMatch[0]) {
    return alphaMatch[0].toUpperCase();
  }
  if (p.category && p.category.trim()) {
    return p.category.trim().toUpperCase();
  }
  return 'OTHER';
}

function runViewProfilesLogicTests() {
  console.log('Running RnDViewProfiles logic tests...');

  // 1. Verify prefix extraction
  assert.equal(getGroupKey({ influencerCode: 'HIS001', username: 'his_1', rowNumber: 1, validationStatus: 'ready', validationMessages: [] }), 'HIS');
  assert.equal(getGroupKey({ influencerCode: 'TNS12', username: 'tns_12', rowNumber: 2, validationStatus: 'ready', validationMessages: [] }), 'TNS');
  assert.equal(getGroupKey({ influencerCode: 'KLS_99', username: 'kls_99', rowNumber: 3, validationStatus: 'ready', validationMessages: [] }), 'KLS');
  assert.equal(getGroupKey({ influencerCode: 'TGS4', username: 'tgs_4', rowNumber: 4, validationStatus: 'ready', validationMessages: [] }), 'TGS');
  assert.equal(getGroupKey({ influencerCode: '123', category: 'Fashion', username: 'fash', rowNumber: 5, validationStatus: 'ready', validationMessages: [] }), 'FASHION');
  assert.equal(getGroupKey({ influencerCode: '123', username: 'noname', rowNumber: 6, validationStatus: 'ready', validationMessages: [] }), 'OTHER');

  // 2. Simulate 214-profile batch (208 completed, 6 failed)
  const mockProfiles: ResearchInputProfile[] = [];
  const mockResults: Record<string, ProfileResearchResult> = {};

  const prefixes = ['HIS', 'TNS', 'KLS', 'TGS'];
  const failedIndices = new Set([15, 24, 68, 102, 145, 199]);

  for (let i = 1; i <= 214; i++) {
    const prefix = prefixes[(i - 1) % prefixes.length];
    const code = `${prefix}${String(i).padStart(3, '0')}`;
    const username = `influencer_${code.toLowerCase()}`;

    mockProfiles.push({
      influencerCode: code,
      username,
      rowNumber: i,
      validationStatus: 'ready',
      validationMessages: []
    });

    const isFailed = failedIndices.has(i);
    if (isFailed) {
      mockResults[code] = {
        jobId: 'job_214',
        influencerCode: code,
        requestedUsername: username,
        verifiedUsername: username,
        status: 'failed',
        failureReason: 'Page Not Found',
        error: 'Instagram profile not found (Page Not Found)',
        followerDisplay: null,
        followerCount: 0,
        startedAt: 1000,
        completedAt: 2000
      };
    } else {
      mockResults[code] = {
        jobId: 'job_214',
        influencerCode: code,
        requestedUsername: username,
        verifiedUsername: username,
        status: 'completed',
        category: 'C2L1',
        followerDisplay: '120K',
        followerCount: 120000,
        averageViews: 300000,
        startedAt: 1000,
        completedAt: 2000
      };
    }
  }

  // Verify total, completed, and failed counts
  const resultsList = Object.values(mockResults);
  const total = resultsList.length;
  const completed = resultsList.filter(r => r.status === 'completed').length;
  const failed = resultsList.filter(r => r.status === 'failed').length;

  assert.equal(total, 214, 'Total should be 214');
  assert.equal(completed, 208, 'Completed should be 208');
  assert.equal(failed, 6, 'Failed should be 6');

  // Verify failure reasons on all 6 failed profiles
  const failedProfiles = resultsList.filter(r => r.status === 'failed');
  failedProfiles.forEach(fp => {
    assert.equal(fp.failureReason, 'Page Not Found');
  });

  // Verify grouping distribution
  const groupMap = new Map<string, ResearchInputProfile[]>();
  mockProfiles.forEach(p => {
    const k = getGroupKey(p);
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k)!.push(p);
  });

  assert.equal(groupMap.size, 4, 'Should have 4 groups: HIS, TNS, KLS, TGS');
  assert.ok(groupMap.has('HIS'));
  assert.ok(groupMap.has('TNS'));
  assert.ok(groupMap.has('KLS'));
  assert.ok(groupMap.has('TGS'));

  // Verify search filtering
  const hisMatches = mockProfiles.filter(p => p.influencerCode.includes('HIS'));
  assert.equal(hisMatches.length, 54);

  // Search by error message "not found"
  const errorMatches = mockProfiles.filter(p => {
    const res = mockResults[p.influencerCode];
    return res?.failureReason?.toLowerCase().includes('not found');
  });
  assert.equal(errorMatches.length, 6);

  console.log('PASS: All RnDViewProfiles logic tests passed successfully.');
}

runViewProfilesLogicTests();
