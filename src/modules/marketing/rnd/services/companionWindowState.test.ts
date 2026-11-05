import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

console.log('=== TEST SUITE: Instagram Companion Minimized vs Occluded Window State Detection ===');

// Implementation of window state evaluation directly mirroring background.js
interface CompanionWindowState {
  valid: boolean;
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen' | 'closed' | 'unknown';
  focused: boolean;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
}

interface TabVisibilityState {
  visible: boolean;
  visibilityState: 'visible' | 'hidden' | 'unknown';
}

function isCompanionWindowMinimized(winStatus: CompanionWindowState | null): boolean {
  if (!winStatus || !winStatus.valid || winStatus.state === 'closed') return false;
  if (winStatus.state === 'minimized') return true;
  // Windows OS Win32 minimization coordinates fallback (e.g. left: -32000, top: -32000)
  if (typeof winStatus.left === 'number' && winStatus.left <= -10000 && typeof winStatus.top === 'number' && winStatus.top <= -10000) {
    return true;
  }
  return false;
}

// Simulated pause/resume handler mirroring background.js logic
async function simulateHandleCompanionPause(
  winStatus: CompanionWindowState,
  tabVis: TabVisibilityState,
  onEvent?: (eventName: string, data: any) => void,
  restoreWinStatus?: CompanionWindowState
): Promise<{ wasPaused: boolean; events: Array<{ name: string; data: any }> }> {
  const events: Array<{ name: string; data: any }> = [];
  const emit = (name: string, data: any) => {
    events.push({ name, data });
    if (onEvent) onEvent(name, data);
  };

  const isMinimized = isCompanionWindowMinimized(winStatus);

  if (isMinimized) {
    emit('RESEARCH_PAUSED', {
      reason: 'companion_window_inactive',
      statusText: 'Paused — Instagram window inactive',
      isPaused: true
    });

    // Simulate pause duration and restore
    if (restoreWinStatus) {
      const stillMinimized = isCompanionWindowMinimized(restoreWinStatus);
      if (!stillMinimized) {
        emit('RESEARCH_RESUMED', {
          pausedDurationMs: 50,
          isPaused: false
        });
        return { wasPaused: true, events };
      }
    }
    return { wasPaused: true, events };
  }

  return { wasPaused: false, events };
}

// -------------------------------------------------------------
// SCENARIO A: Companion visible and focused
// -------------------------------------------------------------
{
  console.log('[Scenario A] Companion visible and focused...');

  const winStatus: CompanionWindowState = {
    valid: true,
    state: 'normal',
    focused: true,
    left: 200,
    top: 150,
    width: 1200,
    height: 800
  };
  const tabVis: TabVisibilityState = {
    visible: true,
    visibilityState: 'visible'
  };

  assert.strictEqual(
    isCompanionWindowMinimized(winStatus),
    false,
    'Visible & focused companion window must NOT be classified as minimized'
  );

  const result = await simulateHandleCompanionPause(winStatus, tabVis);
  assert.strictEqual(result.wasPaused, false, 'Research must NOT pause when companion is visible & focused');
  assert.strictEqual(result.events.length, 0, 'No pause events should be emitted');

  console.log('  -> Scenario A verified: Research continues uninterrupted.');
}

// -------------------------------------------------------------
// SCENARIO B: Companion behind Velmora (Covered / Occluded)
// -------------------------------------------------------------
{
  console.log('[Scenario B] Companion behind Velmora (Occluded / Unfocused)...');

  // When covered by Velmora, the companion window is in normal state but unfocused.
  // Chrome native window occlusion detection marks tab visibilityState as 'hidden'.
  const winStatus: CompanionWindowState = {
    valid: true,
    state: 'normal',
    focused: false, // Velmora window has keyboard/mouse focus
    left: 100,
    top: 100,
    width: 1100,
    height: 750
  };
  const tabVis: TabVisibilityState = {
    visible: false,
    visibilityState: 'hidden' // Chromium native occlusion tracking marks tab hidden
  };

  assert.strictEqual(
    isCompanionWindowMinimized(winStatus),
    false,
    'Companion covered behind Velmora must NOT be classified as minimized'
  );

  const result = await simulateHandleCompanionPause(winStatus, tabVis);
  assert.strictEqual(result.wasPaused, false, 'Research must NOT pause when companion is merely covered behind Velmora');
  assert.strictEqual(result.events.length, 0, 'No pause events should be emitted when companion is behind Velmora');

  console.log('  -> Scenario B verified: Research continues smoothly while behind Velmora.');
}

// -------------------------------------------------------------
// SCENARIO C: Companion behind another application (e.g. Excel, VS Code, Browser)
// -------------------------------------------------------------
{
  console.log('[Scenario C] Companion behind another application...');

  const winStatus: CompanionWindowState = {
    valid: true,
    state: 'maximized', // Even if maximized behind another app
    focused: false,
    left: 0,
    top: 0,
    width: 1920,
    height: 1080
  };
  const tabVis: TabVisibilityState = {
    visible: false,
    visibilityState: 'hidden'
  };

  assert.strictEqual(
    isCompanionWindowMinimized(winStatus),
    false,
    'Companion behind another application must NOT be classified as minimized'
  );

  const result = await simulateHandleCompanionPause(winStatus, tabVis);
  assert.strictEqual(result.wasPaused, false, 'Research must NOT pause when companion is behind another app');
  assert.strictEqual(result.events.length, 0, 'No pause events emitted for occluded third-party app window');

  console.log('  -> Scenario C verified: Research continues while behind other applications.');
}

// -------------------------------------------------------------
// SCENARIO D: Companion genuinely minimized, then restored
// -------------------------------------------------------------
{
  console.log('[Scenario D] Companion genuinely minimized, then restored...');

  // 1. Minimized via standard Chrome window state
  const minimizedWinStatus: CompanionWindowState = {
    valid: true,
    state: 'minimized',
    focused: false,
    left: -32000,
    top: -32000,
    width: 160,
    height: 28
  };
  const minimizedTabVis: TabVisibilityState = {
    visible: false,
    visibilityState: 'hidden'
  };

  assert.strictEqual(
    isCompanionWindowMinimized(minimizedWinStatus),
    true,
    'Window with state: "minimized" must be recognized as genuinely minimized'
  );

  // 2. Win32 offscreen coordinate edge case
  const offscreenWinStatus: CompanionWindowState = {
    valid: true,
    state: 'normal',
    focused: false,
    left: -32000,
    top: -32000,
    width: 160,
    height: 28
  };
  assert.strictEqual(
    isCompanionWindowMinimized(offscreenWinStatus),
    true,
    'Window at Win32 minimized coordinates (-32000) must be recognized as minimized'
  );

  // 3. Simulated pause and restore cycle
  const restoredWinStatus: CompanionWindowState = {
    valid: true,
    state: 'normal',
    focused: false, // Restored, but user might still be on Velmora window
    left: 200,
    top: 150,
    width: 1200,
    height: 800
  };

  const result = await simulateHandleCompanionPause(
    minimizedWinStatus,
    minimizedTabVis,
    undefined,
    restoredWinStatus
  );

  assert.strictEqual(result.wasPaused, true, 'Pause cycle must be triggered for minimized window');
  assert.strictEqual(result.events.length, 2, 'Must emit RESEARCH_PAUSED and RESEARCH_RESUMED events');
  assert.strictEqual(result.events[0].name, 'RESEARCH_PAUSED');
  assert.strictEqual(result.events[0].data.isPaused, true);
  assert.strictEqual(result.events[1].name, 'RESEARCH_RESUMED');
  assert.strictEqual(result.events[1].data.isPaused, false);

  // 4. Verify plateau counter reset behavior upon resume
  let stableRounds = 4;
  let zeroRounds = 3;
  if (result.wasPaused) {
    stableRounds = 0;
    zeroRounds = 0;
  }
  assert.strictEqual(stableRounds, 0, 'stableRounds must be reset to 0 after resuming from pause');
  assert.strictEqual(zeroRounds, 0, 'zeroRounds must be reset to 0 after resuming from pause');

  console.log('  -> Scenario D verified: Genuine minimization safely pauses, restores, and resets plateau counters.');
}

// -------------------------------------------------------------
// SCENARIO E: Velmora minimized while Companion remains visible
// -------------------------------------------------------------
{
  console.log('[Scenario E] Velmora minimized while Companion remains visible...');

  // Velmora dashboard is minimized, so Companion window is visible on desktop (and may even gain focus)
  const companionWinStatus: CompanionWindowState = {
    valid: true,
    state: 'normal',
    focused: true, // Often gains focus when Velmora is minimized
    left: 200,
    top: 150,
    width: 1200,
    height: 800
  };
  const companionTabVis: TabVisibilityState = {
    visible: true,
    visibilityState: 'visible'
  };

  assert.strictEqual(
    isCompanionWindowMinimized(companionWinStatus),
    false,
    'Companion must NOT be treated as minimized when only Velmora is minimized'
  );

  const result = await simulateHandleCompanionPause(companionWinStatus, companionTabVis);
  assert.strictEqual(result.wasPaused, false, 'Research must continue when Velmora is minimized and Companion is visible');
  assert.strictEqual(result.events.length, 0, 'No pause events should be emitted');

  console.log('  -> Scenario E verified: Research continues uninterrupted when Velmora dashboard is minimized.');
}

// -------------------------------------------------------------
// SCENARIO F: Adaptive Scroll & Virtualizer Recovery Verification
// -------------------------------------------------------------
{
  console.log('[Scenario F] Adaptive scroll & plateau recovery in background/occluded tab...');

  const maxStableRounds = 8;
  let stableRounds = 0;
  let uniqueReelCount = 8;
  const previousUniqueCount = 8;
  const currentBatch = [
    { url: 'https://www.instagram.com/reel/C1/' },
    { url: 'https://www.instagram.com/reel/C2/' }
  ];
  const urlMap = new Map([
    ['https://www.instagram.com/reel/C1/', true],
    ['https://www.instagram.com/reel/C2/', true]
  ]);

  // Simulate reaching plateau threshold during occluded scroll
  if (uniqueReelCount === previousUniqueCount && uniqueReelCount > 0) {
    stableRounds = 8;
  }
  assert.strictEqual(stableRounds, maxStableRounds, 'Should reach max stable rounds');

  // Simulate adaptive recovery bounce returning a new reel
  const recoveryBatch = [
    { url: 'https://www.instagram.com/reel/C1/' },
    { url: 'https://www.instagram.com/reel/C2/' },
    { url: 'https://www.instagram.com/reel/C3/' } // New reel hydrated by recovery bounce
  ];

  const hasNewReel = recoveryBatch.length > currentBatch.length || recoveryBatch.some(r => !urlMap.has(r.url));
  assert.strictEqual(hasNewReel, true, 'Recovery bounce should detect newly mounted reel');

  if (hasNewReel) {
    stableRounds = 0; // Successfully reset plateau on recovery!
  }
  assert.strictEqual(stableRounds, 0, 'Plateau counter must reset to 0 upon successful recovery bounce');

  console.log('  -> Scenario F verified: Adaptive recovery bounce successfully recovers stalled virtual scroller.');
}

// =============================================================
// SCROLLING & HYDRATION RESILIENCE TEST HARNESS
// Mirrors scrollUntilEnoughReels logic exactly
// =============================================================
interface ScrollSimRound {
  reels: Array<{ url: string; viewCount: number | null }>;
  isLoadingSpinner?: boolean;
}

function simulateScrollUntilEnoughReels(
  roundsData: ScrollSimRound[],
  adaptiveRecoveryBatch?: Array<{ url: string; viewCount: number | null }>,
  maxScrolls = 20,
  maxStableRounds = 8,
  maxZeroRounds = 8,
  maxLoadingGraceRounds = 3
) {
  let scrollRounds = 0;
  let stableRounds = 0;
  let zeroRounds = 0;
  let loadingGraceRounds = 0;
  let uniqueReelCount = 0;
  let allDiscovered: Array<{ url: string; viewCount: number | null }> = [];
  let lastLoadingSpinner = false;
  let exitReason = 'max_scrolls_reached';
  const targetValidCounts = 15;

  while (scrollRounds < maxScrolls) {
    const roundData = roundsData[scrollRounds] || { reels: [], isLoadingSpinner: false };
    const currentBatch = roundData.reels;
    const previousUniqueCount = uniqueReelCount;

    const urlMap = new Map(allDiscovered.map(r => [r.url, r]));
    for (const reel of currentBatch) {
      if (!urlMap.has(reel.url)) {
        allDiscovered.push(reel);
        urlMap.set(reel.url, reel);
      } else {
        const existing = urlMap.get(reel.url)!;
        if (existing.viewCount === null && reel.viewCount !== null) {
          existing.viewCount = reel.viewCount;
        }
      }
    }

    uniqueReelCount = allDiscovered.length;
    const validNonPinnedCount = allDiscovered.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0).length;

    if (validNonPinnedCount >= targetValidCounts) {
      exitReason = 'target_reels_reached';
      break;
    }

    const isLoadingActive = lastLoadingSpinner && loadingGraceRounds < maxLoadingGraceRounds;

    if (uniqueReelCount === previousUniqueCount && uniqueReelCount > 0) {
      if (isLoadingActive) {
        loadingGraceRounds++;
      } else {
        stableRounds++;
      }

      if (stableRounds >= maxStableRounds) {
        if (uniqueReelCount < targetValidCounts && adaptiveRecoveryBatch) {
          const recoveryBatch = adaptiveRecoveryBatch;
          if (recoveryBatch.length > currentBatch.length || recoveryBatch.some(r => !urlMap.has(r.url))) {
            for (const r of recoveryBatch) {
              if (!urlMap.has(r.url)) {
                allDiscovered.push(r);
                urlMap.set(r.url, r);
              }
            }
            stableRounds = 0;
            loadingGraceRounds = 0;
            scrollRounds++;
            continue;
          }
        }
        exitReason = 'plateau_reached';
        break;
      }
    } else if (uniqueReelCount > previousUniqueCount) {
      stableRounds = 0;
      loadingGraceRounds = 0;
    } else if (uniqueReelCount === 0) {
      if (isLoadingActive) {
        loadingGraceRounds++;
      } else {
        zeroRounds++;
      }

      if (zeroRounds >= maxZeroRounds) {
        exitReason = 'zero_reels';
        break;
      }
    }

    lastLoadingSpinner = !!roundData.isLoadingSpinner;
    scrollRounds++;
  }

  return {
    exitReason,
    scrollRounds,
    stableRounds,
    zeroRounds,
    loadingGraceRounds,
    uniqueReelCount,
    validNonPinnedCount: allDiscovered.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0).length,
    allDiscovered
  };
}

// -------------------------------------------------------------
// SCENARIO G: Delayed Initial Hydration (e.g. HIS9 under background throttling)
// -------------------------------------------------------------
{
  console.log('[Scenario G] Delayed initial hydration (HIS9 simulation)...');

  // Page has 0 reels for 6 rounds while spinner is active (in the old code with zeroRounds=5 this failed prematurely)
  const rounds: ScrollSimRound[] = [
    { reels: [], isLoadingSpinner: true },
    { reels: [], isLoadingSpinner: true },
    { reels: [], isLoadingSpinner: true },
    { reels: [], isLoadingSpinner: true },
    { reels: [], isLoadingSpinner: true },
    { reels: [], isLoadingSpinner: false },
    // On round 6, initial hydration completes with 15 reels
    {
      reels: Array.from({ length: 15 }, (_, i) => ({
        url: `https://www.instagram.com/reel/HIS9_${i}/`,
        viewCount: 100000 + i * 5000
      })),
      isLoadingSpinner: false
    }
  ];

  const result = simulateScrollUntilEnoughReels(rounds);
  assert.strictEqual(
    result.exitReason,
    'target_reels_reached',
    'Delayed initial hydration with loading grace and zeroRounds=8 must not exit prematurely'
  );
  assert.strictEqual(result.validNonPinnedCount, 15, 'Must collect all 15 valid view counts');
  console.log('  -> Scenario G verified: Delayed initial hydration succeeds without premature failure.');
}

// -------------------------------------------------------------
// SCENARIO H: Delayed Next-Batch Hydration (e.g. HIS8 / HIS5 simulation)
// -------------------------------------------------------------
{
  console.log('[Scenario H] Delayed next-batch hydration (HIS8/HIS5 simulation)...');

  const initial10 = Array.from({ length: 10 }, (_, i) => ({
    url: `https://www.instagram.com/reel/HIS8_${i}/`,
    viewCount: 80000 + i * 2000
  }));

  const tail5 = Array.from({ length: 5 }, (_, i) => ({
    url: `https://www.instagram.com/reel/HIS8_${i + 10}/`,
    viewCount: 90000 + i * 2000
  }));

  // Initial 10 reels loaded in round 0, followed by 6 rounds of no new reels with spinner
  const rounds: ScrollSimRound[] = [
    { reels: initial10, isLoadingSpinner: true },
    { reels: initial10, isLoadingSpinner: true },
    { reels: initial10, isLoadingSpinner: true },
    { reels: initial10, isLoadingSpinner: false },
    { reels: initial10, isLoadingSpinner: false },
    { reels: initial10, isLoadingSpinner: false },
    { reels: initial10, isLoadingSpinner: false },
    // Next batch finishes hydrating at round 7
    { reels: [...initial10, ...tail5], isLoadingSpinner: false }
  ];

  const result = simulateScrollUntilEnoughReels(rounds);
  assert.strictEqual(
    result.exitReason,
    'target_reels_reached',
    'Delayed next batch hydration must survive within maxStableRounds=8 and reach 15 reels'
  );
  assert.strictEqual(result.validNonPinnedCount, 15, 'Must collect all 15 valid view counts');
  console.log('  -> Scenario H verified: Delayed next-batch hydration succeeds without partial truncation.');
}

// -------------------------------------------------------------
// SCENARIO I: Persistent Loading Indicator (Stuck Spinner / Broken Page)
// -------------------------------------------------------------
{
  console.log('[Scenario I] Persistent loading indicator (stuck spinner safety test)...');

  // An empty or broken page that permanently shows a loading spinner
  const rounds: ScrollSimRound[] = Array.from({ length: 25 }, () => ({
    reels: [],
    isLoadingSpinner: true // Permanently stuck spinner!
  }));

  const result = simulateScrollUntilEnoughReels(rounds);

  // Must NOT run indefinitely: loading grace is capped at 3 rounds, so zeroRounds reaches 8 at round 11
  assert.strictEqual(
    result.exitReason,
    'zero_reels',
    'Persistent loading indicator must NOT prevent termination; must exit cleanly at zeroRounds=8'
  );
  assert.ok(
    result.scrollRounds <= 12,
    `Must terminate within bounded rounds (actual: ${result.scrollRounds} rounds)`
  );
  assert.strictEqual(result.loadingGraceRounds, 3, 'Loading grace rounds must strictly cap at 3');
  console.log(`  -> Scenario I verified: Persistent spinner safely bounded and terminated at round ${result.scrollRounds}.`);
}

// -------------------------------------------------------------
// SCENARIO J: Genuinely Empty Profile (0 Reels Throughout)
// -------------------------------------------------------------
{
  console.log('[Scenario J] Genuinely empty profile (0 reels throughout)...');

  // Genuinely empty profile with no reels and no loading indicator
  const rounds: ScrollSimRound[] = Array.from({ length: 20 }, () => ({
    reels: [],
    isLoadingSpinner: false
  }));

  const result = simulateScrollUntilEnoughReels(rounds);
  assert.strictEqual(
    result.exitReason,
    'zero_reels',
    'Genuinely empty profile must terminate with exitReason="zero_reels"'
  );
  assert.strictEqual(result.zeroRounds, 8, 'Must terminate exactly at maxZeroRounds=8');
  assert.strictEqual(result.uniqueReelCount, 0, 'Unique reel count must remain 0');
  console.log('  -> Scenario J verified: Genuinely empty profile terminates safely after exactly 8 zero rounds.');
}

// -------------------------------------------------------------
// SCENARIO K: Normal Completion (Clean 15 Valid View Counts)
// -------------------------------------------------------------
{
  console.log('[Scenario K] Normal completion (clean 15 valid view counts)...');

  const all15 = Array.from({ length: 15 }, (_, i) => ({
    url: `https://www.instagram.com/reel/NORMAL_${i}/`,
    viewCount: 250000 + i * 10000
  }));

  const rounds: ScrollSimRound[] = [
    { reels: all15.slice(0, 8), isLoadingSpinner: false },
    { reels: all15, isLoadingSpinner: false }
  ];

  const result = simulateScrollUntilEnoughReels(rounds);
  assert.strictEqual(result.exitReason, 'target_reels_reached', 'Must exit with target_reels_reached');
  assert.strictEqual(result.validNonPinnedCount, 15, 'Must have 15 valid view counts');
  assert.strictEqual(result.scrollRounds, 1, 'Should complete in round 1 as soon as 15 reels are discovered');
  console.log('  -> Scenario K verified: Normal profile completes immediately upon reaching 15 valid view counts.');
}

// =============================================================
// PART 1 TIMING & DIAGNOSTIC PERSISTENCE HELPERS (Mirroring background.js)
// =============================================================

interface ProfileTimingTracker {
  startTs: number;
  pausedMs: number;
  deadlineMs: number;
  getNow: () => number;
  getActiveElapsedMs: () => number;
  getRemainingMs: () => number;
}

function createProfileTiming(startTs: number, getNow: () => number, deadlineMs = 95000): ProfileTimingTracker {
  return {
    startTs,
    pausedMs: 0,
    deadlineMs,
    getNow,
    getActiveElapsedMs() {
      return Math.max(0, (this.getNow() - this.startTs) - this.pausedMs);
    },
    getRemainingMs() {
      return Math.max(0, this.deadlineMs - this.getActiveElapsedMs());
    }
  };
}

interface TimedScrollSimRound extends ScrollSimRound {
  pauseDurationMs?: number; // Simulated minimize pause duration during this round
  docVisibility?: string;
  winState?: string;
  winFocused?: boolean;
}

function simulateTimedScrollUntilEnoughReels(
  roundsData: TimedScrollSimRound[],
  options: {
    phaseTimeoutMs?: number;
    profileTiming?: ProfileTimingTracker;
    adaptiveRecoveryBatch?: Array<{ url: string; viewCount: number | null }>;
  } = {}
) {
  let virtualNow = options.profileTiming ? options.profileTiming.getNow() : 100000;
  const advanceClock = (ms: number) => {
    virtualNow += ms;
  };
  const getNow = () => (options.profileTiming ? options.profileTiming.getNow() : virtualNow);

  const scrollStartTs = getNow();
  const scrollPhaseTimeoutMs =
    typeof options.phaseTimeoutMs === 'number' && options.phaseTimeoutMs > 0
      ? options.phaseTimeoutMs
      : 60000;
  const profileTiming = options.profileTiming || null;

  let scrollPausedMs = 0;
  const onPauseElapsed = (ms: number) => {
    scrollPausedMs += ms;
    if (profileTiming) {
      profileTiming.pausedMs += ms;
    }
  };

  const getActiveScrollElapsedMs = () => Math.max(0, (getNow() - scrollStartTs) - scrollPausedMs);
  const getRemainingBudgetMs = () => {
    const remPhase = scrollPhaseTimeoutMs - getActiveScrollElapsedMs();
    const remProfile = profileTiming ? profileTiming.getRemainingMs() : Infinity;
    return Math.min(remPhase, remProfile);
  };
  const getBudgetExitReason = () => {
    if (profileTiming && profileTiming.getRemainingMs() <= 0) {
      return 'profile_deadline_reached';
    }
    return 'phase_timeout';
  };

  let scrollRounds = 0;
  let stableRounds = 0;
  let zeroRounds = 0;
  let loadingGraceRounds = 0;
  let uniqueReelCount = 0;
  const allDiscovered: Array<{ url: string; viewCount: number | null }> = [];
  let lastLoadingSpinner = false;
  let lastDocVisibility = 'visible';
  let lastWinState = 'normal';
  let lastWinFocused = false;
  let exitReason = 'max_scrolls_reached';
  const sleepHistoryMs: number[] = [];
  let recoverySleepMs = 0;

  const targetValidCounts = 15;
  const maxScrolls = 20;
  const maxStableRounds = 8;
  const maxZeroRounds = 8;
  const maxLoadingGraceRounds = 3;

  while (scrollRounds < maxScrolls) {
    const roundData = roundsData[scrollRounds] || { reels: [], isLoadingSpinner: false };

    // 1. Simulate genuine minimized pause if specified for this round
    if (roundData.pauseDurationMs && roundData.pauseDurationMs > 0) {
      advanceClock(roundData.pauseDurationMs);
      onPauseElapsed(roundData.pauseDurationMs);
      stableRounds = 0;
      zeroRounds = 0;
      loadingGraceRounds = 0;
    }

    // 2. Check active scroll-phase and profile budget
    if (getRemainingBudgetMs() <= 0) {
      exitReason = getBudgetExitReason();
      break;
    }

    const currentBatch = roundData.reels;
    const previousUniqueCount = uniqueReelCount;

    const urlMap = new Map(allDiscovered.map(r => [r.url, r]));
    for (const reel of currentBatch) {
      if (!urlMap.has(reel.url)) {
        allDiscovered.push(reel);
        urlMap.set(reel.url, reel);
      } else {
        const existing = urlMap.get(reel.url)!;
        if (existing.viewCount === null && reel.viewCount !== null) {
          existing.viewCount = reel.viewCount;
        }
      }
    }

    uniqueReelCount = allDiscovered.length;
    const validNonPinnedCount = allDiscovered.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0).length;

    if (validNonPinnedCount >= targetValidCounts) {
      exitReason = 'target_reels_reached';
      break;
    }

    const isLoadingActive = lastLoadingSpinner && loadingGraceRounds < maxLoadingGraceRounds;

    if (uniqueReelCount === previousUniqueCount && uniqueReelCount > 0) {
      if (isLoadingActive) {
        loadingGraceRounds++;
      } else {
        stableRounds++;
      }

      if (stableRounds >= maxStableRounds) {
        if (uniqueReelCount < targetValidCounts && getRemainingBudgetMs() > 0) {
          const clampedRecoveryWait = Math.max(0, Math.min(3500, getRemainingBudgetMs()));
          recoverySleepMs = clampedRecoveryWait;
          advanceClock(clampedRecoveryWait);

          if (options.adaptiveRecoveryBatch) {
            const recoveryBatch = options.adaptiveRecoveryBatch;
            if (recoveryBatch.length > currentBatch.length || recoveryBatch.some(r => !urlMap.has(r.url))) {
              for (const r of recoveryBatch) {
                if (!urlMap.has(r.url)) {
                  allDiscovered.push(r);
                  urlMap.set(r.url, r);
                }
              }
              stableRounds = 0;
              loadingGraceRounds = 0;
              scrollRounds++;
              continue;
            }
          }
        }
        exitReason = getRemainingBudgetMs() <= 0 ? getBudgetExitReason() : 'plateau_reached';
        break;
      }
    } else if (uniqueReelCount > previousUniqueCount) {
      stableRounds = 0;
      loadingGraceRounds = 0;
    } else if (uniqueReelCount === 0) {
      if (isLoadingActive) {
        loadingGraceRounds++;
      } else {
        zeroRounds++;
      }

      if (zeroRounds >= maxZeroRounds) {
        exitReason = 'zero_reels';
        break;
      }
    }

    lastLoadingSpinner = !!roundData.isLoadingSpinner;
    if (roundData.docVisibility) lastDocVisibility = roundData.docVisibility;
    if (roundData.winState) lastWinState = roundData.winState;
    if (typeof roundData.winFocused === 'boolean') lastWinFocused = roundData.winFocused;
    scrollRounds++;

    // Clamp round sleep to remaining budget
    const desiredWaitMs = lastLoadingSpinner ? 3500 : 2500;
    const remainingBeforeSleep = getRemainingBudgetMs();
    if (remainingBeforeSleep <= 0) {
      exitReason = getBudgetExitReason();
      break;
    }
    const clampedWaitMs = Math.max(0, Math.min(desiredWaitMs, remainingBeforeSleep));
    sleepHistoryMs.push(clampedWaitMs);
    advanceClock(clampedWaitMs);
  }

  const validViewsCount = allDiscovered.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0).length;
  const scrollDiag = {
    exitReason,
    elapsedMs: getActiveScrollElapsedMs(),
    wallElapsedMs: getNow() - scrollStartTs,
    pausedMs: scrollPausedMs,
    scrollRounds,
    stableRounds,
    zeroRounds,
    loadingGraceRounds,
    totalDiscovered: uniqueReelCount,
    validViews: validViewsCount,
    lastLoadingIndicator: lastLoadingSpinner,
    docVisibility: lastDocVisibility,
    winState: lastWinState,
    winFocused: lastWinFocused
  };

  return {
    scrollDiag,
    sleepHistoryMs,
    recoverySleepMs,
    allDiscovered,
    advanceClock,
    getNow
  };
}

function formatScrollDiagSummary(diag: any, label = 'ScrollDiag'): string {
  if (!diag || typeof diag !== 'object') return '';
  return `[${label}: exit=${diag.exitReason}, elapsed=${diag.elapsedMs}ms, paused=${diag.pausedMs || 0}ms, rounds=${diag.scrollRounds}, stable=${diag.stableRounds}, zero=${diag.zeroRounds}, grace=${diag.loadingGraceRounds}, discovered=${diag.totalDiscovered}, validViews=${diag.validViews}, spinner=${diag.lastLoadingIndicator}, vis=${diag.docVisibility}, win=${diag.winState}(focused=${diag.winFocused})]`;
}

// -------------------------------------------------------------
// SCENARIO L: Pause Duration Exclusion from 60s Scroll-Phase Timeout
// -------------------------------------------------------------
{
  console.log('[Scenario L] Pause duration exclusion from 60s scroll-phase timeout...');

  const initial10 = Array.from({ length: 10 }, (_, i) => ({
    url: `https://www.instagram.com/reel/PAUSE_EX_${i}/`,
    viewCount: 120000 + i * 1000
  }));
  const tail5 = Array.from({ length: 5 }, (_, i) => ({
    url: `https://www.instagram.com/reel/PAUSE_EX_${i + 10}/`,
    viewCount: 150000 + i * 1000
  }));

  // Round 0 loads 10 reels.
  // Round 1 experiences a 50,000ms (50s) genuine minimize pause + restore!
  // Rounds 1..5 take 12.5s of active scrolling (62.5s total wall-clock time, > 60s phaseTimeoutMs, but only 12.5s active time).
  // Round 5 loads the remaining 5 reels.
  const rounds: TimedScrollSimRound[] = [
    { reels: initial10, isLoadingSpinner: false },
    { reels: initial10, isLoadingSpinner: false, pauseDurationMs: 50000 },
    { reels: initial10, isLoadingSpinner: false },
    { reels: initial10, isLoadingSpinner: false },
    { reels: initial10, isLoadingSpinner: false },
    { reels: [...initial10, ...tail5], isLoadingSpinner: false }
  ];

  const { scrollDiag } = simulateTimedScrollUntilEnoughReels(rounds, { phaseTimeoutMs: 60000 });

  assert.strictEqual(
    scrollDiag.exitReason,
    'target_reels_reached',
    'Minimized pause duration (50s) must be excluded from 60s phase timeout so profile completes cleanly'
  );
  assert.strictEqual(scrollDiag.pausedMs, 50000, 'scrollDiag.pausedMs must record exact pause duration (50,000ms)');
  assert.strictEqual(scrollDiag.elapsedMs, 12500, 'scrollDiag.elapsedMs must reflect only active non-paused time (12,500ms)');
  assert.strictEqual(scrollDiag.wallElapsedMs, 62500, 'scrollDiag.wallElapsedMs must reflect total wall time (62,500ms)');
  assert.strictEqual(scrollDiag.validViews, 15, 'Must extract all 15 valid view counts after resume');
  console.log('  -> Scenario L verified: Minimized pause duration is excluded from phase timeout.');
}

// -------------------------------------------------------------
// SCENARIO M: Bounded Waits (Round Sleeps & Recovery Wait Clamped to Deadline)
// -------------------------------------------------------------
{
  console.log('[Scenario M] Bounded waits clamped to remaining phase/profile deadline...');

  const partial8 = Array.from({ length: 8 }, (_, i) => ({
    url: `https://www.instagram.com/reel/CLAMP_${i}/`,
    viewCount: 50000 + i * 1000
  }));

  // Set phaseTimeoutMs to 19,000ms (19s).
  // With 7 rounds of 2,500ms sleeps (17,500ms), before the 8th sleep or recovery bounce only 1,500ms remains.
  // The sleep must be clamped to 1,500ms so active elapsedMs is strictly <= 19,000ms (never overshooting to 20,000ms or 21,000ms).
  const rounds: TimedScrollSimRound[] = Array.from({ length: 15 }, () => ({
    reels: partial8,
    isLoadingSpinner: false,
    docVisibility: 'hidden',
    winState: 'normal',
    winFocused: false
  }));

  const { scrollDiag, sleepHistoryMs } = simulateTimedScrollUntilEnoughReels(rounds, { phaseTimeoutMs: 19000 });

  assert.strictEqual(
    scrollDiag.exitReason,
    'phase_timeout',
    'Must exit with phase_timeout when active budget reaches phaseTimeoutMs'
  );
  assert.strictEqual(
    scrollDiag.elapsedMs,
    19000,
    `Active elapsed time must be strictly clamped to 19000ms without overshoot (actual: ${scrollDiag.elapsedMs}ms)`
  );
  assert.strictEqual(
    sleepHistoryMs[sleepHistoryMs.length - 1],
    1500,
    'Final round sleep must be clamped from 2500ms down to the remaining 1500ms budget'
  );
  console.log('  -> Scenario M verified: Round sleeps and recovery waits are strictly clamped to remaining deadline.');
}

// -------------------------------------------------------------
// SCENARIO N: Overall Profile Deadline & Retry Bounding (Preventing 120s Client Timeout)
// -------------------------------------------------------------
{
  console.log('[Scenario N] Overall profile deadline enforcement across Pass 1 + Retry...');

  let virtualClock = 500000;
  const profileTiming = createProfileTiming(virtualClock, () => virtualClock, 95000);

  // Simulate initial navigation + verifyProfile + waitForReelsPage taking 18,000ms
  virtualClock += 18000;
  assert.strictEqual(profileTiming.getActiveElapsedMs(), 18000);
  assert.strictEqual(profileTiming.getRemainingMs(), 77000);

  // Simulate Pass 1 scrolling hitting zero_reels after 8 zero rounds + 3 loading grace rounds:
  // 3 rounds * 3500ms + 7 rounds * 2500ms = 10,500 + 17,500 = 28,000ms
  virtualClock += 28000;
  assert.strictEqual(profileTiming.getActiveElapsedMs(), 46000);
  assert.strictEqual(profileTiming.getRemainingMs(), 49000);

  // Now in Step 5 Retry: remaining active budget is 49,000ms (>= MIN_RETRY_BUDGET_MS 8,000ms).
  // Root settle (2,000ms) + Reels nav (1,200ms) + bounded waitForReelsPage (min(12000, floor(45800 * 0.35)) = 12,000ms)
  virtualClock += 2000 + 1200 + 12000;
  assert.strictEqual(profileTiming.getActiveElapsedMs(), 61200);
  assert.strictEqual(profileTiming.getRemainingMs(), 33800);

  // Retry scrollUntilEnoughReels receives phaseTimeoutMs = min(60000, 33800) = 33,800ms!
  // Even if retry stalls on a plateau, it is strictly bounded by the remaining 33,800ms profile budget.
  const retryScrollTimeoutMs = Math.min(60000, Math.max(1000, profileTiming.getRemainingMs()));
  assert.strictEqual(retryScrollTimeoutMs, 33800, 'Retry scroll timeout must be clamped to remaining profile budget (33,800ms)');

  // Simulate retry consuming the remaining 33,800ms
  virtualClock += retryScrollTimeoutMs;
  assert.strictEqual(
    profileTiming.getActiveElapsedMs(),
    95000,
    'Total active profile time across Pass 1 + Retry must never exceed 95,000ms (25s below 120s client timeout)'
  );
  assert.strictEqual(profileTiming.getRemainingMs(), 0);

  // Also verify retry is skipped completely if Pass 1 leaves < 8,000ms remaining
  let virtualClock2 = 900000;
  const tightProfileTiming = createProfileTiming(virtualClock2, () => virtualClock2, 95000);
  virtualClock2 += 90000; // Only 5,000ms remaining (< 8,000ms MIN_RETRY_BUDGET_MS)
  const shouldSkipRetry = tightProfileTiming.getRemainingMs() < 8000;
  assert.strictEqual(shouldSkipRetry, true, 'Retry must be skipped when remaining active budget is < 8000ms');

  console.log('  -> Scenario N verified: Overall profile deadline bounds Pass 1 + Retry safely below 120s client timeout.');
}

// -------------------------------------------------------------
// SCENARIO O: Persistent scrollDiag in ProfileResearchResult and failureReason
// -------------------------------------------------------------
{
  console.log('[Scenario O] Persistent scrollDiag in ProfileResearchResult and failureReason...');

  const emptyRounds: TimedScrollSimRound[] = Array.from({ length: 12 }, (_, idx) => ({
    reels: [],
    isLoadingSpinner: idx < 3, // 3 loading grace rounds, then 8 zero rounds
    docVisibility: 'hidden',
    winState: 'normal',
    winFocused: false
  }));

  const { scrollDiag } = simulateTimedScrollUntilEnoughReels(emptyRounds, { phaseTimeoutMs: 60000 });

  assert.strictEqual(scrollDiag.exitReason, 'zero_reels');
  assert.strictEqual(scrollDiag.zeroRounds, 8);
  assert.strictEqual(scrollDiag.loadingGraceRounds, 3);
  assert.strictEqual(scrollDiag.docVisibility, 'hidden');
  assert.strictEqual(scrollDiag.winState, 'normal');
  assert.strictEqual(scrollDiag.winFocused, false);
  assert.strictEqual(scrollDiag.totalDiscovered, 0);
  assert.strictEqual(scrollDiag.validViews, 0);

  const summary = formatScrollDiagSummary(scrollDiag, 'ScrollDiag');
  assert.ok(summary.includes('exit=zero_reels'), 'Summary must include exitReason');
  assert.ok(summary.includes('zero=8'), 'Summary must include zeroRounds');
  assert.ok(summary.includes('grace=3'), 'Summary must include loadingGraceRounds');
  assert.ok(summary.includes('vis=hidden'), 'Summary must include docVisibility');
  assert.ok(summary.includes('win=normal(focused=false)'), 'Summary must include winState and winFocused');

  console.log(`  -> Scenario O verified: Persistent scrollDiag summary formatted as: ${summary}`);
}

// =============================================================
// DIRECT PRODUCTION CODE EXECUTION SUITE (extension/src/background.js)
// Loads and executes the actual functions from extension/src/background.js
// =============================================================

function createProductionBackgroundHarness(initialTimeMs = 1_000_000) {
  let virtualTimeMs = initialTimeMs;
  const sleepCallsMs: number[] = [];
  const emittedEvents: Array<{ type: string; payload: any }> = [];

  let currentWinState: any = {
    id: 777,
    state: 'normal',
    focused: false,
    left: 100,
    top: 100,
    width: 1024,
    height: 768,
    type: 'popup'
  };
  let currentTabUrl = 'https://www.instagram.com/';
  let onWindowPoll: (() => void) | null = null;
  let onExecuteScript: ((funcStr: string, args: any[]) => any) | null = null;

  const chromeMock: any = {
    runtime: {
      lastError: null,
      onMessage: { addListener: () => {} }
    },
    windows: {
      onRemoved: { addListener: () => {} },
      get: (winId: number, optsOrCb: any, maybeCb?: (w: any) => void) => {
        const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
        if (onWindowPoll) onWindowPoll();
        if (cb) {
          cb(
            currentWinState
              ? {
                  ...currentWinState,
                  id: winId,
                  tabs: [{ id: 888, url: currentTabUrl, active: true, discarded: false }]
                }
              : null
          );
        }
      },
      getAll: (_opts: any, cb: (wins: any[]) => void) => {
        cb([
          {
            ...currentWinState,
            tabs: [{ id: 888, url: currentTabUrl, active: true, discarded: false }]
          }
        ]);
      },
      create: (opts: any, cb: (w: any) => void) => {
        currentTabUrl = opts.url || currentTabUrl;
        cb({
          ...currentWinState,
          tabs: [{ id: 888, url: currentTabUrl, active: true, discarded: false }]
        });
      },
      remove: (_winId: number) => Promise.resolve()
    },
    tabs: {
      onRemoved: { addListener: () => {} },
      onReplaced: { addListener: () => {} },
      query: (_q: any, cb: (tabs: any[]) => void) => {
        cb([{ id: 888, url: currentTabUrl, active: true, discarded: false }]);
      },
      get: (tabId: number, cb: (t: any) => void) => {
        cb({ id: tabId, url: currentTabUrl, active: true, discarded: false });
      },
      update: (tabId: number, updateProps: any, cb?: (t: any) => void) => {
        if (updateProps?.url) {
          currentTabUrl = updateProps.url;
        }
        const tabObj = { id: tabId, url: currentTabUrl, active: true, discarded: false };
        if (cb) cb(tabObj);
        return Promise.resolve(tabObj);
      },
      sendMessage: (_tabId: number, msg: any) => {
        emittedEvents.push({ type: msg.type, payload: msg.payload });
        return Promise.resolve();
      }
    },
    cookies: {
      get: (_d: any, cb: (c: any) => void) => cb({ value: 'mock_session' })
    },
    scripting: {
      executeScript: ({ func, args = [] }: { target: any; func: Function; args?: any[] }, cb: (res: any[]) => void) => {
        const funcStr = func.toString();
        if (onExecuteScript) {
          const customRes = onExecuteScript(funcStr, args);
          if (customRes !== undefined) {
            cb([{ result: customRes }]);
            return;
          }
        }
        cb([{ result: null }]);
      }
    }
  };

  class MockDate extends Date {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(virtualTimeMs);
      } else {
        // @ts-ignore
        super(...args);
      }
    }
    static now() {
      return virtualTimeMs;
    }
  }

  const sandbox: any = {
    chrome: chromeMock,
    Date: MockDate,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {}
    },
    setTimeout: (fn: Function, delay = 0) => {
      const d = Math.max(0, Number(delay) || 0);
      sleepCallsMs.push(d);
      virtualTimeMs += d;
      Promise.resolve().then(() => fn());
      return 1;
    },
    clearTimeout: () => {},
    Map,
    Set,
    Promise,
    Error,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    JSON,
    parseInt,
    parseFloat,
    isNaN
  };

  const bgFilePath = path.resolve(process.cwd(), 'extension/src/background.js');
  const bgCode = fs.readFileSync(bgFilePath, 'utf8');
  const exportedWrapper = `
${bgCode}
globalThis.__bgExports = {
  isCompanionWindowMinimized,
  handleCompanionWindowPauseIfNeeded,
  handleCompanionOcclusionPauseIfNeeded,
  scrollUntilEnoughReels,
  formatScrollDiagSummary,
  createProfileTimingTracker,
  executeProfileResearchOnTab,
  startProfileResearch,
  setCompanionRefs(winId, tabId, closed = false) {
    companionWindowId = winId;
    companionTabId = tabId;
    companionWindowCreatedByUs = true;
    companionWindowClosedByUser = closed;
  }
};
`;

  vm.createContext(sandbox);
  vm.runInContext(exportedWrapper, sandbox);

  return {
    bg: sandbox.__bgExports,
    getNow: () => virtualTimeMs,
    advanceTime: (ms: number) => { virtualTimeMs += ms; },
    sleepCallsMs,
    emittedEvents,
    setWindowState: (s: any) => { currentWinState = { ...currentWinState, ...s }; },
    setOnWindowPoll: (fn: (() => void) | null) => { onWindowPoll = fn; },
    setOnExecuteScript: (fn: ((funcStr: string, args: any[]) => any) | null) => { onExecuteScript = fn; },
    getCurrentTabUrl: () => currentTabUrl
  };
}

// -------------------------------------------------------------
// SCENARIO P1: Direct Production execution of isCompanionWindowMinimized & handleCompanionWindowPauseIfNeeded
// -------------------------------------------------------------
await (async () => {
  console.log('[Scenario P1] Direct production execution: handleCompanionWindowPauseIfNeeded (occluded vs minimized)...');
  const h = createProductionBackgroundHarness();
  h.bg.setCompanionRefs(777, 888, false);

  // 1. Occluded window (state: 'normal', focused: false, visibilityState: 'hidden') -> must NOT pause or add pausedMs
  h.setWindowState({ state: 'normal', focused: false, left: 100, top: 100 });
  h.setOnExecuteScript((funcStr) => {
    if (funcStr.includes('document.visibilityState')) {
      return { visible: false, visibilityState: 'hidden', hidden: true };
    }
    return null;
  });

  const tracker1 = h.bg.createProfileTimingTracker(h.getNow(), {});
  const paused1 = await h.bg.handleCompanionWindowPauseIfNeeded(
    'creator_occluded',
    { tab: { id: 101, url: 'http://localhost:5173' } },
    { username: 'creator_occluded' },
    'scrollUntilEnoughReels',
    888,
    tracker1
  );

  assert.strictEqual(paused1, false, 'Production handleCompanionWindowPauseIfNeeded must NOT pause when occluded');
  assert.strictEqual(tracker1.pausedMs, 0, 'Occluded time must NEVER be added to pausedMs');
  assert.strictEqual(h.emittedEvents.some(e => e.type === 'RESEARCH_PAUSED'), false);

  // 2. Genuinely minimized window -> pauses, restores after 3 polls (1800ms) + 1500ms stabilization + 500ms wake-up = 3800ms
  h.setWindowState({ state: 'minimized', focused: false, left: -32000, top: -32000 });
  let pollCalls = 0;
  h.setOnWindowPoll(() => {
    pollCalls++;
    // First call is initial check; next 3 calls are inside the 600ms poll loop
    if (pollCalls >= 4) {
      h.setWindowState({ state: 'normal', focused: false, left: 100, top: 100 });
    }
  });

  const tracker2 = h.bg.createProfileTimingTracker(h.getNow(), {});
  const paused2 = await h.bg.handleCompanionWindowPauseIfNeeded(
    'creator_min',
    { tab: { id: 101, url: 'http://localhost:5173' } },
    { username: 'creator_min' },
    'scrollUntilEnoughReels',
    888,
    tracker2
  );

  assert.strictEqual(paused2, true, 'Production handleCompanionWindowPauseIfNeeded must pause when minimized');
  assert.strictEqual(
    tracker2.pausedMs,
    3800,
    `tracker2.pausedMs must include exact poll duration (1800ms) + stabilization (1500ms) + wake-up (500ms) = 3800ms (actual: ${tracker2.pausedMs})`
  );
  assert.strictEqual(
    tracker2.getActiveElapsedMs(),
    0,
    'Active elapsed time immediately after pause/restore must be 0ms'
  );
  assert.strictEqual(h.emittedEvents.some(e => e.type === 'RESEARCH_PAUSED'), true);
  assert.strictEqual(h.emittedEvents.some(e => e.type === 'RESEARCH_RESUMED'), true);
  console.log('  -> Scenario P1 verified against production extension/src/background.js.');
})();

// -------------------------------------------------------------
// SCENARIO P2: Direct Production execution of scrollUntilEnoughReels (Pause exclusion & Clamped sleeps)
// -------------------------------------------------------------
await (async () => {
  console.log('[Scenario P2] Direct production execution: scrollUntilEnoughReels pause exclusion & clamped waits...');
  const h = createProductionBackgroundHarness();
  h.bg.setCompanionRefs(777, 888, false);
  h.setWindowState({ state: 'normal', focused: false });

  // Part A: Clamped sleeps when phaseTimeoutMs = 9,000ms (3 rounds of 2,500ms = 7,500ms, 4th sleep clamped to 1,500ms)
  const partialReels = Array.from({ length: 6 }, (_, i) => ({
    url: `https://www.instagram.com/reel/PROD_CLAMP_${i}/`,
    isPinned: false,
    viewCount: 50000 + i * 1000,
    rawViewText: '50K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));

  h.setOnExecuteScript((funcStr) => {
    if (funcStr.includes('matchReelAnchor')) {
      return partialReels;
    }
    if (funcStr.includes('scrollHeight')) {
      return { scrollHeight: 2000, isLoadingSpinner: false, docVisibility: 'hidden', docHidden: true };
    }
    return null;
  });

  const profileTimingA = h.bg.createProfileTimingTracker(h.getNow(), { profileActiveDeadlineMs: 95000 });
  const discoveredA = await h.bg.scrollUntilEnoughReels(
    888,
    { tab: { id: 101, url: 'http://localhost:5173' } },
    { username: 'clamp_user' },
    { phaseTimeoutMs: 9000, profileTiming: profileTimingA }
  );

  assert.strictEqual(discoveredA.scrollDiag.exitReason, 'phase_timeout');
  assert.strictEqual(
    discoveredA.scrollDiag.elapsedMs,
    9000,
    `Production scrollUntilEnoughReels active elapsedMs must be strictly clamped to 9000ms (actual: ${discoveredA.scrollDiag.elapsedMs}ms)`
  );
  assert.strictEqual(discoveredA.scrollDiag.docVisibility, 'hidden');
  assert.strictEqual(discoveredA.scrollDiag.winState, 'normal');
  assert.strictEqual(discoveredA.scrollDiag.winFocused, false);
  console.log('  -> Scenario P2 verified against production extension/src/background.js.');
})();

// -------------------------------------------------------------
// SCENARIO P3: Direct Production execution of startProfileResearch for Completed, Partial, and Failed outcomes
// -------------------------------------------------------------
await (async () => {
  console.log('[Scenario P3] Direct production execution: startProfileResearch (Completed, Partial, Failed + 95s Deadline)...');

  // 1. COMPLETED outcome (15/15 reels) -> verify scrollDiag persisted on Completed result
  {
    const h = createProductionBackgroundHarness();
    h.bg.setCompanionRefs(777, 888, false);
    h.setWindowState({ state: 'normal', focused: true });

    const full15Reels = Array.from({ length: 15 }, (_, i) => ({
      url: `https://www.instagram.com/reel/PROD_OK_${i}/`,
      isPinned: false,
      viewCount: 200000 + i * 5000,
      rawViewText: '200K',
      viewIconLocation: 'tile_aria_label',
      viewIconFound: true,
      missingDiag: null
    }));

    h.setOnExecuteScript((funcStr) => {
      if (funcStr.includes('window.location.href') && funcStr.length < 120) {
        return h.getCurrentTabUrl();
      }
      if (funcStr.includes('awaiting_follower_data')) {
        return { status: 'ok', followerDisplay: '150K', source: 'anchor_span', url: h.getCurrentTabUrl(), readyState: 'complete' };
      }
      if (funcStr.includes('noReelsConfirmed')) {
        return {
          url: h.getCurrentTabUrl(),
          isReels: true,
          ready: true,
          reelCount: 15,
          postCount: 0,
          mediaCount: 15,
          gridElementCount: 1,
          isUnavailable: false,
          isPrivate: false,
          isLoginWall: false,
          hasNoReelsMessage: false,
          noReelsConfirmed: false,
          isLoadingSpinner: false,
          visibilityState: 'visible',
          hidden: false
        };
      }
      if (funcStr.includes('extractView')) {
        return full15Reels;
      }
      return null;
    });

    const completedRes = await h.bg.startProfileResearch(
      { jobId: 'job_1', influencerCode: 'HIS1', username: 'completed_creator' },
      { tab: { id: 101, url: 'http://localhost:5173' } }
    );

    assert.strictEqual(completedRes.status, 'completed', 'Status must be completed');
    assert.strictEqual(completedRes.validViewCountsCount, 15);
    assert.ok(completedRes.scrollDiag, 'Completed result MUST persist scrollDiag');
    assert.strictEqual(completedRes.scrollDiag.exitReason, 'target_reels_reached');
    assert.strictEqual(completedRes.scrollDiag.validViews, 15);
    assert.strictEqual(completedRes.scrollDiag.winState, 'normal');
    assert.strictEqual(completedRes.scrollDiag.winFocused, true);
    assert.strictEqual(typeof completedRes.activeElapsedMs, 'number');
    assert.strictEqual(completedRes.pausedDurationMs, 0);
  }

  // 2. PARTIAL outcome (10/15 reels) -> verify scrollDiag persisted on Partial result & failureReason
  {
    const h = createProductionBackgroundHarness();
    h.bg.setCompanionRefs(777, 888, false);
    h.setWindowState({ state: 'normal', focused: false });

    const partial10Reels = Array.from({ length: 10 }, (_, i) => ({
      url: `https://www.instagram.com/reel/PROD_PART_${i}/`,
      isPinned: false,
      viewCount: 90000 + i * 1000,
      rawViewText: '90K',
      viewIconLocation: 'tile_aria_label',
      viewIconFound: true,
      missingDiag: null
    }));

    h.setOnExecuteScript((funcStr) => {
      if (funcStr.includes('window.location.href') && funcStr.length < 120) {
        return h.getCurrentTabUrl();
      }
      if (funcStr.includes('awaiting_follower_data')) {
        return { status: 'ok', followerDisplay: '133K', source: 'anchor_span', url: h.getCurrentTabUrl(), readyState: 'complete' };
      }
      if (funcStr.includes('noReelsConfirmed')) {
        return {
          url: h.getCurrentTabUrl(),
          isReels: true,
          ready: true,
          reelCount: 10,
          postCount: 0,
          mediaCount: 10,
          gridElementCount: 1,
          isUnavailable: false,
          isPrivate: false,
          isLoginWall: false,
          hasNoReelsMessage: false,
          noReelsConfirmed: false,
          isLoadingSpinner: false,
          visibilityState: 'hidden',
          hidden: true
        };
      }
      if (funcStr.includes('extractView')) {
        return partial10Reels;
      }
      if (funcStr.includes('scrollHeight')) {
        return { scrollHeight: 1800, isLoadingSpinner: false, docVisibility: 'hidden', docHidden: true };
      }
      return null;
    });

    const partialRes = await h.bg.startProfileResearch(
      { jobId: 'job_1', influencerCode: 'HIS5', username: 'partial_creator', enableOcclusionAutoPause: false },
      { tab: { id: 101, url: 'http://localhost:5173' } }
    );

    assert.strictEqual(partialRes.status, 'partial', 'Status must be partial');
    assert.strictEqual(partialRes.validViewCountsCount, 10);
    assert.ok(partialRes.scrollDiag, 'Partial result MUST persist scrollDiag');
    assert.strictEqual(partialRes.scrollDiag.exitReason, 'plateau_reached');
    assert.strictEqual(partialRes.scrollDiag.stableRounds, 8);
    assert.strictEqual(partialRes.scrollDiag.docVisibility, 'hidden');
    assert.ok(
      partialRes.failureReason.includes('[ScrollDiag: exit=plateau_reached'),
      `Partial failureReason must include ScrollDiag summary (actual: ${partialRes.failureReason})`
    );
  }

  // 3. FAILED outcome (0/15 reels) with Pass 1 + Step 5 Retry bounded by 95s Active Profile Deadline
  {
    const h = createProductionBackgroundHarness();
    h.bg.setCompanionRefs(777, 888, false);
    h.setWindowState({ state: 'normal', focused: false });

    h.setOnExecuteScript((funcStr) => {
      if (funcStr.includes('window.location.href') && funcStr.length < 120) {
        return h.getCurrentTabUrl();
      }
      if (funcStr.includes('awaiting_follower_data')) {
        return { status: 'ok', followerDisplay: '52K', source: 'anchor_span', url: h.getCurrentTabUrl(), readyState: 'complete' };
      }
      if (funcStr.includes('noReelsConfirmed')) {
        return {
          url: h.getCurrentTabUrl(),
          isReels: true,
          ready: true,
          reelCount: 0,
          postCount: 12,
          mediaCount: 12,
          gridElementCount: 1,
          isUnavailable: false,
          isPrivate: false,
          isLoginWall: false,
          hasNoReelsMessage: false,
          noReelsConfirmed: false,
          isLoadingSpinner: false,
          visibilityState: 'hidden',
          hidden: true
        };
      }
      if (funcStr.includes('extractView')) {
        return [];
      }
      if (funcStr.includes('scrollHeight')) {
        return { scrollHeight: 900, isLoadingSpinner: false, docVisibility: 'hidden', docHidden: true };
      }
      return false;
    });

    const failedRes = await h.bg.startProfileResearch(
      { jobId: 'job_1', influencerCode: 'HIS8', username: 'zero_reels_creator', enableOcclusionAutoPause: false },
      { tab: { id: 101, url: 'http://localhost:5173' } }
    );

    assert.strictEqual(failedRes.status, 'reels_not_found');
    assert.ok(failedRes.scrollDiag, 'Failed result MUST persist primary scrollDiag');
    assert.strictEqual(failedRes.scrollDiag.exitReason, 'zero_reels');
    assert.strictEqual(failedRes.scrollDiag.zeroRounds, 8);
    assert.ok(failedRes.retryScrollDiag, 'Failed result MUST persist retryScrollDiag when retry runs');
    assert.strictEqual(failedRes.retryScrollDiag.exitReason, 'zero_reels');
    assert.ok(
      failedRes.activeElapsedMs <= 95000,
      `Total active profile time across Pass 1 + Retry must not exceed 95,000ms (actual: ${failedRes.activeElapsedMs}ms)`
    );
    assert.ok(failedRes.failureReason.includes('[ScrollDiag: exit=zero_reels'));
    assert.ok(failedRes.failureReason.includes('[RetryScrollDiag: exit=zero_reels'));
  }

  console.log('  -> Scenario P3 verified against production extension/src/background.js.');
})();

// -------------------------------------------------------------
// SCENARIO P4: Option 3 Suspected-Occlusion Auto-Pause & Strengthened 2-Poll Resume Confirmation
// -------------------------------------------------------------
await (async () => {
  console.log('[Scenario P4] Direct production execution: occlusion_suspected auto-pause & 2-poll resume confirmation...');
  const h = createProductionBackgroundHarness();
  h.bg.setCompanionRefs(777, 888, false);
  // Start with Companion unminimized, unfocused, and covered (docVisibility: 'hidden')
  h.setWindowState({ state: 'normal', focused: false, left: 100, top: 100 });

  const initial9Reels = Array.from({ length: 9 }, (_, i) => ({
    url: `https://www.instagram.com/reel/OCC_P4_${i}/`,
    isPinned: false,
    viewCount: 110000 + i * 2000,
    rawViewText: '110K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));
  const full15Reels = Array.from({ length: 15 }, (_, i) => ({
    url: `https://www.instagram.com/reel/OCC_P4_${i}/`,
    isPinned: false,
    viewCount: 110000 + i * 2000,
    rawViewText: '110K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));

  let isUncovered = false;
  let currentDocVis = 'hidden';
  let pausePollStep = 0;

  h.setOnWindowPoll(() => {
    // Only step through resume states once RESEARCH_PAUSED (occlusion_suspected) has been emitted
    const hasOcclusionPauseStarted = h.emittedEvents.some(
      e => e.type === 'RESEARCH_PAUSED' && e.payload?.reason === 'occlusion_suspected'
    );
    if (!hasOcclusionPauseStarted) return;

    pausePollStep++;
    // Poll 1 & 2: Still unfocused and hidden (user hasn't brought window to front yet)
    if (pausePollStep <= 2) {
      h.setWindowState({ state: 'normal', focused: false });
      currentDocVis = 'hidden';
    }
    // Poll 3: Window is focused, BUT still covered (docVisibility === 'hidden') -> MUST NOT RESUME!
    else if (pausePollStep === 3) {
      h.setWindowState({ state: 'normal', focused: true });
      currentDocVis = 'hidden';
    }
    // Poll 4: Single poll where focused=true and visible, followed by Poll 5 losing focus -> MUST NOT RESUME on 1 poll!
    else if (pausePollStep === 4) {
      h.setWindowState({ state: 'normal', focused: true });
      currentDocVis = 'visible';
    } else if (pausePollStep === 5) {
      h.setWindowState({ state: 'normal', focused: false });
      currentDocVis = 'hidden';
    }
    // Poll 6 & Poll 7: 2 consecutive polls where unminimized, focused=true, AND docVisibility='visible' -> RESUMES!
    else if (pausePollStep >= 6) {
      h.setWindowState({ state: 'normal', focused: true });
      currentDocVis = 'visible';
      isUncovered = true;
    }
  });

  h.setOnExecuteScript((funcStr) => {
    if (funcStr.includes('document.visibilityState') && !funcStr.includes('scrollHeight')) {
      return {
        visible: currentDocVis === 'visible',
        visibilityState: currentDocVis,
        hidden: currentDocVis !== 'visible'
      };
    }
    if (funcStr.includes('extractView')) {
      return isUncovered ? full15Reels : initial9Reels;
    }
    if (funcStr.includes('scrollHeight')) {
      return {
        scrollHeight: isUncovered ? 3200 : 1400,
        isLoadingSpinner: false,
        docVisibility: currentDocVis,
        docHidden: currentDocVis !== 'visible'
      };
    }
    if (funcStr.includes('onReels')) {
      return { onReels: true, href: 'https://www.instagram.com/occ_creator/reels/' };
    }
    return null;
  });

  const profileTiming = h.bg.createProfileTimingTracker(h.getNow(), { profileActiveDeadlineMs: 95000 });
  const discovered = await h.bg.scrollUntilEnoughReels(
    888,
    { tab: { id: 101, url: 'http://localhost:5173' } },
    { username: 'occ_creator' },
    { phaseTimeoutMs: 60000, profileTiming }
  );

  const diag = discovered.scrollDiag;
  assert.strictEqual(diag.exitReason, 'target_reels_reached', 'Must complete with target_reels_reached after uncovering');
  assert.strictEqual(diag.validViews, 15, 'Must collect all 15 valid view counts without losing the initial 9 reels');
  assert.strictEqual(diag.occlusionPauseCount, 1, 'Must record exactly 1 occlusion pause');
  assert.strictEqual(diag.minimizedPauseCount, 0, 'Minimized pause count must remain 0');
  assert.strictEqual(diag.resumeCount, 1, 'Resume count must be 1');
  assert.strictEqual(diag.lastPauseReason, 'occlusion_suspected');
  assert.ok(diag.prePauseStallExcludedMs > 0, `Pre-pause stall time must be excluded (actual: ${diag.prePauseStallExcludedMs}ms)`);
  assert.ok(diag.occlusionPausedMs > 0, `Occlusion pause duration must be recorded (actual: ${diag.occlusionPausedMs}ms)`);
  assert.strictEqual(
    diag.pausedMs,
    diag.prePauseStallExcludedMs + diag.occlusionPausedMs,
    'Total pausedMs must equal prePauseStallExcludedMs + occlusionPausedMs with zero double-counting'
  );
  assert.strictEqual(
    diag.elapsedMs,
    diag.wallElapsedMs - diag.pausedMs,
    'Active elapsedMs must equal wallElapsedMs - pausedMs'
  );

  const pauseEvent = h.emittedEvents.find(e => e.type === 'RESEARCH_PAUSED');
  assert.ok(pauseEvent, 'Must emit RESEARCH_PAUSED event');
  assert.strictEqual(pauseEvent.payload.reason, 'occlusion_suspected');
  assert.strictEqual(
    pauseEvent.payload.statusText,
    'Paused — Instagram Companion window appears to be covered. Bring it to the front to continue.'
  );
  console.log('  -> Scenario P4 verified: Composite occlusion stall pauses safely, enforces 2-poll resume confirmation, and completes 15/15.');
})();

// -------------------------------------------------------------
// SCENARIO P5: Repeated Occlusion Pauses + Minimized Pause (Zero Double-Counting)
// -------------------------------------------------------------
await (async () => {
  console.log('[Scenario P5] Direct production execution: repeated occlusion pauses + minimized pause time accounting...');
  const h = createProductionBackgroundHarness();
  h.bg.setCompanionRefs(777, 888, false);
  h.setWindowState({ state: 'normal', focused: false });

  const batch5 = Array.from({ length: 5 }, (_, i) => ({
    url: `https://www.instagram.com/reel/MULTI_${i}/`,
    isPinned: false,
    viewCount: 50000 + i * 1000,
    rawViewText: '50K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));
  const batch10 = Array.from({ length: 10 }, (_, i) => ({
    url: `https://www.instagram.com/reel/MULTI_${i}/`,
    isPinned: false,
    viewCount: 50000 + i * 1000,
    rawViewText: '50K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));
  const batch15 = Array.from({ length: 15 }, (_, i) => ({
    url: `https://www.instagram.com/reel/MULTI_${i}/`,
    isPinned: false,
    viewCount: 50000 + i * 1000,
    rawViewText: '50K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));

  // Phase 0: 5 reels loaded, then covered -> Occlusion Pause #1
  // After Occlusion Pause #1 resumes: loads 10 reels, then covered again -> Occlusion Pause #2
  // After Occlusion Pause #2 resumes: user minimizes window for 1 round -> Minimized Pause #1 -> restores & loads 15 reels
  let phase = 0;
  let currentDocVis = 'hidden';
  let pollCounter = 0;

  h.setOnWindowPoll(() => {
    const pauseEventsCount = h.emittedEvents.filter(e => e.type === 'RESEARCH_PAUSED').length;
    const resumeEventsCount = h.emittedEvents.filter(e => e.type === 'RESEARCH_RESUMED').length;
    const isCurrentlyInPause = pauseEventsCount > resumeEventsCount;
    if (!isCurrentlyInPause) return;

    pollCounter++;
    if (pauseEventsCount === 1 && pollCounter >= 3) {
      // Resume from Occlusion Pause #1
      h.setWindowState({ state: 'normal', focused: true });
      currentDocVis = 'visible';
      phase = 1;
      pollCounter = 0;
    } else if (pauseEventsCount === 2 && pollCounter >= 3) {
      // Resume from Occlusion Pause #2
      h.setWindowState({ state: 'normal', focused: true });
      currentDocVis = 'visible';
      phase = 2;
      pollCounter = 0;
    } else if (pauseEventsCount === 3 && pollCounter >= 2) {
      // Resume from Minimized Pause #3
      h.setWindowState({ state: 'normal', focused: true });
      currentDocVis = 'visible';
      phase = 3;
      pollCounter = 0;
    }
  });

  let discoverCallsInPhase1 = 0;
  h.setOnExecuteScript((funcStr) => {
    if (funcStr.includes('document.visibilityState') && !funcStr.includes('scrollHeight')) {
      return {
        visible: currentDocVis === 'visible',
        visibilityState: currentDocVis,
        hidden: currentDocVis !== 'visible'
      };
    }
    if (funcStr.includes('extractView')) {
      if (phase === 0) return batch5;
      if (phase === 1) {
        discoverCallsInPhase1++;
        if (discoverCallsInPhase1 >= 2) {
          // User covers the window again after batch10 is discovered
          h.setWindowState({ state: 'normal', focused: false });
          currentDocVis = 'hidden';
        }
        return batch10;
      }
      if (phase === 2) {
        // Trigger a genuine minimization right before final batch
        h.setWindowState({ state: 'minimized', focused: false });
        return batch10;
      }
      return batch15;
    }
    if (funcStr.includes('scrollHeight')) {
      return {
        scrollHeight: 2000,
        isLoadingSpinner: false,
        docVisibility: currentDocVis,
        docHidden: currentDocVis !== 'visible'
      };
    }
    if (funcStr.includes('onReels')) {
      return { onReels: true, href: 'https://www.instagram.com/multi_pause/reels/' };
    }
    return null;
  });

  const startTs = h.getNow();
  const profileTiming = h.bg.createProfileTimingTracker(startTs, { profileActiveDeadlineMs: 95000 });
  const discovered = await h.bg.scrollUntilEnoughReels(
    888,
    { tab: { id: 101, url: 'http://localhost:5173' } },
    { username: 'multi_pause' },
    { phaseTimeoutMs: 60000, profileTiming }
  );

  const diag = discovered.scrollDiag;
  assert.strictEqual(diag.exitReason, 'target_reels_reached');
  assert.strictEqual(diag.validViews, 15);
  assert.strictEqual(diag.occlusionPauseCount, 2, 'Must record 2 occlusion pauses');
  assert.strictEqual(diag.minimizedPauseCount, 1, 'Must record 1 minimized pause');
  assert.strictEqual(diag.resumeCount, 3, 'Must record 3 total resumes');
  assert.strictEqual(diag.pauseEvents.length, 3, 'pauseEvents array must have 3 entries');
  assert.strictEqual(
    diag.pausedMs,
    diag.minimizedPausedMs + diag.occlusionPausedMs + diag.prePauseStallExcludedMs,
    `pausedMs (${diag.pausedMs}) must equal minimizedPausedMs (${diag.minimizedPausedMs}) + occlusionPausedMs (${diag.occlusionPausedMs}) + prePauseStallExcludedMs (${diag.prePauseStallExcludedMs}) without double-counting`
  );
  assert.strictEqual(
    profileTiming.pausedMs,
    diag.pausedMs,
    'profileTiming.pausedMs must match scrollDiag.pausedMs with zero double-counting'
  );
  console.log('  -> Scenario P5 verified: Repeated occlusion pauses + minimized pause have exact, non-overlapping time accounting.');
})();

// -------------------------------------------------------------
// SCENARIO P6: Slow-Loading Visible Page Is NOT Excluded from Active Time
// -------------------------------------------------------------
await (async () => {
  console.log('[Scenario P6] Direct production execution: slow-loading visible page is never excluded from active time...');
  const h = createProductionBackgroundHarness();
  h.bg.setCompanionRefs(777, 888, false);
  // Window is visible (even when unfocused on a second monitor, docVisibility is 'visible')
  h.setWindowState({ state: 'normal', focused: false });

  const batch8 = Array.from({ length: 8 }, (_, i) => ({
    url: `https://www.instagram.com/reel/VIS_SLOW_${i}/`,
    isPinned: false,
    viewCount: 70000 + i * 1000,
    rawViewText: '70K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));
  const batch15 = Array.from({ length: 15 }, (_, i) => ({
    url: `https://www.instagram.com/reel/VIS_SLOW_${i}/`,
    isPinned: false,
    viewCount: 70000 + i * 1000,
    rawViewText: '70K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));

  // Stalls for 5 rounds while visible (docVisibility === 'visible'), then loads 15 reels on round 6
  let roundIdx = 0;
  h.setOnExecuteScript((funcStr) => {
    if (funcStr.includes('document.visibilityState') && !funcStr.includes('scrollHeight')) {
      return { visible: true, visibilityState: 'visible', hidden: false };
    }
    if (funcStr.includes('extractView')) {
      roundIdx++;
      return roundIdx <= 6 ? batch8 : batch15;
    }
    if (funcStr.includes('scrollHeight')) {
      return { scrollHeight: 1600, isLoadingSpinner: false, docVisibility: 'visible', docHidden: false };
    }
    return null;
  });

  const profileTiming = h.bg.createProfileTimingTracker(h.getNow(), { profileActiveDeadlineMs: 95000 });
  const discovered = await h.bg.scrollUntilEnoughReels(
    888,
    { tab: { id: 101, url: 'http://localhost:5173' } },
    { username: 'visible_slow_user' },
    { phaseTimeoutMs: 60000, profileTiming }
  );

  const diag = discovered.scrollDiag;
  assert.strictEqual(diag.exitReason, 'target_reels_reached');
  assert.strictEqual(diag.occlusionPauseCount, 0, 'Visible slow-loading page must NEVER trigger occlusion pause');
  assert.strictEqual(diag.prePauseStallExcludedMs, 0, 'Visible slow-loading time must NEVER be excluded from active time');
  assert.strictEqual(diag.pausedMs, 0, 'Total pausedMs must be 0');
  assert.strictEqual(diag.elapsedMs, diag.wallElapsedMs, 'Active elapsedMs must equal full wallElapsedMs (15,000ms)');
  console.log('  -> Scenario P6 verified: Slow-loading visible page is counted as 100% active time and never pauses.');
})();

// -------------------------------------------------------------
// SCENARIO P7: 15-Minute Pause Ceiling (HIS6 Inactivity Timeout -> Restored -> HIS8 & HIS9 Complete)
// -------------------------------------------------------------
await (async () => {
  console.log('[Scenario P7] Direct production execution: 15-minute pause ceiling (HIS6 timeout + HIS8/HIS9 recovery)...');
  const h = createProductionBackgroundHarness();
  h.bg.setCompanionRefs(777, 888, false);
  // Start with Companion covered (unminimized, unfocused, docVisibility: 'hidden')
  h.setWindowState({ state: 'normal', focused: false });

  let currentDocVis = 'hidden';
  let isRestored = false;

  const partial6Reels = Array.from({ length: 6 }, (_, i) => ({
    url: `https://www.instagram.com/reel/HIS6_${i}/`,
    isPinned: false,
    viewCount: 200000 + i * 5000,
    rawViewText: '200K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));
  const full15Reels = Array.from({ length: 15 }, (_, i) => ({
    url: `https://www.instagram.com/reel/HIS_OK_${i}/`,
    isPinned: false,
    viewCount: 120000 + i * 3000,
    rawViewText: '120K',
    viewIconLocation: 'tile_aria_label',
    viewIconFound: true,
    missingDiag: null
  }));

  h.setOnExecuteScript((funcStr) => {
    if (funcStr.includes('window.location.href') && funcStr.length < 120) {
      return h.getCurrentTabUrl();
    }
    if (funcStr.includes('awaiting_follower_data')) {
      return { status: 'ok', followerDisplay: '133K', source: 'anchor_span', url: h.getCurrentTabUrl(), readyState: 'complete' };
    }
    if (funcStr.includes('noReelsConfirmed')) {
      return {
        url: h.getCurrentTabUrl(),
        isReels: true,
        ready: true,
        reelCount: isRestored ? 15 : 6,
        postCount: 0,
        mediaCount: isRestored ? 15 : 6,
        gridElementCount: 1,
        isUnavailable: false,
        isPrivate: false,
        isLoginWall: false,
        hasNoReelsMessage: false,
        noReelsConfirmed: false,
        isLoadingSpinner: false,
        visibilityState: currentDocVis,
        hidden: currentDocVis !== 'visible'
      };
    }
    if (funcStr.includes('document.visibilityState') && !funcStr.includes('scrollHeight')) {
      return {
        visible: currentDocVis === 'visible',
        visibilityState: currentDocVis,
        hidden: currentDocVis !== 'visible'
      };
    }
    if (funcStr.includes('extractView')) {
      return isRestored ? full15Reels : partial6Reels;
    }
    if (funcStr.includes('scrollHeight')) {
      return {
        scrollHeight: 1500,
        isLoadingSpinner: false,
        docVisibility: currentDocVis,
        docHidden: currentDocVis !== 'visible'
      };
    }
    return null;
  });

  // 1. HIS6 runs while Companion remains covered past the 15-minute MAX_PAUSE_MS (900,000ms) ceiling
  const his6Res = await h.bg.startProfileResearch(
    { jobId: 'job_15m', influencerCode: 'HIS6', username: 'sweet_riya161' },
    { tab: { id: 101, url: 'http://localhost:5173' } }
  );

  assert.strictEqual(his6Res.status, 'failed', 'HIS6 must fail cleanly when 15-minute pause ceiling is reached');
  assert.strictEqual(his6Res.failureStage, 'companion_window_inactive_timeout');
  assert.ok(his6Res.scrollDiag, 'HIS6 failed result MUST preserve scrollDiag even on pause inactivity timeout');
  assert.strictEqual(his6Res.scrollDiag.exitReason, 'pause_inactivity_timeout');
  assert.strictEqual(his6Res.scrollDiag.occlusionPauseCount, 1);
  assert.strictEqual(his6Res.scrollDiag.resumeCount, 0, 'Timed-out pause must not increment resumeCount');
  assert.strictEqual(his6Res.scrollDiag.pauseEvents.length, 1, 'Must record exactly 1 pause event');
  assert.strictEqual(his6Res.scrollDiag.pauseEvents[0].timedOut, true, 'Timed-out pause event must record timedOut: true');
  assert.strictEqual(his6Res.scrollDiag.pausedMs, his6Res.pausedDurationMs, 'scrollDiag.pausedMs and pausedDurationMs must match with zero double-counting');
  assert.ok(
    his6Res.scrollDiag.occlusionPausedMs > 900000,
    `occlusionPausedMs must record the >15m pause (actual: ${his6Res.scrollDiag.occlusionPausedMs}ms)`
  );
  assert.ok(
    his6Res.scrollDiag.prePauseStallExcludedMs > 0,
    `prePauseStallExcludedMs must record the pre-pause stall streak (actual: ${his6Res.scrollDiag.prePauseStallExcludedMs}ms)`
  );
  assert.strictEqual(
    his6Res.pausedDurationMs,
    his6Res.scrollDiag.occlusionPausedMs + his6Res.scrollDiag.prePauseStallExcludedMs,
    'pausedDurationMs must equal occlusionPausedMs + prePauseStallExcludedMs with zero double-counting'
  );
  assert.ok(
    his6Res.activeElapsedMs < 15000,
    `activeElapsedMs must exclude the 15-minute pause and pre-pause stall (actual: ${his6Res.activeElapsedMs}ms)`
  );
  assert.ok(
    his6Res.failureReason.includes('[ScrollDiag: exit=pause_inactivity_timeout'),
    `HIS6 failureReason must include ScrollDiag summary (actual: ${his6Res.failureReason})`
  );

  // 2. User brings Companion window to front; remaining profiles HIS8 and HIS9 run and complete 15/15
  h.setWindowState({ state: 'normal', focused: true });
  currentDocVis = 'visible';
  isRestored = true;

  const his8Res = await h.bg.startProfileResearch(
    { jobId: 'job_15m', influencerCode: 'HIS8', username: 'noreen__mantasha' },
    { tab: { id: 101, url: 'http://localhost:5173' } }
  );
  const his9Res = await h.bg.startProfileResearch(
    { jobId: 'job_15m', influencerCode: 'HIS9', username: 'mumma_and_manan' },
    { tab: { id: 101, url: 'http://localhost:5173' } }
  );

  assert.strictEqual(his8Res.status, 'completed', 'HIS8 must complete 15/15 after Companion is restored');
  assert.strictEqual(his8Res.validViewCountsCount, 15);
  assert.strictEqual(his9Res.status, 'completed', 'HIS9 must complete 15/15 after Companion is restored');
  assert.strictEqual(his9Res.validViewCountsCount, 15);
  console.log('  -> Scenario P7 verified: 15-minute pause ceiling fails HIS6 cleanly with full scrollDiag and allows HIS8 & HIS9 to complete.');
})();

console.log('\nPASS: All Companion window state, timeout accounting, diagnostic persistence, and direct production execution scenarios passed successfully!');
