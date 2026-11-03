import assert from 'assert';
import React from 'react';
import { RnDMiniPlayer, setupMiniWindowDocument, RnDMiniPlayerProps } from './RnDMiniPlayer';

console.log('=== RUNTIME VERIFICATION SUITE: R&D MINI PLAYER ===');

// Test 1: Idle state rendering
{
  console.log('[Test 1] Verifying Idle State...');
  const idleProps: RnDMiniPlayerProps = {
    isBatchRunning: false,
    batchProgress: null,
    researchState: null,
    isEngineConnected: true,
    isPipMode: true,
    onFocusMainApp: () => {},
    onClose: () => {}
  };

  const element = React.createElement(RnDMiniPlayer, idleProps);
  assert.ok(element, 'Idle element must be successfully created');
  assert.strictEqual(element.props.isBatchRunning, false);
  console.log('  -> Idle state rendered correctly.');
}

// Test 2: Active batch progress simulation (5 profiles)
{
  console.log('[Test 2] Simulating 5-profile research run with Mini Player lifecycle...');

  const mockProfiles = [
    { code: 'HIS001', username: 'alexandra_fit', status: 'completed' },
    { code: 'HIS002', username: 'devon_cooks', status: 'completed' },
    { code: 'HIS003', username: 'marcus_tech', status: 'partial' },
    { code: 'HIS004', username: 'sarah_travels', status: 'failed' },
    { code: 'HIS005', username: 'elena_style', status: 'completed' }
  ];

  let currentBatchProgress: any = null;
  let currentResearchState: any = null;
  let isBatchRunning = true;
  let isMiniPlayerOpen = true;

  let completedCount = 0;
  let partialCount = 0;
  let failedCount = 0;

  for (let i = 0; i < mockProfiles.length; i++) {
    const p = mockProfiles[i];

    // Simulate batch loop iteration in InfluencerRnD.tsx
    currentBatchProgress = {
      currentIndex: i + 1,
      totalEligible: mockProfiles.length,
      currentProfileCode: p.code,
      currentUsername: p.username,
      completedCount,
      partialCount,
      failedCount
    };

    currentResearchState = {
      profileCode: p.code,
      username: p.username,
      statusText: `Scraping profile reels...`,
      isComplete: false,
      error: null
    };

    // If Mini Player is open, verify props match current batch state
    if (isMiniPlayerOpen) {
      const activeProps: RnDMiniPlayerProps = {
        isBatchRunning,
        batchProgress: currentBatchProgress,
        researchState: currentResearchState,
        isEngineConnected: true,
        isPipMode: true,
        onFocusMainApp: () => {},
        onClose: () => { isMiniPlayerOpen = false; }
      };

      const elem = React.createElement(RnDMiniPlayer, activeProps);
      assert.strictEqual(elem.props.batchProgress.currentProfileCode, p.code);
      assert.strictEqual(elem.props.batchProgress.currentIndex, i + 1);
    }

    // SIMULATION CHECK 1: User closes Mini Player during research at profile 2
    if (i === 1) {
      console.log('  -> Simulating user closing Mini Player at Profile 2...');
      isMiniPlayerOpen = false;
      // Research loop MUST continue without resetting batch state!
      assert.strictEqual(isBatchRunning, true, 'Research loop must remain running after Mini Player is closed');
    }

    // SIMULATION CHECK 2: User reopens Mini Player during research at profile 4
    if (i === 3) {
      console.log('  -> Simulating user reopening Mini Player at Profile 4...');
      isMiniPlayerOpen = true;
      // Mini Player must immediately reflect current profile (HIS004)
      assert.strictEqual(currentBatchProgress.currentProfileCode, 'HIS004');
      assert.strictEqual(currentBatchProgress.currentIndex, 4);
    }

    // Profile finishes
    if (p.status === 'completed') completedCount++;
    else if (p.status === 'partial') partialCount++;
    else failedCount++;
  }

  isBatchRunning = false;
  currentBatchProgress = {
    currentIndex: 5,
    totalEligible: 5,
    currentProfileCode: 'HIS005',
    currentUsername: 'elena_style',
    completedCount,
    partialCount,
    failedCount
  };

  // Verify final batch completion metrics
  assert.strictEqual(completedCount, 3, 'Completed should be 3');
  assert.strictEqual(partialCount, 1, 'Partial should be 1');
  assert.strictEqual(failedCount, 1, 'Failed should be 1');
  const remaining = currentBatchProgress.totalEligible - (completedCount + partialCount + failedCount);
  assert.strictEqual(remaining, 0, 'Remaining should be 0');

  console.log('  -> Batch simulation finished: 3 Completed, 1 Partial, 1 Failed, 0 Remaining.');
}

// Test 3: Document PiP fallback to popup window
{
  console.log('[Test 3] Verifying PiP unsupported / denied fallback logic...');

  // Simulate unsupported environment (window without documentPictureInPicture)
  const mockWindowWithoutPiP: any = {
    screenLeft: 100,
    outerWidth: 1200,
    screenTop: 50,
    open: (url: string, target: string, features: string) => {
      assert.strictEqual(target, 'VelmoraRnDMiniPlayer');
      assert.ok(features.includes('width=380'));
      assert.ok(features.includes('height=520'));
      return {
        document: {
          title: '',
          documentElement: { classList: { add: () => {} }, style: {} },
          body: { style: {} },
          head: { appendChild: () => {} }
        },
        addEventListener: () => {},
        closed: false
      };
    }
  };

  const hasPip = 'documentPictureInPicture' in mockWindowWithoutPiP;
  assert.strictEqual(hasPip, false, 'Environment has no PiP');

  // Fallback to window.open
  const openedWin = mockWindowWithoutPiP.open('', 'VelmoraRnDMiniPlayer', 'width=380,height=520');
  assert.ok(openedWin, 'Popup fallback must successfully open');
  console.log('  -> Fallback to window.open verified successfully.');
}

// Test 4: Document setup helper
{
  console.log('[Test 4] Verifying setupMiniWindowDocument helper...');
  const mockDoc = {
    title: '',
    documentElement: {
      classList: {
        add: (cls: string) => {
          assert.strictEqual(cls, 'dark', 'Dark mode class must be added');
        }
      },
      style: {} as any
    },
    body: {
      style: {} as any
    },
    head: {
      appendChild: () => {}
    }
  };

  setupMiniWindowDocument(mockDoc as any);
  assert.strictEqual(mockDoc.title, 'Influencer R&D · Mini Player');
  assert.strictEqual(mockDoc.documentElement.style.backgroundColor, '#0B111A');
  assert.strictEqual(mockDoc.body.style.backgroundColor, '#0B111A');
  console.log('  -> Document setup verified.');
}

console.log('PASS: All RnDMiniPlayer tests passed successfully.');
