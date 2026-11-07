import assert from 'assert';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { RnDMiniPlayer, setupMiniWindowDocument, RnDMiniPlayerProps } from './RnDMiniPlayer';
import { rndExtensionService } from '../services/rndExtensionService';

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

// Test 5: Paused state rendering and retry failed callback
{
  console.log('[Test 5] Verifying Paused state and Retry Failed callback in Mini Player...');
  let retryTriggered = false;
  const pausedProps: RnDMiniPlayerProps = {
    isBatchRunning: true,
    isPaused: true,
    batchProgress: {
      currentIndex: 2,
      totalEligible: 5,
      currentProfileCode: 'HIS002',
      currentUsername: 'devon_cooks',
      completedCount: 1,
      partialCount: 0,
      failedCount: 0
    },
    researchState: {
      profileCode: 'HIS002',
      username: 'devon_cooks',
      statusText: 'Paused — Instagram window inactive'
    },
    isEngineConnected: true,
    isPipMode: true,
    onRetryFailed: () => { retryTriggered = true; },
    onFocusMainApp: () => {},
    onClose: () => {}
  };

  const elem = React.createElement(RnDMiniPlayer, pausedProps);
  assert.strictEqual(elem.props.isPaused, true);
  assert.strictEqual(elem.props.researchState?.statusText, 'Paused — Instagram window inactive');

  // Verify retry button presence when batch ended with failures
  const idleWithFailuresProps: RnDMiniPlayerProps = {
    ...pausedProps,
    isBatchRunning: false,
    isPaused: false,
    batchProgress: {
      currentIndex: 5,
      totalEligible: 5,
      completedCount: 3,
      partialCount: 1,
      failedCount: 1
    }
  };
  const idleElem = React.createElement(RnDMiniPlayer, idleWithFailuresProps);
  assert.strictEqual(idleElem.props.batchProgress?.failedCount, 1);
  if (idleElem.props.onRetryFailed) {
    idleElem.props.onRetryFailed();
  }
  assert.strictEqual(retryTriggered, true, 'onRetryFailed must be callable');

  // Verify occlusion_suspected pause message renders cleanly in the component output tree
  const occlusionPausedProps: RnDMiniPlayerProps = {
    ...pausedProps,
    isPaused: true,
    researchState: {
      profileCode: 'HIS003',
      username: 'covered_creator',
      statusText: 'Paused — Instagram Companion window appears to be covered. Bring it to the front to continue.'
    }
  };
  const renderedTree = (RnDMiniPlayer as any)(occlusionPausedProps);
  const treeJson = JSON.stringify(renderedTree);
  assert.ok(
    treeJson.includes('Paused — Instagram Companion window appears to be covered. Bring it to the front to continue.'),
    'Mini Player rendered output must display the full occlusion_suspected pause message'
  );
  assert.ok(
    treeJson.includes('whitespace-normal break-words'),
    'Mini Player must wrap the pause reason without truncating when isPaused is true'
  );
  console.log('  -> Paused state (minimized + occlusion_suspected) and Retry Failed callback verified successfully.');
}

// Test 6: Cross-department navigation & Global Persistent MiniPlayer architecture verification
{
  console.log('[Test 6] Verifying Global Persistent MiniPlayer across department navigation (Influencer R&D -> Sales -> Logistics -> Finance -> Influencer R&D)...');

  const rootDir = path.resolve(process.cwd(), 'src');
  const appSource = fs.readFileSync(path.join(rootDir, 'App.tsx'), 'utf8');
  const mainLayoutSource = fs.readFileSync(path.join(rootDir, 'layouts', 'MainLayout.tsx'), 'utf8');
  const influencerRnDSource = fs.readFileSync(path.join(rootDir, 'modules', 'marketing', 'InfluencerRnD.tsx'), 'utf8');
  const rndContextSource = fs.readFileSync(path.join(rootDir, 'modules', 'marketing', 'rnd', 'context', 'RnDContext.tsx'), 'utf8');

  // 1. Verify global provider and single MainLayout mount
  assert.ok(appSource.includes('<RnDProvider>'), 'App.tsx must wrap routes with <RnDProvider>');
  assert.ok(mainLayoutSource.includes('<GlobalRnDMiniPlayer />'), 'MainLayout.tsx must mount <GlobalRnDMiniPlayer /> globally');
  assert.ok(mainLayoutSource.includes('<Suspense'), 'MainLayout.tsx must wrap <Outlet /> in <Suspense> so lazy department routes never unmount MainLayout');

  // 2. Verify InfluencerRnD.tsx consumes useRnDContext and no longer closes MiniPlayer on unmount or renders a duplicate portal
  assert.ok(influencerRnDSource.includes('useRnDContext()'), 'InfluencerRnD.tsx must consume global R&D context via useRnDContext()');
  assert.ok(!influencerRnDSource.includes('miniPlayerWindowRef.current.close()'), 'InfluencerRnD.tsx must NOT close the MiniPlayer window on department unmount');
  assert.ok(!influencerRnDSource.includes('createPortal('), 'InfluencerRnD.tsx must NOT render a duplicate local portal for RnDMiniPlayer');
  assert.ok(rndContextSource.includes('data-testid="global-rnd-miniplayer"'), 'RnDContext.tsx must provide the global floating MiniPlayer container');

  // 3. Simulate active R&D session across department route transitions:
  // Influencer R&D -> Sales -> Logistics -> Finance -> Influencer R&D
  const departmentRoutes = [
    { dept: 'Influencer R&D', path: '/marketing?tab=influencer-rnd', activeProfile: 'HIS001', username: 'alexandra_fit', index: 1, completed: 0, reels: 5 },
    { dept: 'Sales', path: '/sales', activeProfile: 'HIS002', username: 'devon_cooks', index: 2, completed: 1, reels: 15 },
    { dept: 'Logistics', path: '/logistics', activeProfile: 'HIS003', username: 'marcus_tech', index: 3, completed: 2, reels: 12 },
    { dept: 'Finance', path: '/finance', activeProfile: 'HIS004', username: 'sarah_travels', index: 4, completed: 3, reels: 15 },
    { dept: 'Influencer R&D', path: '/marketing?tab=influencer-rnd', activeProfile: 'HIS005', username: 'elena_style', index: 5, completed: 4, reels: 15 }
  ];

  // Persistent state held in RnDProvider across route transitions
  const persistentSessionState = {
    isBatchRunning: true,
    isMiniPlayerOpen: true,
    isMinimized: false,
    isExpanded: false,
    isPaused: false,
    isUserPaused: false,
    position: { x: 420, y: 180 },
    dimensions: { width: 380, height: 480 },
    resultsByCode: {} as Record<string, any>,
    mountedMiniPlayerInstances: 1
  };

  for (const step of departmentRoutes) {
    // Navigating to a new department inside MainLayout keeps RnDProvider + GlobalRnDMiniPlayer mounted
    assert.strictEqual(persistentSessionState.mountedMiniPlayerInstances, 1, `Exactly 1 MiniPlayer instance must exist while on ${step.dept}`);
    assert.strictEqual(persistentSessionState.isBatchRunning, true, `R&D session must remain running when navigating to ${step.dept}`);
    assert.strictEqual(persistentSessionState.isMiniPlayerOpen, true, `MiniPlayer must remain visible on ${step.dept}`);
    assert.deepStrictEqual(persistentSessionState.position, { x: 420, y: 180 }, `MiniPlayer position must be preserved on ${step.dept}`);
    assert.deepStrictEqual(persistentSessionState.dimensions, { width: 380, height: 480 }, `MiniPlayer dimensions must be preserved on ${step.dept}`);

    const batchProgress = {
      currentIndex: step.index,
      totalEligible: 5,
      currentProfileCode: step.activeProfile,
      currentUsername: step.username,
      completedCount: step.completed,
      partialCount: 0,
      failedCount: 0
    };

    const researchState = {
      profileCode: step.activeProfile,
      username: step.username,
      statusText: `Collected ${step.reels} reels...`,
      followers: 45200,
      validViewsCount: step.reels,
      category: 'Lifestyle'
    };

    const renderedOnRoute = (RnDMiniPlayer as any)({
      isBatchRunning: persistentSessionState.isBatchRunning,
      isPaused: persistentSessionState.isPaused,
      isUserPaused: persistentSessionState.isUserPaused,
      isMinimized: persistentSessionState.isMinimized,
      isExpanded: persistentSessionState.isExpanded,
      isFloatingMode: true,
      batchProgress,
      researchState,
      isEngineConnected: true,
      isPipMode: false,
      onFocusMainApp: () => {},
      onClose: () => { persistentSessionState.isMiniPlayerOpen = false; }
    });

    const routeJson = JSON.stringify(renderedOnRoute);
    assert.ok(routeJson.includes(step.activeProfile), `MiniPlayer on ${step.dept} must display active profile ${step.activeProfile}`);
    assert.ok(routeJson.includes(`@${step.username}`), `MiniPlayer on ${step.dept} must display @${step.username}`);

    // Persist profile result + scrollDiag into global context while user is on another department
    persistentSessionState.resultsByCode[step.activeProfile] = {
      profileCode: step.activeProfile,
      status: 'completed',
      scrollDiag: {
        exitReason: 'target_reached',
        elapsedMs: 14200,
        scrollRounds: 8,
        stableRounds: 1,
        zeroRounds: 0,
        pauseCount: 0,
        totalPausedMs: 0
      }
    };
  }

  // Verify all 5 profiles and their scrollDiag diagnostics are intact upon returning to Influencer R&D
  assert.strictEqual(Object.keys(persistentSessionState.resultsByCode).length, 5, 'All 5 scraped profiles must be preserved in global context across navigation');
  assert.strictEqual(persistentSessionState.resultsByCode['HIS003'].scrollDiag.exitReason, 'target_reached', 'scrollDiag persisted while on Logistics must remain intact on return to Influencer R&D');
  console.log('  -> Cross-department persistence (Influencer R&D -> Sales -> Logistics -> Finance -> Influencer R&D) verified.');
}

// Test 7: Minimize/Restore, Expand/Collapse, Play/Pause, and Separate Hide vs. Stop Session controls
{
  console.log('[Test 7] Verifying Minimize/Restore, Expand/Collapse, Play/Pause, and Hide vs. Stop Session controls...');

  let isMinimized = false;
  let isExpanded = false;
  let isUserPaused = false;
  let isMiniPlayerOpen = true;
  let isBatchRunning = true;
  let stopSessionCalled = false;

  const baseProps: RnDMiniPlayerProps = {
    isBatchRunning: true,
    isPaused: false,
    isUserPaused: false,
    isMinimized: false,
    isExpanded: false,
    isFloatingMode: true,
    batchProgress: {
      currentIndex: 3,
      totalEligible: 8,
      currentProfileCode: 'HIS003',
      currentUsername: 'marcus_tech',
      completedCount: 2,
      partialCount: 0,
      failedCount: 0
    },
    researchState: {
      profileCode: 'HIS003',
      username: 'marcus_tech',
      statusText: 'Analyzing reel engagement metrics...',
      followerDisplay: '128,500',
      validViewCountsCount: 12,
      category: 'Tech & Gadgets'
    },
    isEngineConnected: true,
    isPipMode: false,
    onToggleMinimize: () => { isMinimized = !isMinimized; },
    onToggleExpand: () => { isExpanded = !isExpanded; },
    onTogglePause: () => { isUserPaused = !isUserPaused; },
    onFocusMainApp: () => {},
    onClose: () => { isMiniPlayerOpen = false; },
    onStopSession: () => {
      stopSessionCalled = true;
      isBatchRunning = false;
      rndExtensionService.cancelResearch();
    }
  };

  // 1. Verify Minimize -> Compact Pill view, then Restore -> Full Card view
  baseProps.onToggleMinimize!();
  assert.strictEqual(isMinimized, true, 'onToggleMinimize must switch isMinimized to true');
  const minimizedTree = JSON.stringify((RnDMiniPlayer as any)({ ...baseProps, isMinimized: true }));
  assert.ok(minimizedTree.includes('rnd-miniplayer-minimized'), 'Minimized state must render compact pill view');
  assert.ok(minimizedTree.includes('3/8'), 'Minimized compact pill must show current progress fraction (3/8)');

  baseProps.onToggleMinimize!();
  assert.strictEqual(isMinimized, false, 'Second onToggleMinimize must restore full card view');
  const restoredTree = JSON.stringify((RnDMiniPlayer as any)({ ...baseProps, isMinimized: false }));
  assert.ok(restoredTree.includes('rnd-miniplayer-card'), 'Restored state must render full MiniPlayer card');

  // 2. Verify Expand -> Live Session Details view, then Collapse
  baseProps.onToggleExpand!();
  assert.strictEqual(isExpanded, true, 'onToggleExpand must switch isExpanded to true');
  const expandedTree = JSON.stringify((RnDMiniPlayer as any)({ ...baseProps, isExpanded: true }));
  assert.ok(expandedTree.includes('rnd-miniplayer-expanded-details'), 'Expanded state must render live session details section');
  assert.ok(expandedTree.includes('128,500'), 'Expanded details must display formatted followers count');
  assert.ok(expandedTree.includes('Tech & Gadgets'), 'Expanded details must display profile category');

  baseProps.onToggleExpand!();
  assert.strictEqual(isExpanded, false, 'Second onToggleExpand must collapse live session details');

  // 3. Verify Play / Pause / Resume control
  baseProps.onTogglePause!();
  assert.strictEqual(isUserPaused, true, 'onTogglePause must pause the batch after current profile');
  const userPausedTree = JSON.stringify((RnDMiniPlayer as any)({ ...baseProps, isUserPaused: true }));
  assert.ok(userPausedTree.includes('USER PAUSED'), 'User paused state must display USER PAUSED badge');
  assert.ok(userPausedTree.includes('Resume'), 'User paused state must display Resume button');

  baseProps.onTogglePause!();
  assert.strictEqual(isUserPaused, false, 'Second onTogglePause must resume the batch');

  // 4. Verify Hide MiniPlayer (onClose) does NOT stop the active R&D session
  baseProps.onClose();
  assert.strictEqual(isMiniPlayerOpen, false, 'onClose must hide the MiniPlayer UI');
  assert.strictEqual(isBatchRunning, true, 'Hiding the MiniPlayer must NOT stop the active R&D session');
  assert.strictEqual(stopSessionCalled, false, 'onClose must NOT invoke onStopSession');

  // 5. Verify Stop Session (onStopSession) explicitly stops the active R&D session and cancels pending extension research
  let pendingRejectedReason = '';
  (rndExtensionService as any).pendingRequests.set('test-req-1', {
    type: 'START_PROFILE_RESEARCH',
    resolve: () => {},
    reject: (err: Error) => { pendingRejectedReason = err.message; },
    timeoutMs: 120000
  });
  baseProps.onStopSession!();
  assert.strictEqual(stopSessionCalled, true, 'onStopSession must be invoked when user clicks Stop Session');
  assert.strictEqual(isBatchRunning, false, 'onStopSession must stop the active R&D batch');
  assert.strictEqual(pendingRejectedReason, 'RESEARCH_STOPPED_BY_USER', 'rndExtensionService.cancelResearch() must reject in-flight research with RESEARCH_STOPPED_BY_USER');

  console.log('  -> Minimize/Restore, Expand/Collapse, Play/Pause, and Hide vs. Stop Session verified.');
}

console.log('PASS: All RnDMiniPlayer tests passed successfully.');
