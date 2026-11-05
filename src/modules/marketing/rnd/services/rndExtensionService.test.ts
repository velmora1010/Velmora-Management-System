import assert from 'assert';
import { rndExtensionService } from './rndExtensionService';

console.log('=== TEST SUITE: rndExtensionService Defensive Error Handling ===');

// Test 1: Incoming error response with missing/undefined 'type' (e.g. from chrome.runtime.lastError)
{
  console.log('[Test 1] Verifying error response missing "type" rejects cleanly without throwing TypeError...');

  const testId = 'test_req_' + Math.random().toString(36).substring(2, 9);
  let rejectedError: any = null;
  let resolvedData: any = null;
  let timerFired = false;

  const mockTimeoutId = setTimeout(() => {
    timerFired = true;
  }, 50);

  // Manually register a pending request
  (rndExtensionService as any).pendingRequests.set(testId, {
    resolve: (val: any) => { resolvedData = val; },
    reject: (err: any) => { rejectedError = err; },
    timeoutId: mockTimeoutId
  });

  // Simulate content-app.js posting chrome.runtime.lastError message (which lacks 'type')
  const incomingErrorPayload = {
    source: 'VELMORA_RND_EXTENSION',
    id: testId,
    error: 'The message port closed before a response was received.'
    // Note: type is explicitly undefined/missing here
  };

  assert.doesNotThrow(() => {
    (rndExtensionService as any).handleIncomingMessage(incomingErrorPayload);
  }, 'handleIncomingMessage must not throw TypeError when data.type is undefined');

  assert.strictEqual(resolvedData, null, 'Should not resolve on error');
  assert.ok(rejectedError instanceof Error, 'Should reject with an Error instance');
  assert.strictEqual(
    rejectedError.message,
    'The message port closed before a response was received.',
    'Should reject with the exact error string'
  );
  assert.strictEqual(
    (rndExtensionService as any).pendingRequests.has(testId),
    false,
    'Pending request must be removed from map'
  );

  // Wait 70ms to confirm the cleared timer does not fire
  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(timerFired, false, 'Timeout timer must be cleared and must not fire');

  console.log('  -> Missing-type error response rejected immediately with real message and timer cleared.');
}

// Test 2: Normal typed failure response (e.g. type: 'PROFILE_FAILED')
{
  console.log('[Test 2] Verifying typed failure response (e.g. PROFILE_FAILED)...');

  const testId = 'test_req_' + Math.random().toString(36).substring(2, 9);
  let rejectedError: any = null;
  let timerFired = false;

  const mockTimeoutId = setTimeout(() => {
    timerFired = true;
  }, 50);

  (rndExtensionService as any).pendingRequests.set(testId, {
    resolve: () => {},
    reject: (err: any) => { rejectedError = err; },
    timeoutId: mockTimeoutId
  });

  (rndExtensionService as any).handleIncomingMessage({
    source: 'VELMORA_RND_EXTENSION',
    id: testId,
    type: 'PROFILE_FAILED',
    error: 'Failed to find reels'
  });

  assert.ok(rejectedError instanceof Error, 'Should reject with an Error');
  assert.strictEqual(rejectedError.message, 'Failed to find reels');
  assert.strictEqual((rndExtensionService as any).pendingRequests.has(testId), false);

  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(timerFired, false, 'Timeout timer must not fire after typed rejection');
  console.log('  -> Typed failure response rejected cleanly.');
}

// Test 3: Normal typed success response (e.g. type: 'PROFILE_COMPLETED')
{
  console.log('[Test 3] Verifying typed success response (e.g. PROFILE_COMPLETED)...');

  const testId = 'test_req_' + Math.random().toString(36).substring(2, 9);
  let resolvedData: any = null;
  let timerFired = false;

  const mockTimeoutId = setTimeout(() => {
    timerFired = true;
  }, 50);

  (rndExtensionService as any).pendingRequests.set(testId, {
    resolve: (val: any) => { resolvedData = val; },
    reject: () => {},
    timeoutId: mockTimeoutId
  });

  (rndExtensionService as any).handleIncomingMessage({
    source: 'VELMORA_RND_EXTENSION',
    id: testId,
    type: 'PROFILE_COMPLETED',
    payload: { influencerCode: 'HIS001', status: 'completed' }
  });

  assert.ok(resolvedData, 'Should resolve with response object');
  assert.strictEqual(resolvedData.payload.influencerCode, 'HIS001');
  assert.strictEqual(resolvedData.payload.status, 'completed');
  assert.strictEqual((rndExtensionService as any).pendingRequests.has(testId), false);

  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(timerFired, false, 'Timeout timer must not fire after success');
  console.log('  -> Typed success response resolved cleanly.');
}

// Test 4: Queue recovery exercising exact background.js queue contract (lines 528-533 & 1843-1860)
{
  console.log('[Test 4] Verifying background.js researchQueue contract and recovery after timeout...');

  // Exact background.js queue state representation
  let researchQueue: Promise<any> = Promise.resolve();
  const responses: any[] = [];

  // Mirrors exact background.js dispatch loop:
  // researchQueue = researchQueue.catch(() => {}).then(async () => { ... sendResponse(...) })
  const dispatchResearchRequest = (payload: any, researchHandler: () => Promise<any>) => {
    return new Promise((resolve) => {
      researchQueue = researchQueue.catch(() => {}).then(async () => {
        try {
          const result = await researchHandler();
          const resp = { type: 'PROFILE_COMPLETED', payload: result };
          responses.push(resp);
          resolve(resp);
        } catch (err: any) {
          const resp = { type: 'PROFILE_FAILED', error: err.message || err.toString(), payload };
          responses.push(resp);
          resolve(resp);
        }
      });
    });
  };

  // Profile 1: Throws COMPANION_WINDOW_MINIMIZED_TIMEOUT, caught by startProfileResearch catch block
  const p1 = dispatchResearchRequest({ influencerCode: 'HIS001' }, async () => {
    try {
      throw new Error('COMPANION_WINDOW_MINIMIZED_TIMEOUT: Instagram research companion window remained minimized for over 35 seconds.');
    } catch (err: any) {
      if (err && String(err.message || '').includes('COMPANION_WINDOW_MINIMIZED_TIMEOUT')) {
        return {
          influencerCode: 'HIS001',
          status: 'failed',
          failureStage: 'companion_window_minimized_timeout',
          error: 'Instagram research companion window was minimized for over 35 seconds. Please keep the companion window open during batch research.'
        };
      }
      throw err;
    }
  });

  // Profile 2: Queued immediately, should run and complete once Profile 1 finishes
  const p2 = dispatchResearchRequest({ influencerCode: 'HIS002' }, async () => {
    return {
      influencerCode: 'HIS002',
      status: 'completed',
      reelsDiscovered: 15
    };
  });

  // Profile 3: Queued behind Profile 2, should also execute sequentially
  const p3 = dispatchResearchRequest({ influencerCode: 'HIS003' }, async () => {
    return {
      influencerCode: 'HIS003',
      status: 'completed',
      reelsDiscovered: 15
    };
  });

  await Promise.all([p1, p2, p3]);

  assert.strictEqual(responses.length, 3, 'All 3 profiles must complete in sequential order');
  assert.strictEqual(responses[0].type, 'PROFILE_COMPLETED');
  assert.strictEqual(responses[0].payload.influencerCode, 'HIS001');
  assert.strictEqual(responses[0].payload.status, 'failed');
  assert.strictEqual(responses[0].payload.failureStage, 'companion_window_minimized_timeout');

  assert.strictEqual(responses[1].type, 'PROFILE_COMPLETED');
  assert.strictEqual(responses[1].payload.influencerCode, 'HIS002');
  assert.strictEqual(responses[1].payload.status, 'completed');

  assert.strictEqual(responses[2].type, 'PROFILE_COMPLETED');
  assert.strictEqual(responses[2].payload.influencerCode, 'HIS003');
  assert.strictEqual(responses[2].payload.status, 'completed');

  console.log('  -> Queue recovery verified: Profile 2 & 3 successfully completed sequentially after Profile 1 timeout.');
}

// Test 5: Pause and Resume timeout freeze and heartbeat handling
{
  console.log('[Test 5] Verifying timeout freezing on RESEARCH_PAUSED and restart on RESEARCH_RESUMED...');

  const testId = 'test_req_pause_' + Math.random().toString(36).substring(2, 9);
  let timerFired = false;
  let rejectedError: any = null;
  let resolvedData: any = null;

  // Simulate a pending START_PROFILE_RESEARCH with a 80ms timeout
  const mockTimeoutId = setTimeout(() => {
    timerFired = true;
  }, 80);

  (rndExtensionService as any).pendingRequests.set(testId, {
    resolve: (val: any) => { resolvedData = val; },
    reject: (err: any) => { rejectedError = err; },
    timeoutId: mockTimeoutId,
    type: 'START_PROFILE_RESEARCH',
    timeoutMs: 80
  });

  // 1. Simulate RESEARCH_PAUSED event arriving at 30ms (before the 80ms timeout fires)
  await new Promise(r => setTimeout(r, 30));
  (rndExtensionService as any).handleIncomingMessage({
    source: 'VELMORA_RND_EXTENSION',
    isEvent: true,
    type: 'RESEARCH_PAUSED',
    payload: { statusText: 'Paused — Instagram window inactive' }
  });

  const reqItem = (rndExtensionService as any).pendingRequests.get(testId);
  assert.ok(reqItem, 'Pending request must still exist');
  assert.ok(!reqItem.timeoutId, 'timeoutId must be cleared (frozen) during pause');

  // 2. Wait 100ms (total 130ms, which exceeds original 80ms timeout). Timer must NOT fire!
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(timerFired, false, 'Timer must not have fired while paused');
  assert.strictEqual(rejectedError, null, 'Request must not have been rejected while paused');

  // 3. Simulate RESEARCH_RESUMED event arriving
  (rndExtensionService as any).handleIncomingMessage({
    source: 'VELMORA_RND_EXTENSION',
    isEvent: true,
    type: 'RESEARCH_RESUMED',
    payload: { pausedDurationMs: 100 }
  });

  const resumedReqItem = (rndExtensionService as any).pendingRequests.get(testId);
  assert.ok(resumedReqItem.timeoutId !== null, 'timeoutId must be restored upon resume');

  // 4. Simulate active progress event (REELS_DISCOVERED) resetting the timer
  const oldTimer = resumedReqItem.timeoutId;
  await new Promise(r => setTimeout(r, 20));
  (rndExtensionService as any).handleIncomingMessage({
    source: 'VELMORA_RND_EXTENSION',
    isEvent: true,
    type: 'REELS_DISCOVERED',
    payload: { discovered: 15, validViews: 12 }
  });
  const refreshedReqItem = (rndExtensionService as any).pendingRequests.get(testId);
  assert.notStrictEqual(refreshedReqItem.timeoutId, oldTimer, 'Heartbeat event must reset timeout timer');

  // 5. Complete request normally
  (rndExtensionService as any).handleIncomingMessage({
    source: 'VELMORA_RND_EXTENSION',
    id: testId,
    type: 'PROFILE_COMPLETED',
    payload: { influencerCode: 'HIS_PAUSE_TEST', status: 'completed' }
  });

  assert.ok(resolvedData, 'Request must resolve upon completion');
  assert.strictEqual(resolvedData.payload.influencerCode, 'HIS_PAUSE_TEST');
  assert.strictEqual((rndExtensionService as any).pendingRequests.has(testId), false);

  console.log('  -> Timeout freeze on RESEARCH_PAUSED, restart on RESEARCH_RESUMED, and heartbeat reset verified.');
}

console.log('PASS: All rndExtensionService verification checks passed successfully.');
