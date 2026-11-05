// background.js

const EXTENSION_VERSION = "1.0.0";
const ENABLE_OCCLUSION_AUTO_PAUSE = true;
const OCCLUSION_STALL_ROUNDS_HIDDEN = 4;
const OCCLUSION_STALL_ROUNDS_FALLBACK = 6;
const OCCLUSION_RESUME_CONFIRM_POLLS = 2;

function isOcclusionAutoPauseEnabled(payload = null) {
  if (!ENABLE_OCCLUSION_AUTO_PAUSE) return false;
  if (payload && payload.enableOcclusionAutoPause === false) return false;
  return true;
}
let lastUsedIgTabId = null;
let researchQueue = Promise.resolve();

// Companion window architecture state
let companionWindowId = null;
let companionTabId = null;
let companionWindowCreatedByUs = false;
let companionIdleCloseTimer = null;

// Authoritative batch lifecycle state
let isResearchActive = false;
let activeBatchJobId = null;
let companionWindowClosedByUser = false;
let batchSettledTimer = null;
let idleTimerGeneration = 0;

function logBoundedDiag(event, username, data = {}) {
  const cleanData = { ...data };
  delete cleanData.cookie;
  delete cleanData.token;
  delete cleanData.auth;
  delete cleanData.password;
  delete cleanData.session;
  console.log(`[CompanionDiag][${event}] user=@${username || 'none'}`, JSON.stringify(cleanData));
}

function beginOrContinueBatch(jobId) {
  // Clear any existing idle-close timer immediately so it cannot close the window
  if (companionIdleCloseTimer) {
    clearTimeout(companionIdleCloseTimer);
    companionIdleCloseTimer = null;
  }
  if (batchSettledTimer) {
    clearTimeout(batchSettledTimer);
    batchSettledTimer = null;
  }

  const effectiveJobId = jobId || activeBatchJobId || `job_${Date.now()}`;
  const isNewBatch = !isResearchActive || (activeBatchJobId && activeBatchJobId !== effectiveJobId);

  if (isNewBatch) {
    idleTimerGeneration++;
    isResearchActive = true;
    activeBatchJobId = effectiveJobId;
    companionWindowClosedByUser = false; // Reset signal only on new batch initialization
    logBoundedDiag('batch_started', null, { jobId: activeBatchJobId, generation: idleTimerGeneration });
  } else {
    isResearchActive = true;
    activeBatchJobId = effectiveJobId;
  }
}

function scheduleBatchCompletionCheck(delayMs = 6000) {
  if (batchSettledTimer) {
    clearTimeout(batchSettledTimer);
  }
  const currentGen = idleTimerGeneration;
  batchSettledTimer = setTimeout(() => {
    // If no subsequent profile arrived within the debounce window, mark batch completed
    if (currentGen === idleTimerGeneration && isResearchActive) {
      markBatchCompleted('batch_settled');
    }
  }, delayMs);
}

function markBatchCompleted(reason = 'batch_settled') {
  if (batchSettledTimer) {
    clearTimeout(batchSettledTimer);
    batchSettledTimer = null;
  }
  logBoundedDiag('batch_completed', null, { jobId: activeBatchJobId, reason });
  isResearchActive = false;
  activeBatchJobId = null;
  companionWindowClosedByUser = false;

  // Arm the idle timer ONLY after the batch has fully completed and research is genuinely idle
  scheduleCompanionIdleClose(45000);
}

function logTabOp(stage, username, tabId, url, extra = '') {
  const userTag = username ? `@${username}` : 'n/a';
  const extraStr = extra ? ` | ${extra}` : '';
  console.log(`[TabLifecycle][${stage}] user=${userTag} tabId=${tabId ?? 'none'} url=${url || 'n/a'}${extraStr}`);
}

function isTabInvalidError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('No tab with id') ||
    msg.includes('Frame with ID') ||
    msg.includes('tab was closed or disconnected') ||
    msg.includes('TAB_CLOSED_OR_INVALID') ||
    msg.includes('Cannot access a chrome://') ||
    msg.includes('Tabs cannot be edited right now')
  );
}

async function getValidCompanionWindow(winId) {
  if (!winId) return null;
  return new Promise((resolve) => {
    chrome.windows.get(winId, { populate: true }, (win) => {
      if (chrome.runtime.lastError || !win) {
        resolve(null);
      } else {
        resolve(win);
      }
    });
  });
}

async function checkTabVisibility(tabId) {
  if (!tabId) return { visible: true, visibilityState: 'visible' };
  try {
    const res = await new Promise((resolve) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({
          visibilityState: document.visibilityState,
          hidden: document.hidden
        })
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          resolve(null);
        } else {
          resolve(results[0].result);
        }
      });
    });
    if (!res) return { visible: true, visibilityState: 'unknown' };
    return {
      visible: res.visibilityState === 'visible' && !res.hidden,
      visibilityState: res.visibilityState
    };
  } catch (e) {
    return { visible: true, visibilityState: 'unknown' };
  }
}

async function checkCompanionWindowState() {
  if (!companionWindowId) return { valid: false, state: 'unknown', focused: false };
  return new Promise((resolve) => {
    chrome.windows.get(companionWindowId, (win) => {
      if (chrome.runtime.lastError || !win) {
        resolve({ valid: false, state: 'closed', focused: false });
      } else {
        resolve({
          valid: true,
          state: win.state,
          focused: win.focused,
          left: win.left,
          top: win.top,
          width: win.width,
          height: win.height
        });
      }
    });
  });
}

function isCompanionWindowMinimized(winStatus) {
  if (!winStatus || !winStatus.valid || winStatus.state === 'closed') return false;
  if (winStatus.state === 'minimized') return true;
  // Windows OS Win32 minimization coordinates fallback (e.g. left: -32000, top: -32000)
  if (typeof winStatus.left === 'number' && winStatus.left <= -10000 && typeof winStatus.top === 'number' && winStatus.top <= -10000) {
    return true;
  }
  return false;
}

async function closeCompanionWindow(reason = 'batch_complete') {
  if (companionIdleCloseTimer) {
    clearTimeout(companionIdleCloseTimer);
    companionIdleCloseTimer = null;
  }
  if (batchSettledTimer) {
    clearTimeout(batchSettledTimer);
    batchSettledTimer = null;
  }

  // If reason is 'idle_timeout', independently verify that research is inactive before closing
  if (reason === 'idle_timeout' && isResearchActive) {
    logBoundedDiag('idle_timeout_aborted_active_research', null, { jobId: activeBatchJobId });
    return;
  }

  if (companionWindowId && companionWindowCreatedByUs) {
    const winToClose = companionWindowId;
    companionWindowId = null;
    companionTabId = null;
    companionWindowCreatedByUs = false;
    lastUsedIgTabId = null;
    try {
      logBoundedDiag('companion_window_closing', null, { winId: winToClose, reason });
      await chrome.windows.remove(winToClose);
    } catch (e) {
      // Window may already be closed
    }
  }
}

function scheduleCompanionIdleClose(delayMs = 45000) {
  if (companionIdleCloseTimer) {
    clearTimeout(companionIdleCloseTimer);
    companionIdleCloseTimer = null;
  }
  // Never arm idle timer while a batch is active (including between profiles or while paused)
  if (isResearchActive) {
    logBoundedDiag('idle_timer_skipped_active_batch', null, { jobId: activeBatchJobId });
    return;
  }
  const timerGen = idleTimerGeneration;
  companionIdleCloseTimer = setTimeout(() => {
    // Independently verify that research is inactive and generation hasn't changed before closing
    if (!isResearchActive && timerGen === idleTimerGeneration) {
      closeCompanionWindow('idle_timeout').catch(() => {});
    }
  }, delayMs);
}

function recordPauseInTracker(timingTracker, totalExcludedMs, pauseMeta) {
  if (!timingTracker || typeof timingTracker !== 'object') return;
  if (typeof timingTracker.onPauseElapsed === 'function') {
    timingTracker.onPauseElapsed(totalExcludedMs, pauseMeta);
    return;
  }
  const isOcclusion = pauseMeta && pauseMeta.reason === 'occlusion_suspected';
  const didResume = !pauseMeta || !pauseMeta.timedOut;
  timingTracker.pausedMs = (timingTracker.pausedMs || 0) + totalExcludedMs;
  if (isOcclusion) {
    timingTracker.occlusionPausedMs = (timingTracker.occlusionPausedMs || 0) + (pauseMeta.durationMs || 0);
    timingTracker.prePauseStallExcludedMs = (timingTracker.prePauseStallExcludedMs || 0) + (pauseMeta.prePauseStallMs || 0);
    timingTracker.occlusionPauseCount = (timingTracker.occlusionPauseCount || 0) + 1;
    timingTracker.lastPauseReason = 'occlusion_suspected';
  } else {
    timingTracker.minimizedPausedMs = (timingTracker.minimizedPausedMs || 0) + totalExcludedMs;
    timingTracker.minimizedPauseCount = (timingTracker.minimizedPauseCount || 0) + 1;
    timingTracker.lastPauseReason = 'companion_window_minimized';
  }
  if (didResume) {
    timingTracker.resumeCount = (timingTracker.resumeCount || 0) + 1;
  }
  if (Array.isArray(timingTracker.pauseEvents) && pauseMeta) {
    timingTracker.pauseEvents.push(pauseMeta);
  }
}

async function handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, stage, igTabId = null, timingTracker = null) {
  // If companion window was closed during this batch, persistently throw COMPANION_WINDOW_CLOSED
  if (companionWindowClosedByUser) {
    throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed. Please keep the companion window open during batch research.');
  }
  if (!companionWindowId) return false;
  const winStatus = await checkCompanionWindowState();
  if (!winStatus.valid || winStatus.state === 'closed') {
    companionWindowClosedByUser = true;
    throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed. Please keep the companion window open during batch research.');
  }

  const effectiveTabId = igTabId || companionTabId;

  // Only genuinely minimized Companion Chrome window triggers an automatic pause.
  // Window blur, loss of focus, or being covered/occluded behind Velmora or another app must NOT pause!
  const isMinimized = isCompanionWindowMinimized(winStatus);

  if (isMinimized) {
    const pauseStartTs = Date.now();
    let tabVis = { visible: false, visibilityState: 'minimized' };
    if (effectiveTabId) {
      try {
        tabVis = await checkTabVisibility(effectiveTabId);
      } catch (e) {}
    }

    logBoundedDiag('pause_start', normalizedUser, {
      stage,
      winId: companionWindowId,
      winState: winStatus.state,
      docVisibility: tabVis.visibilityState,
      timestamp: pauseStartTs
    });
    if (sender) {
      sendEventToSender(sender, 'RESEARCH_PAUSED', {
        ...payload,
        reason: 'companion_window_inactive',
        statusText: 'Paused — Instagram window inactive',
        checkpoint: stage,
        isPaused: true
      });
    }

    // Configurable inactivity timeout: default 15 minutes (900,000ms), customizable via payload
    const MAX_PAUSE_MS = typeof payload?.inactivityTimeoutMs === 'number' && payload.inactivityTimeoutMs > 0
      ? payload.inactivityTimeoutMs
      : 15 * 60 * 1000;

    let lastHeartbeatTs = Date.now();

    while (true) {
      await new Promise(r => setTimeout(r, 600));
      if (companionWindowClosedByUser) {
        throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed while paused.');
      }
      const currentWin = await checkCompanionWindowState();
      if (!currentWin.valid || currentWin.state === 'closed') {
        companionWindowClosedByUser = true;
        throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed while paused.');
      }

      // Resume as soon as the Companion window is no longer minimized.
      // Do not block resume on tab visibility, so if restored behind another window it resumes immediately.
      const stillMinimized = isCompanionWindowMinimized(currentWin);

      if (!stillMinimized) {
        let currentTabVis = { visible: true, visibilityState: 'unknown' };
        if (effectiveTabId) {
          try {
            currentTabVis = await checkTabVisibility(effectiveTabId);
          } catch (e) {}
        }

        const pausedDuration = Date.now() - pauseStartTs;
        logBoundedDiag('pause_resumed', normalizedUser, {
          stage,
          winId: companionWindowId,
          winState: currentWin.state,
          docVisibility: currentTabVis.visibilityState,
          pausedDurationMs: pausedDuration
        });
        if (sender) {
          sendEventToSender(sender, 'RESEARCH_RESUMED', {
            ...payload,
            pausedDurationMs: pausedDuration,
            checkpoint: stage,
            isPaused: false
          });
        }
        // Stabilization wait: 1500ms for Blink compositor and React virtual DOM
        await new Promise(r => setTimeout(r, 1500));

        // Active wake-up: trigger IntersectionObserver and virtual scroller
        if (effectiveTabId) {
          try {
            await injectScript(effectiveTabId, () => {
              try {
                window.scrollBy(0, -100);
                window.scrollBy(0, 150);
                window.dispatchEvent(new Event('scroll', { bubbles: true }));
                window.dispatchEvent(new Event('resize', { bubbles: true }));
                window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true }));
              } catch (e) {}
            });
            await new Promise(r => setTimeout(r, 500));
          } catch (e) {}
        }
        const resumeEndTs = Date.now();
        const totalPausedAndWakeupMs = resumeEndTs - pauseStartTs;
        const pauseMeta = {
          reason: 'companion_window_minimized',
          stage,
          startedAt: pauseStartTs,
          endedAt: resumeEndTs,
          durationMs: totalPausedAndWakeupMs,
          prePauseStallMs: 0,
          winStateAtStart: winStatus.state || 'minimized',
          docVisAtStart: tabVis.visibilityState || 'minimized',
          winStateAtResume: currentWin.state || 'normal',
          docVisAtResume: currentTabVis.visibilityState || 'unknown'
        };
        recordPauseInTracker(timingTracker, totalPausedAndWakeupMs, pauseMeta);
        return true;
      }

      // Heartbeat event every 5 seconds so client UI and Mini Player stay informed of paused duration
      if (Date.now() - lastHeartbeatTs >= 5000) {
        lastHeartbeatTs = Date.now();
        if (sender) {
          sendEventToSender(sender, 'RESEARCH_PAUSED', {
            ...payload,
            reason: 'companion_window_inactive',
            statusText: 'Paused — Instagram window inactive',
            checkpoint: stage,
            isPaused: true,
            pausedDurationMs: Date.now() - pauseStartTs
          });
        }
      }

      if (Date.now() - pauseStartTs > MAX_PAUSE_MS) {
        const timeoutEndTs = Date.now();
        const timedOutPauseMs = Math.max(0, timeoutEndTs - pauseStartTs);
        recordPauseInTracker(timingTracker, timedOutPauseMs, {
          reason: 'companion_window_minimized',
          stage,
          startedAt: pauseStartTs,
          endedAt: timeoutEndTs,
          durationMs: timedOutPauseMs,
          prePauseStallMs: 0,
          totalExcludedMs: timedOutPauseMs,
          winStateAtStart: winStatus.state || 'minimized',
          docVisAtStart: tabVis.visibilityState || 'minimized',
          winStateAtResume: currentWin.state || 'minimized',
          docVisAtResume: 'hidden',
          timedOut: true
        });
        logBoundedDiag('pause_timeout_exceeded', normalizedUser, { winId: companionWindowId, pauseDurationMs: timedOutPauseMs });
        throw new Error(`COMPANION_WINDOW_INACTIVITY_TIMEOUT: Instagram research companion window remained inactive for over ${Math.round(MAX_PAUSE_MS / 60000)} minutes.`);
      }
    }
  }
  return false;
}

async function handleCompanionOcclusionPauseIfNeeded(
  normalizedUser,
  sender,
  payload,
  stage,
  igTabId = null,
  timingTracker = null,
  prePauseStallMs = 0
) {
  if (!isOcclusionAutoPauseEnabled(payload)) return false;
  if (companionWindowClosedByUser) {
    throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed. Please keep the companion window open during batch research.');
  }
  if (!companionWindowId) return false;

  const winStatus = await checkCompanionWindowState();
  if (!winStatus.valid || winStatus.state === 'closed') {
    companionWindowClosedByUser = true;
    throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed. Please keep the companion window open during batch research.');
  }

  // If the window actually became minimized, delegate to the minimized-window pause handler
  if (isCompanionWindowMinimized(winStatus)) {
    return await handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, stage, igTabId, timingTracker);
  }

  const effectiveTabId = igTabId || companionTabId;
  let initialTabVis = { visible: false, visibilityState: 'hidden' };
  if (effectiveTabId) {
    try {
      initialTabVis = await checkTabVisibility(effectiveTabId);
    } catch (e) {}
  }

  // Verify composite occlusion condition before entering pause:
  // Window must be normal (unminimized), unfocused, and not actively visible+focused
  if (winStatus.focused && initialTabVis.visibilityState === 'visible') {
    return false;
  }

  const pauseStartTs = Date.now();
  const clampedPrePauseStallMs = Math.max(0, Number(prePauseStallMs) || 0);
  const occlusionStatusText =
    'Paused — Instagram Companion window appears to be covered. Bring it to the front to continue.';

  logBoundedDiag('occlusion_pause_start', normalizedUser, {
    stage,
    winId: companionWindowId,
    winState: winStatus.state,
    winFocused: !!winStatus.focused,
    docVisibility: initialTabVis.visibilityState,
    prePauseStallMs: clampedPrePauseStallMs,
    timestamp: pauseStartTs
  });

  if (sender) {
    sendEventToSender(sender, 'RESEARCH_PAUSED', {
      ...payload,
      reason: 'occlusion_suspected',
      statusText: occlusionStatusText,
      checkpoint: stage,
      isPaused: true
    });
  }

  const MAX_PAUSE_MS =
    typeof payload?.inactivityTimeoutMs === 'number' && payload.inactivityTimeoutMs > 0
      ? payload.inactivityTimeoutMs
      : 15 * 60 * 1000;

  let lastHeartbeatTs = Date.now();
  let consecutiveReadyPolls = 0;

  while (true) {
    const pollDelayMs = consecutiveReadyPolls > 0 ? 300 : 600;
    await new Promise(r => setTimeout(r, pollDelayMs));

    if (companionWindowClosedByUser) {
      throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed while paused.');
    }
    const currentWin = await checkCompanionWindowState();
    if (!currentWin.valid || currentWin.state === 'closed') {
      companionWindowClosedByUser = true;
      throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed while paused.');
    }

    const stillMinimized = isCompanionWindowMinimized(currentWin);
    let currentTabVis = { visible: false, visibilityState: 'unknown' };
    if (!stillMinimized && effectiveTabId) {
      try {
        currentTabVis = await checkTabVisibility(effectiveTabId);
      } catch (e) {}
    }

    // Strengthened resume confirmation:
    // Require Companion window to be unminimized, focused, AND docVisibility === 'visible'
    // (if visibilityState is available) for OCCLUSION_RESUME_CONFIRM_POLLS (2) consecutive checks.
    const isDocVisible =
      currentTabVis.visibilityState === 'visible' ||
      (currentTabVis.visibilityState === 'unknown' && currentWin.focused);
    const isUncoveredAndFocused = !stillMinimized && !!currentWin.focused && isDocVisible;

    if (isUncoveredAndFocused) {
      consecutiveReadyPolls++;
    } else {
      consecutiveReadyPolls = 0;
    }

    if (consecutiveReadyPolls >= OCCLUSION_RESUME_CONFIRM_POLLS) {
      const pausedDuration = Date.now() - pauseStartTs;
      logBoundedDiag('occlusion_pause_resumed', normalizedUser, {
        stage,
        winId: companionWindowId,
        winState: currentWin.state,
        winFocused: !!currentWin.focused,
        docVisibility: currentTabVis.visibilityState,
        pausedDurationMs: pausedDuration,
        prePauseStallMs: clampedPrePauseStallMs,
        confirmPolls: consecutiveReadyPolls
      });

      if (sender) {
        sendEventToSender(sender, 'RESEARCH_RESUMED', {
          ...payload,
          reason: 'occlusion_suspected',
          pausedDurationMs: pausedDuration,
          checkpoint: stage,
          isPaused: false
        });
      }

      // Stabilization wait: 1500ms for Blink compositor and React virtual DOM
      await new Promise(r => setTimeout(r, 1500));

      // Re-check Instagram Reels page state & wake up virtualizer before continuing
      if (effectiveTabId) {
        try {
          const targetReelsUrl = `https://www.instagram.com/${normalizedUser}/reels/`;
          const pageCheck = await injectScript(effectiveTabId, (u) => {
            const href = (window.location.href || '').toLowerCase();
            const onReels = href.includes(`/${u.toLowerCase()}/reels`);
            try {
              window.scrollBy(0, -100);
              window.scrollBy(0, 150);
              window.dispatchEvent(new Event('scroll', { bubbles: true }));
              window.dispatchEvent(new Event('resize', { bubbles: true }));
              window.dispatchEvent(new WheelEvent('wheel', { deltaY: 200, bubbles: true }));
            } catch (e) {}
            return { onReels, href };
          }, [normalizedUser]);

          if (pageCheck && pageCheck.onReels === false && normalizedUser) {
            await updateInstagramTabUrl(effectiveTabId, targetReelsUrl, normalizedUser, 'occlusion_resume:restore_reels_url');
            await new Promise(r => setTimeout(r, 1000));
          } else {
            await new Promise(r => setTimeout(r, 500));
          }
        } catch (e) {}
      }

      const resumeEndTs = Date.now();
      const pauseAndWakeupMs = Math.max(0, resumeEndTs - pauseStartTs);
      // Total excluded time is the single contiguous slice [stallStreakStartTs, resumeEndTs]:
      // clampedPrePauseStallMs ([t0, t1]) + pauseAndWakeupMs ([t1, t2]) with zero overlap.
      const totalExcludedMs = clampedPrePauseStallMs + pauseAndWakeupMs;
      const pauseMeta = {
        reason: 'occlusion_suspected',
        stage,
        startedAt: pauseStartTs,
        endedAt: resumeEndTs,
        durationMs: pauseAndWakeupMs,
        prePauseStallMs: clampedPrePauseStallMs,
        totalExcludedMs,
        winStateAtStart: winStatus.state || 'normal',
        docVisAtStart: initialTabVis.visibilityState || 'hidden',
        winStateAtResume: currentWin.state || 'normal',
        docVisAtResume: currentTabVis.visibilityState || 'visible'
      };

      recordPauseInTracker(timingTracker, totalExcludedMs, pauseMeta);
      return true;
    }

    // Heartbeat event every 5 seconds so client UI and Mini Player stay informed of paused duration
    if (Date.now() - lastHeartbeatTs >= 5000) {
      lastHeartbeatTs = Date.now();
      if (sender) {
        sendEventToSender(sender, 'RESEARCH_PAUSED', {
          ...payload,
          reason: 'occlusion_suspected',
          statusText: occlusionStatusText,
          checkpoint: stage,
          isPaused: true,
          pausedDurationMs: Date.now() - pauseStartTs
        });
      }
    }

    if (Date.now() - pauseStartTs > MAX_PAUSE_MS) {
      const timeoutEndTs = Date.now();
      const timedOutPauseMs = Math.max(0, timeoutEndTs - pauseStartTs);
      const totalTimedOutExcludedMs = clampedPrePauseStallMs + timedOutPauseMs;
      recordPauseInTracker(timingTracker, totalTimedOutExcludedMs, {
        reason: 'occlusion_suspected',
        stage,
        startedAt: pauseStartTs,
        endedAt: timeoutEndTs,
        durationMs: timedOutPauseMs,
        prePauseStallMs: clampedPrePauseStallMs,
        totalExcludedMs: totalTimedOutExcludedMs,
        winStateAtStart: winStatus.state || 'normal',
        docVisAtStart: initialTabVis.visibilityState || 'hidden',
        winStateAtResume: currentWin.state || 'normal',
        docVisAtResume: currentTabVis.visibilityState || 'hidden',
        timedOut: true
      });
      logBoundedDiag('occlusion_pause_timeout_exceeded', normalizedUser, {
        winId: companionWindowId,
        pauseDurationMs: timedOutPauseMs,
        prePauseStallMs: clampedPrePauseStallMs
      });
      throw new Error(`COMPANION_WINDOW_INACTIVITY_TIMEOUT: Instagram research companion window remained covered/inactive for over ${Math.round(MAX_PAUSE_MS / 60000)} minutes.`);
    }
  }
}

chrome.windows.onRemoved.addListener((closedWindowId) => {
  if (companionWindowId === closedWindowId) {
    logBoundedDiag('companion_window_removed', null, { winId: closedWindowId, isResearchActive });
    companionWindowId = null;
    companionTabId = null;
    companionWindowCreatedByUs = false;
    lastUsedIgTabId = null;

    // Set persistent closure error signal if removed during active batch
    if (isResearchActive) {
      companionWindowClosedByUser = true;
    }
  }
});

chrome.tabs.onRemoved.addListener((closedTabId) => {
  if (companionTabId === closedTabId) {
    companionTabId = null;
  }
  if (lastUsedIgTabId === closedTabId) {
    logTabOp('tab_removed_event', null, closedTabId, null, 'Clearing stale lastUsedIgTabId');
    lastUsedIgTabId = null;
  }
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  if (lastUsedIgTabId === removedTabId) {
    logTabOp('tab_replaced_event', null, addedTabId, null, `Replaced old tabId=${removedTabId} with addedTabId=${addedTabId}`);
    lastUsedIgTabId = addedTabId;
  }
});

async function getValidTabById(tabId, username, stage) {
  if (!tabId) return null;
  logTabOp(`${stage}:chrome.tabs.get`, username, tabId, null);
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) {
        logTabOp(`${stage}:chrome.tabs.get_failed`, username, tabId, null, chrome.runtime.lastError?.message || 'Tab not found');
        resolve(null);
        return;
      }
      if (tab.discarded) {
        logTabOp(`${stage}:tab_discarded`, username, tab.id, tab.url, 'Tab is discarded');
      }
      resolve(tab);
    });
  });
}

async function acquireOrCreateInstagramTab(normalizedUser, stage, forceRecreate = false) {
  if (companionWindowClosedByUser) {
    throw new Error('COMPANION_WINDOW_CLOSED: Instagram research companion window was closed by user during this batch.');
  }

  if (companionIdleCloseTimer) {
    clearTimeout(companionIdleCloseTimer);
    companionIdleCloseTimer = null;
  }

  // 1. If companionWindowId exists and forceRecreate is false, validate and reuse it
  if (!forceRecreate && companionWindowId && companionTabId) {
    const companionWin = await getValidCompanionWindow(companionWindowId);
    if (companionWin) {
      const existingTab = await getValidTabById(companionTabId, normalizedUser, `${stage}:validate_companion_tab`);
      if (existingTab && !existingTab.discarded && (existingTab.url || '').includes('instagram.com')) {
        // Keep the research tab active within the companion window
        if (!existingTab.active) {
          await new Promise(res => chrome.tabs.update(existingTab.id, { active: true }, res));
        }
        lastUsedIgTabId = existingTab.id;
        logTabOp(`${stage}:reusing_companion_window_tab`, normalizedUser, existingTab.id, existingTab.url);
        return existingTab;
      }
    }
    logTabOp(`${stage}:companion_window_invalid`, normalizedUser, companionTabId, null, 'Resetting companion window refs');
    companionTabId = null;
    companionWindowId = null;
    companionWindowCreatedByUs = false;
  }

  // 2. Service-worker restart recovery: Look for an existing popup window created for Instagram research
  if (!forceRecreate) {
    const windows = await new Promise(res => chrome.windows.getAll({ populate: true }, res));
    if (windows && windows.length > 0) {
      const existingPopup = windows.find(w =>
        w.type === 'popup' && w.tabs && w.tabs.some(t => !t.discarded && (t.url || '').includes('instagram.com'))
      );
      if (existingPopup) {
        companionWindowId = existingPopup.id;
        companionWindowCreatedByUs = true;
        const igTab = existingPopup.tabs.find(t => !t.discarded && (t.url || '').includes('instagram.com')) || existingPopup.tabs[0];
        companionTabId = igTab.id;
        lastUsedIgTabId = igTab.id;
        if (!igTab.active) {
          await new Promise(res => chrome.tabs.update(igTab.id, { active: true }, res));
        }
        logBoundedDiag('companion_window_adopted', normalizedUser, {
          winId: companionWindowId,
          tabId: companionTabId,
          state: existingPopup.state,
          focused: existingPopup.focused
        });
        return igTab;
      }
    }
  }

  // 3. Create dedicated companion window (popup, unfocused, active tab)
  const initialUrl = normalizedUser
    ? `https://www.instagram.com/${normalizedUser}/reels/`
    : 'https://www.instagram.com/';

  logTabOp(`${stage}:chrome.windows.create`, normalizedUser, null, initialUrl, 'Opening dedicated companion window');

  const createdWin = await new Promise((resolve, reject) => {
    chrome.windows.create({
      url: initialUrl,
      type: 'popup',
      focused: false, // Attempt unfocused so user's active application is not interrupted
      width: 1024,
      height: 768,
      top: 80,
      left: 80
    }, (win) => {
      if (chrome.runtime.lastError || !win) {
        reject(new Error(`COMPANION_WINDOW_CREATION_FAILED: ${chrome.runtime.lastError?.message || 'Failed to create Instagram companion window.'}`));
      } else {
        resolve(win);
      }
    });
  });

  companionWindowId = createdWin.id;
  companionWindowCreatedByUs = true;
  const tab = (createdWin.tabs && createdWin.tabs.length > 0) ? createdWin.tabs[0] : null;
  companionTabId = tab ? tab.id : null;
  lastUsedIgTabId = companionTabId;

  logBoundedDiag('companion_window_created', normalizedUser, {
    winId: createdWin.id,
    tabId: companionTabId,
    state: createdWin.state,
    focused: createdWin.focused,
    type: createdWin.type
  });

  // Wait 1500ms for window & initial renderer initialization
  await new Promise(r => setTimeout(r, 1500));

  const initializedTab = await getValidTabById(companionTabId, normalizedUser, `${stage}:init_companion_tab`);
  return initializedTab || tab;
}

async function updateInstagramTabUrl(tabId, targetUrl, normalizedUser, stage) {
  let validTab = await getValidTabById(tabId, normalizedUser, `${stage}:pre_update_check`);
  if (!validTab || validTab.discarded || (validTab.url && !validTab.url.includes('instagram.com') && !validTab.url.startsWith('about:blank'))) {
    logTabOp(
      `${stage}:tab_unavailable_or_non_ig_before_update`,
      normalizedUser,
      tabId,
      validTab?.url || targetUrl,
      'Reacquiring valid Instagram tab before navigation'
    );
    validTab = await acquireOrCreateInstagramTab(normalizedUser, `${stage}:reacquire`, true);
  }

  const attemptTabUpdate = (targetTabId, currentTabUrl, attemptLabel) => {
    logTabOp(`${stage}:${attemptLabel}`, normalizedUser, targetTabId, targetUrl, `currentTabUrl=${currentTabUrl || 'unknown'}`);
    return new Promise((resolve, reject) => {
      chrome.tabs.update(targetTabId, { url: targetUrl, active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          const rawMsg = chrome.runtime.lastError.message || 'Unknown chrome.tabs.update error';
          const navErr = new Error(rawMsg);
          navErr.isNavigationError = true;
          navErr.navigationDiag = {
            stage,
            requestedUrl: targetUrl,
            tabId: targetTabId,
            currentTabUrl: currentTabUrl || 'unknown',
            originalChromeError: rawMsg
          };
          logTabOp(
            `${stage}:${attemptLabel}_failed`,
            normalizedUser,
            targetTabId,
            targetUrl,
            `currentTabUrl=${currentTabUrl || 'unknown'} | chromeError=${rawMsg}`
          );
          reject(navErr);
        } else {
          resolve(tab);
        }
      });
    });
  };

  let currentTabId = validTab.id;
  let currentTabUrl = validTab.url || 'unknown';

  try {
    const updatedTab = await attemptTabUpdate(currentTabId, currentTabUrl, 'chrome.tabs.update');
    const finalTabId = updatedTab?.id || currentTabId;
    lastUsedIgTabId = finalTabId;
    logTabOp(`${stage}:chrome.tabs.update_success`, normalizedUser, finalTabId, updatedTab?.url || targetUrl);
    return finalTabId;
  } catch (firstErr) {
    const firstDiag = firstErr.navigationDiag || {
      stage,
      requestedUrl: targetUrl,
      tabId: currentTabId,
      currentTabUrl,
      originalChromeError: firstErr.message || String(firstErr)
    };
    console.warn(
      `[TabLifecycle][${stage}] Transient navigation failure on tab ${firstDiag.tabId} (currentUrl=${firstDiag.currentTabUrl} -> requestedUrl=${firstDiag.requestedUrl}): ${firstDiag.originalChromeError}. Performing 1 safe retry...`
    );

    // Wait briefly for any transient renderer/navigation lock to settle (max 1 retry)
    await new Promise(r => setTimeout(r, 1200));

    let retryTab = await getValidTabById(currentTabId, normalizedUser, `${stage}:retry_validate_tab`);
    if (!retryTab || retryTab.discarded || (retryTab.url && !retryTab.url.includes('instagram.com') && !retryTab.url.startsWith('about:blank'))) {
      lastUsedIgTabId = null;
      retryTab = await acquireOrCreateInstagramTab(normalizedUser, `${stage}:retry_reacquire_tab`, true);
    }

    const retryTabId = retryTab.id;
    const retryTabUrl = retryTab.url || 'unknown';

    try {
      const updatedTab = await attemptTabUpdate(retryTabId, retryTabUrl, 'chrome.tabs.update_retry');
      const finalTabId = updatedTab?.id || retryTabId;
      lastUsedIgTabId = finalTabId;
      logTabOp(`${stage}:chrome.tabs.update_retry_success`, normalizedUser, finalTabId, updatedTab?.url || targetUrl);
      return finalTabId;
    } catch (retryErr) {
      lastUsedIgTabId = null;
      const retryChromeError = retryErr.navigationDiag?.originalChromeError || retryErr.message || String(retryErr);
      const finalNavErr = new Error(
        `Navigation rejected at stage "${stage}" for requested URL ${targetUrl} (Tab ID: ${retryTabId}, Current Tab URL: ${retryTabUrl}, Chrome Error: ${retryChromeError})`
      );
      finalNavErr.isNavigationError = true;
      finalNavErr.navigationDiag = {
        stage,
        requestedUrl: targetUrl,
        tabId: retryTabId,
        currentTabUrl: retryTabUrl,
        originalChromeError: retryChromeError,
        initialTabId: firstDiag.tabId,
        initialTabUrl: firstDiag.currentTabUrl,
        initialChromeError: firstDiag.originalChromeError,
        retriedOnce: true
      };
      throw finalNavErr;
    }
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_EXTENSION_STATUS' || request.type === 'PING') {
    sendResponse({ type: 'PONG', status: 'OK', extensionVersion: EXTENSION_VERSION, timestamp: Date.now() });
    return true;
  }

  if (request.type === 'CLOSE_COMPANION_WINDOW' || request.type === 'BATCH_RESEARCH_COMPLETE' || request.type === 'CANCEL_RESEARCH') {
    markBatchCompleted(request.type.toLowerCase());
    closeCompanionWindow(request.type.toLowerCase()).then(() => {
      sendResponse({ status: 'OK', message: 'Companion window closed' });
    }).catch(err => {
      sendResponse({ status: 'ERROR', error: err.message });
    });
    return true;
  }

  if (request.type === 'CHECK_INSTAGRAM_SESSION' || request.type === 'CHECK_INSTAGRAM_LOGIN') {
    checkInstagramStatus().then(status => {
      sendResponse({ type: 'INSTAGRAM_STATUS', ...status });
    }).catch(err => {
      sendResponse({ type: 'INSTAGRAM_STATUS', available: false, session: 'unknown', error: err.toString() });
    });
    return true;
  }

  if (request.type === 'START_PROFILE_RESEARCH') {
    beginOrContinueBatch(request.payload?.jobId);
    // Enforce strict sequential execution across profile research requests
    researchQueue = researchQueue.catch(() => {}).then(async () => {
      try {
        const result = await startProfileResearch(request.payload, sender);
        sendResponse({ type: 'PROFILE_COMPLETED', payload: result });
      } catch (err) {
        sendResponse({ type: 'PROFILE_FAILED', error: err.message || err.toString(), payload: request.payload });
      }
    });
    return true; // asynchronous response
  }

  if (request.type === 'DIAGNOSE_REEL_DISCOVERY') {
    // 1. Immediate synchronous mutual exclusion check: reject if a research batch is currently active
    if (isResearchActive) {
      sendResponse({
        type: 'DIAGNOSTIC_COMPLETED',
        payload: {
          success: false,
          stage: 'batch_in_progress',
          message: 'A batch research run is currently active on the companion tab. Please wait for the batch to finish before running a diagnostic.',
          error: 'BATCH_IN_PROGRESS'
        }
      });
      return true;
    }

    // 2. Serialize through researchQueue so it cannot interleave with queued profile research
    let responded = false;
    const safeSendResponse = (resp) => {
      if (!responded) {
        responded = true;
        try {
          sendResponse(resp);
        } catch (e) {
          console.warn('[DIAGNOSE_REEL_DISCOVERY] sendResponse failed:', e);
        }
      }
    };

    researchQueue = researchQueue.catch(() => {}).then(async () => {
      try {
        // 3. Re-check isResearchActive immediately before executing in case a batch became active while waiting
        if (isResearchActive) {
          safeSendResponse({
            type: 'DIAGNOSTIC_COMPLETED',
            payload: {
              success: false,
              stage: 'batch_in_progress',
              message: 'A batch research run became active while waiting in queue. Please wait for the batch to finish before running a diagnostic.',
              error: 'BATCH_IN_PROGRESS'
            }
          });
          return;
        }

        const result = await runReelDiagnostic(request.payload, sender);
        safeSendResponse({ type: 'DIAGNOSTIC_COMPLETED', payload: result });
      } catch (err) {
        safeSendResponse({
          type: 'DIAGNOSTIC_COMPLETED',
          payload: {
            success: false,
            stage: 'communication_failure',
            message: err.message || err.toString(),
            error: err.toString()
          }
        });
      } finally {
        // 5. Correctly participate in companion window idle-close lifecycle if research is not active
        if (!isResearchActive) {
          scheduleCompanionIdleClose(45000);
        }
      }
    });

    return true; // asynchronous response
  }

  return false;
});

async function checkInstagramStatus() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "*://*.instagram.com/*" }, (tabs) => {
      const isAvailable = tabs && tabs.length > 0;
      const tabId = isAvailable ? tabs[0].id : undefined;

      chrome.cookies.get({ url: 'https://www.instagram.com', name: 'sessionid' }, (cookie) => {
        if (chrome.runtime.lastError) {
          resolve({ available: isAvailable, session: 'unknown', tabId, error: chrome.runtime.lastError.message });
          return;
        }

        if (cookie && cookie.value) {
          resolve({ available: isAvailable, session: 'detected', tabId });
        } else {
          resolve({ available: isAvailable, session: 'login_required', tabId });
        }
      });
    });
  });
}

function normalizeUsername(username) {
  let cleaned = String(username || '').trim();
  if (cleaned.startsWith('@')) {
    cleaned = cleaned.substring(1);
  }
  return cleaned.toLowerCase();
}

function sendEventToSender(sender, eventType, payload) {
  if (sender && sender.tab && sender.tab.id) {
    const senderTabId = sender.tab.id;
    const senderUrl = sender.tab.url || 'velmora-app';
    const user = payload?.username || payload?.verifiedUsername || null;
    logTabOp(`sendEventToSender:${eventType}`, user, senderTabId, senderUrl);
    chrome.tabs.sendMessage(senderTabId, {
      source: 'VELMORA_RND_EXTENSION',
      type: eventType,
      payload
    }).catch((err) => {
      console.warn("Failed to send event to sender tab:", err);
    });
  }
}

async function injectScript(tabId, func, args = [], meta = {}) {
  if (meta.stage) {
    logTabOp(`${meta.stage}:executeScript`, meta.username || null, tabId, meta.url || null);
  }
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func,
      args
    }, (results) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(results[0]?.result);
      }
    });
  });
}

async function sleepBounded(desiredMs, timingTracker = null) {
  const rem =
    timingTracker && typeof timingTracker.getRemainingMs === 'function'
      ? timingTracker.getRemainingMs()
      : desiredMs;
  const waitMs = Math.max(0, Math.min(desiredMs, rem));
  if (waitMs > 0) {
    await new Promise(r => setTimeout(r, waitMs));
  }
  return waitMs;
}

async function verifyProfile(igTabId, targetUsername, timeout = 15000, sender = null, payload = null, timingTracker = null) {
  let elapsed = 0;
  const interval = 1000;
  let consecutiveNotFound = 0;
  let lastDiag = null;
  const targetUrl = `https://www.instagram.com/${targetUsername}/reels/`;
  logTabOp('verifyProfile:start', targetUsername, igTabId, targetUrl);

  while (elapsed < timeout) {
    // Check companion window state before verifying profile: pause countdown if minimized
    await handleCompanionWindowPauseIfNeeded(targetUsername, sender, payload, 'verifyProfile', igTabId, timingTracker);
    if (timingTracker && typeof timingTracker.getRemainingMs === 'function' && timingTracker.getRemainingMs() <= 0) {
      break;
    }

    let res;
    try {
      res = await injectScript(igTabId, (u) => {
        const url = window.location.href;
        const urlLower = url.toLowerCase();
        const userLower = u.toLowerCase();
        const isTargetUserInUrl = urlLower.includes(`/${userLower}`);
        const readyState = document.readyState;

        const mainEl = document.querySelector('main');
        const mainText = (mainEl ? mainEl.innerText : (document.body ? document.body.innerText : '') || '').toLowerCase();
        const pageLower = document.body ? document.body.innerText.toLowerCase() : '';

        const isLoginWall =
          urlLower.includes('/accounts/login') ||
          pageLower.includes("log in to instagram") ||
          pageLower.includes("sign up to see photos") ||
          !!document.querySelector('input[name="username"], input[name="password"]');

        if (isLoginWall) {
          return { status: "login_wall", url, readyState };
        }

        // If URL doesn't yet belong to the target user, wait for navigation before checking for 404/private text
        if (!isTargetUserInUrl) {
          return { status: "loading", reason: "url_not_target_user", url, readyState };
        }

        const hasProfileHeader = !!document.querySelector('header a[href*="/followers/"], main div[role="tablist"], a[href*="/reel/"]');

        // Confirm 404 / unavailable only when target URL has loaded and no valid profile header/grid exists
        if (
          !hasProfileHeader &&
          (mainText.includes("sorry, this page isn't available") ||
           mainText.includes("profile isn't available") ||
           mainText.includes("the link you followed may be broken") ||
           mainText.includes("page not found"))
        ) {
          return { status: "not_found", url, readyState };
        }

        if (mainText.includes("this account is private")) {
          return { status: "private", url, readyState };
        }

        // Strategy 1: Metadata fallback (meta description / og:description)
        const meta = document.querySelector('meta[name="description"]');
        const ogMeta = document.querySelector('meta[property="og:description"]');
        const descContent = ((meta?.getAttribute("content") || "") + " " + (ogMeta?.getAttribute("content") || "")).toLowerCase();
        const targetStr = `@${userLower}`;

        function parseCandidate(str) {
          if (!str || typeof str !== 'string') return null;
          const cleaned = str.trim().replace(/\s+/g, ' ');
          const m = cleaned.match(/^([\d,.]+\s*[kmbKMB]?)$/i);
          if (!m) return null;
          return m[1].replace(/\s+/g, '');
        }

        if (descContent.includes(targetStr) || descContent.includes(userLower)) {
          const match = descContent.match(/([\d,.]+[kmbKMB]?)\s+followers/i);
          if (match) {
            const cand = parseCandidate(match[1]);
            if (cand) return { status: "ok", followerDisplay: cand, source: "meta_description", url, readyState };
          }
        }

        // Strategy 2: Robust Followers anchor discovery across the entire document (main, header, section)
        // Searches beyond document.querySelector('header') to support responsive, modern, and SPA profile layouts
        const allFollowerAnchors = Array.from(document.querySelectorAll('a[href*="/followers/"], a[href$="/followers"], a[href*="/followers?"]'));
        const userFollowerAnchor = allFollowerAnchors.find(a => {
          const href = (a.getAttribute('href') || '').toLowerCase();
          return href.includes(`/${userLower}/followers`) || href.endsWith('/followers/') || href.endsWith('/followers');
        }) || allFollowerAnchors[0];

        if (userFollowerAnchor) {
          // Check span with title attribute (frequently holds exact full count e.g. "436,123")
          const titleSpan = userFollowerAnchor.querySelector('span[title], [title]');
          if (titleSpan) {
            const rawTitle = (titleSpan.getAttribute('title') || '').trim();
            const cand = parseCandidate(rawTitle);
            if (cand) return { status: "ok", followerDisplay: cand, source: "anchor_title", url, readyState };
          }

          // Check inner spans for numeric follower text (e.g. "436K")
          const innerSpans = Array.from(userFollowerAnchor.querySelectorAll('span, div, b, strong'));
          for (const s of innerSpans) {
            const t = (s.innerText || s.textContent || '').trim();
            if (/\d/.test(t) && !/following/i.test(t)) {
              const cand = parseCandidate(t);
              if (cand) return { status: "ok", followerDisplay: cand, source: "anchor_span", url, readyState };
            }
          }

          // Check anchor innerText (e.g. "436K followers")
          const anchorText = (userFollowerAnchor.innerText || userFollowerAnchor.textContent || '').trim();
          const anchorM = anchorText.match(/^([\d,.]+\s*[kmbKMB]?)\s*followers/i) ||
                          anchorText.match(/([\d,.]+\s*[kmbKMB]?)\s+followers/i);
          if (anchorM) {
            const cand = parseCandidate(anchorM[1]);
            if (cand) return { status: "ok", followerDisplay: cand, source: "anchor_text", url, readyState };
          }
        }

        // Strategy 3: Profile stats list items (ul > li: Posts, Followers, Following)
        // Explicitly ensures we NEVER capture the following count or post count
        const statsListItems = Array.from(document.querySelectorAll('main li, header li, section li'));
        for (const li of statsListItems) {
          const text = (li.innerText || li.textContent || '').trim();
          if (/followers\b/i.test(text) && !/following\b/i.test(text)) {
            const titleSpan = li.querySelector('span[title], [title]');
            if (titleSpan) {
              const cand = parseCandidate(titleSpan.getAttribute('title'));
              if (cand) return { status: "ok", followerDisplay: cand, source: "li_title", url, readyState };
            }
            const match = text.match(/([\d,.]+\s*[kmbKMB]?)\s*followers/i);
            if (match) {
              const cand = parseCandidate(match[1]);
              if (cand) return { status: "ok", followerDisplay: cand, source: "li_followers", url, readyState };
            }
          }
        }

        // Strategy 4: Main header container text matching "X followers"
        if (mainEl) {
          const m = mainEl.innerText.match(/\b([\d,.]+\s*[kmbKMB]?)\s+followers\b/i);
          if (m && !m[0].toLowerCase().includes('following')) {
            const cand = parseCandidate(m[1]);
            if (cand) return { status: "ok", followerDisplay: cand, source: "main_text", url, readyState };
          }
        }

        return { status: "loading", reason: "awaiting_follower_data", url, readyState, hasProfileHeader };
      }, [targetUsername]);
    } catch (err) {
      if (isTabInvalidError(err)) {
        logTabOp('verifyProfile:tab_invalid', targetUsername, igTabId, targetUrl, err.message);
        throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected during verification: ${err.message}`);
      }
      res = { status: "loading", reason: "script_error" }; // Treat other execution errors as loading (e.g. page navigated away briefly)
    }

    lastDiag = res;

    if (res?.status === 'ok') return res.followerDisplay;
    if (res?.status === 'login_wall') {
      throw new Error(`Instagram session login required while verifying @${targetUsername} (URL: ${res.url || targetUrl}).`);
    }
    if (res?.status === 'private') {
      throw new Error(`Instagram profile @${targetUsername} is private.`);
    }
    if (res?.status === 'not_found') {
      consecutiveNotFound++;
      if (consecutiveNotFound >= 2 && (res.readyState === 'complete' || res.readyState === 'interactive')) {
        throw new Error(`Instagram profile @${targetUsername} could not be verified (Confirmed Page not found on ${res.url || targetUrl}).`);
      }
    } else {
      consecutiveNotFound = 0;
    }

    const waited = await sleepBounded(interval, timingTracker);
    if (waited <= 0) break;
    elapsed += waited;
  }

  throw new Error(
    `Instagram profile @${targetUsername} verification timed out after ${elapsed}ms (Stage: ${lastDiag?.reason || 'loading'}, URL: ${lastDiag?.url || targetUrl}, readyState: ${lastDiag?.readyState || 'unknown'}).`
  );
}

async function navigateTo(igTabId, url, username = null) {
  return updateInstagramTabUrl(igTabId, url, username, 'navigateTo');
}

function parseInstagramViewCount(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const cleaned = rawText.trim().replace(/\s+/g, ' ');
  if (!cleaned) return null;

  const stripped = cleaned.replace(/^(?:(?:plays?|views?)(?:\s*counts?)?)\s*[:\-–—]?\s*/i, '').trim();
  const match = stripped.match(/^([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?(?:\s*(?:views?|plays?))?$/i);
  const m = match || stripped.match(/\b([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?\s*(?:views?|plays?)\b/i);
  if (!m) return null;

  const numPart = m[1].replace(/,/g, '');
  if ((numPart.match(/\./g) || []).length > 1) return null;
  const base = parseFloat(numPart);
  if (isNaN(base) || base < 0) return null;
  if (base === 0) return 0;

  const mult = (m[2] || '').toLowerCase();
  if (mult === 'k' || mult === 'thousand') return Math.round(base * 1000);
  if (mult === 'm' || mult === 'million') return Math.round(base * 1000000);
  if (mult === 'b' || mult === 'billion') return Math.round(base * 1000000000);
  if (mult === 'lakh' || mult === 'lakhs') return Math.round(base * 100000);
  if (mult === 'crore' || mult === 'crores') return Math.round(base * 10000000);
  if (!mult) return Math.round(base);
  return null;
}

async function discoverReelLinks(igTabId, username = null) {
  const verifiedTab = await getValidTabById(igTabId, username, 'discoverReelLinks:pre_check');
  const tabGetSucceeded = !!verifiedTab;
  logTabOp(
    'discoverReelLinks',
    username,
    igTabId,
    verifiedTab?.url || `https://www.instagram.com/${username || ''}/reels/`,
    `chrome.tabs.get=${tabGetSucceeded ? 'OK' : 'FAILED'}`
  );
  if (!verifiedTab) {
    throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) is unavailable before reel discovery (chrome.tabs.get failed).`);
  }

  try {
    const result = await injectScript(igTabId, (targetUser) => {
      function parseView(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        const cleaned = rawText.trim().replace(/\s+/g, ' ');
        if (!cleaned) return null;

        const stripped = cleaned.replace(/^(?:(?:plays?|views?)(?:\s*counts?)?)\s*[:\-–—]?\s*/i, '').trim();
        const match = stripped.match(/^([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?(?:\s*(?:views?|plays?))?$/i);
        const m = match || stripped.match(/\b([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?\s*(?:views?|plays?)\b/i);
        if (!m) return null;

        const numPart = m[1].replace(/,/g, '');
        if ((numPart.match(/\./g) || []).length > 1) return null;
        const base = parseFloat(numPart);
        if (isNaN(base) || base < 0) return null;
        if (base === 0) return 0;

        const mult = (m[2] || '').toLowerCase();
        if (mult === 'k' || mult === 'thousand') return Math.round(base * 1000);
        if (mult === 'm' || mult === 'million') return Math.round(base * 1000000);
        if (mult === 'b' || mult === 'billion') return Math.round(base * 1000000000);
        if (mult === 'lakh' || mult === 'lakhs') return Math.round(base * 100000);
        if (mult === 'crore' || mult === 'crores') return Math.round(base * 10000000);
        if (!mult) return Math.round(base);
        return null;
      }

      function getTileContainer(a) {
        let tileContainer = a;
        let curr = a.parentElement;
        while (curr && curr !== document.body && curr.tagName !== 'MAIN') {
          const reelsInParent = curr.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]');
          if (reelsInParent.length > 1) {
            break;
          }
          tileContainer = curr;
          curr = curr.parentElement;
        }
        return tileContainer;
      }

      function extractView(a) {
        const tileContainer = getTileContainer(a);

        // 1. Check pinned status on anchor and tileContainer
        const pinnedEl = tileContainer.querySelector('svg[aria-label*="Pinned" i], [aria-label*="Pinned" i]');
        if (pinnedEl) {
          return { rawText: null, count: null, location: 'pinned_skipped', isPinned: true, viewIconFound: false };
        }

        // 2. Check aria-labels & title on anchor and tileContainer
        const ariaCandidates = [
          a.getAttribute('aria-label'),
          a.getAttribute('title'),
          tileContainer.getAttribute('aria-label'),
          tileContainer.getAttribute('title')
        ];
        Array.from(tileContainer.querySelectorAll('[aria-label*="view" i], [aria-label*="play" i]')).forEach(el => {
          ariaCandidates.push(el.getAttribute('aria-label'));
        });
        for (const raw of ariaCandidates) {
          if (!raw) continue;
          const count = parseView(raw);
          if (count !== null) {
            return { rawText: raw, count, location: 'tile_aria_label', isPinned: false, viewIconFound: true };
          }
        }

        // 3. Search for view/play icon in tileContainer or anchor
        const viewIcon = tileContainer.querySelector(
          'svg[aria-label*="View count" i], svg[aria-label*="view count" i], svg[aria-label*="Play count" i], svg[aria-label*="Plays" i], svg[aria-label*="Play" i], svg[aria-label*="Clip" i], svg[aria-label*="Reel" i]'
        );
        if (viewIcon) {
          if (viewIcon.nextElementSibling) {
            const text = (viewIcon.nextElementSibling.innerText || viewIcon.nextElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_next_sibling', isPinned: false, viewIconFound: true };
          }
          if (viewIcon.previousElementSibling) {
            const text = (viewIcon.previousElementSibling.innerText || viewIcon.previousElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_prev_sibling', isPinned: false, viewIconFound: true };
          }

          const parent = viewIcon.parentElement;
          if (parent) {
            const directChildren = Array.from(parent.querySelectorAll('span, div')).filter(el => el !== viewIcon && !viewIcon.contains(el));
            for (const child of directChildren) {
              const text = (child.innerText || child.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_child', isPinned: false, viewIconFound: true };
            }
            const parentText = (parent.innerText || parent.textContent || '').trim();
            const count = parseView(parentText);
            if (count !== null) return { rawText: parentText, count, location: 'parent_text', isPinned: false, viewIconFound: true };

            if (parent.nextElementSibling) {
              const text = (parent.nextElementSibling.innerText || parent.nextElementSibling.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_next_sibling', isPinned: false, viewIconFound: true };
            }
          }

          let curr = parent ? parent.parentElement : null;
          while (curr && curr !== tileContainer.parentElement && curr !== document.body) {
            const candidateNodes = Array.from(curr.querySelectorAll('span, div')).filter(el => !viewIcon.contains(el));
            for (const node of candidateNodes) {
              const parentWithSvg = node.parentElement;
              if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
                continue;
              }
              const text = (node.innerText || node.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'wrapper_span', isPinned: false, viewIconFound: true };
            }
            curr = curr.parentElement;
          }
        }

        const hasViewIcon = !!viewIcon;

        // 4. Fallback: inspect leaf spans/divs in tileContainer (excluding like/comment overlays)
        const leafCandidates = [];
        const innerSpans = Array.from(tileContainer.querySelectorAll('span, div'));
        for (const span of innerSpans) {
          if (span.querySelector('span, div')) continue;
          const parentWithSvg = span.parentElement;
          if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
            continue;
          }
          const text = (span.innerText || span.textContent || '').trim();
          const count = parseView(text);
          if (count !== null) {
            leafCandidates.push({ rawText: text, count });
          }
        }

        if (leafCandidates.length > 0) {
          const lastCandidate = leafCandidates[leafCandidates.length - 1];
          return {
            rawText: lastCandidate.rawText,
            count: lastCandidate.count,
            location: leafCandidates.length > 1 ? `tile_last_leaf_of_${leafCandidates.length}` : 'tile_child_span',
            isPinned: false,
            viewIconFound: hasViewIcon
          };
        }

        // 5. Direct text & regex scan across anchor & tileContainer
        const anchorDirectText = (a.innerText || a.textContent || '').trim();
        const directCount = parseView(anchorDirectText);
        if (directCount !== null) {
          return { rawText: anchorDirectText, count: directCount, location: 'anchor_direct_text', isPinned: false, viewIconFound: hasViewIcon };
        }

        const tileDirectText = (tileContainer.innerText || tileContainer.textContent || '').trim();
        const tileCount = parseView(tileDirectText);
        if (tileCount !== null) {
          return { rawText: tileDirectText, count: tileCount, location: 'tile_direct_text', isPinned: false, viewIconFound: hasViewIcon };
        }

        const combinedText = `${anchorDirectText} ${tileDirectText}`;
        const allMatches = Array.from(combinedText.matchAll(/\b(\d[\d,.]*\s*(?:[kmbKMB]|thousand|million|billion|lakhs?|crores?)?(?:\s*(?:views?|plays?))?)\b/gi));
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const candidateStr = allMatches[i][1].trim();
          const count = parseView(candidateStr);
          if (count !== null) {
            return { rawText: candidateStr, count, location: 'tile_candidate_regex', isPinned: false, viewIconFound: hasViewIcon };
          }
        }

        return { rawText: null, count: null, location: hasViewIcon ? 'text_not_matched' : 'icon_not_found', isPinned: false, viewIconFound: hasViewIcon };
      }

      function matchReelAnchor(a) {
        if (!a) return null;
        const rawHref = (a.getAttribute('href') || a.href || '').trim();
        if (!rawHref) return null;
        const href = rawHref.toLowerCase();
        const userLower = (targetUser || '').toLowerCase();
        const urlLower = window.location.href.toLowerCase();
        const isReelsPage = urlLower.includes(`/${userLower}/reels`);

        if (
          href === '/reels/' || href === '/reels' || href.startsWith('/reels?') ||
          href === '/' || href === '/explore/' || href === '/direct/' ||
          href.startsWith('/stories/') || href.startsWith('/accounts/') ||
          href.startsWith('/about/') || href.startsWith('/legal/') ||
          (userLower && (
            href === `/${userLower}/reels/` || href === `/${userLower}/reels` ||
            href === `/${userLower}/` || href === `/${userLower}` ||
            href === `/${userLower}/tagged/` || href === `/${userLower}/tagged` ||
            href.endsWith(`/${userLower}/reels/`) || href.endsWith(`/${userLower}/reels`)
          ))
        ) {
          return null;
        }

        const reelMatch = rawHref.match(/(?:\/[^/]+)?\/reels?\/([A-Za-z0-9_-]+)/i);
        if (reelMatch && reelMatch[1]) {
          const sc = reelMatch[1];
          if (!['reels', 'videos', 'tagged', 'audio', 'explore', 'feed'].includes(sc.toLowerCase())) {
            return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: 'reel_path' };
          }
        }

        const postMatch = rawHref.match(/(?:\/[^/]+)?\/p\/([A-Za-z0-9_-]+)/i);
        if (postMatch && postMatch[1]) {
          const sc = postMatch[1];
          if (isReelsPage) {
            return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: 'reels_tab_item' };
          }
          const hasVideo = !!a.querySelector('video');
          const hasReelSvg = !!a.querySelector('svg[aria-label*="Reel" i], svg[aria-label*="Clip" i], svg[aria-label*="Video" i], svg[aria-label*="Play" i]');
          const hasViewIcon = !!a.querySelector('svg[aria-label*="View count" i], svg[aria-label*="view count" i]');
          const text = (a.innerText || a.textContent || '').trim();
          const hasViewText = /\b\d[\d,.]*\s*[kmbKMB]?(?:\s*(?:views?|plays?))\b/i.test(text);

          if (hasVideo || hasReelSvg || hasViewIcon || hasViewText) {
            return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: hasReelSvg ? 'svg_indicator' : hasVideo ? 'video_tag' : 'view_indicator' };
          }
        }
        return null;
      }

      const allDocAnchors = Array.from(document.querySelectorAll('a[href]'));
      const reelCandidates = allDocAnchors
        .map(a => ({ anchor: a, match: matchReelAnchor(a) }))
        .filter(item => item.match !== null);

      return reelCandidates.map(({ anchor: a, match }) => {
        const cleanUrl = match.canonicalUrl;

        const viewData = extractView(a);
        let missingDiag = null;
        if (viewData.count === null && !viewData.isPinned) {
          const anchorText = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
          const descendantTexts = Array.from(a.querySelectorAll('span, div, svg'))
            .map(el => {
              const t = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
              const aria = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
              return t || (aria ? `[aria:${aria}]` : '');
            })
            .filter(Boolean)
            .slice(0, 8);
          missingDiag = {
            anchorText,
            descendantTexts,
            outerHTMLSnippet: a.outerHTML.slice(0, 350)
          };
        }

        return {
          url: cleanUrl,
          isPinned: viewData.isPinned,
          viewCount: viewData.count,
          rawViewText: viewData.rawText,
          viewIconLocation: viewData.location,
          viewIconFound: viewData.viewIconFound,
          missingDiag
        };
      });
    }, [username]);
    return result || [];
  } catch (err) {
    console.warn("[discoverReelLinks] Error discovering reels:", err.message || err);
    if (isTabInvalidError(err)) {
      logTabOp('discoverReelLinks:tab_invalid', username, igTabId, null, err.message);
      throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected during reel discovery: ${err.message}`);
    }
    return [];
  }
}

async function scrollUntilEnoughReels(igTabId, sender, payload, options = {}) {
  const normalizedUser = normalizeUsername(payload?.username);
  logTabOp('scrollUntilEnoughReels:start', normalizedUser, igTabId);

  const scrollStartTs = Date.now();
  const scrollPhaseTimeoutMs =
    typeof options?.phaseTimeoutMs === 'number' && options.phaseTimeoutMs > 0
      ? options.phaseTimeoutMs
      : 60000; // 60s active (non-paused) ceiling per scroll phase
  const profileTiming = options?.profileTiming || null;

  let scrollPausedMs = 0;
  let minimizedPausedMs = 0;
  let occlusionPausedMs = 0;
  let prePauseStallExcludedMs = 0;
  let minimizedPauseCount = 0;
  let occlusionPauseCount = 0;
  let resumeCount = 0;
  let lastPauseReason = null;
  const pauseEvents = [];

  const scrollTimingTracker = {
    pausedMs: 0,
    minimizedPausedMs: 0,
    occlusionPausedMs: 0,
    prePauseStallExcludedMs: 0,
    minimizedPauseCount: 0,
    occlusionPauseCount: 0,
    resumeCount: 0,
    lastPauseReason: null,
    pauseEvents,
    onPauseElapsed(ms, meta = null) {
      const didResume = !meta || !meta.timedOut;
      scrollPausedMs += ms;
      if (meta && meta.reason === 'occlusion_suspected') {
        occlusionPausedMs += meta.durationMs || 0;
        prePauseStallExcludedMs += meta.prePauseStallMs || 0;
        occlusionPauseCount++;
        if (didResume) resumeCount++;
        lastPauseReason = 'occlusion_suspected';
      } else {
        minimizedPausedMs += ms;
        minimizedPauseCount++;
        if (didResume) resumeCount++;
        lastPauseReason = 'companion_window_minimized';
      }
      if (meta) {
        pauseEvents.push(meta);
      }
      this.pausedMs = scrollPausedMs;
      this.minimizedPausedMs = minimizedPausedMs;
      this.occlusionPausedMs = occlusionPausedMs;
      this.prePauseStallExcludedMs = prePauseStallExcludedMs;
      this.minimizedPauseCount = minimizedPauseCount;
      this.occlusionPauseCount = occlusionPauseCount;
      this.resumeCount = resumeCount;
      this.lastPauseReason = lastPauseReason;

      if (profileTiming && typeof profileTiming === 'object') {
        profileTiming.pausedMs = (profileTiming.pausedMs || 0) + ms;
        profileTiming.minimizedPausedMs = (profileTiming.minimizedPausedMs || 0) + (meta?.reason === 'occlusion_suspected' ? 0 : ms);
        profileTiming.occlusionPausedMs = (profileTiming.occlusionPausedMs || 0) + (meta?.reason === 'occlusion_suspected' ? (meta.durationMs || 0) : 0);
        profileTiming.prePauseStallExcludedMs = (profileTiming.prePauseStallExcludedMs || 0) + (meta?.prePauseStallMs || 0);
        profileTiming.minimizedPauseCount = (profileTiming.minimizedPauseCount || 0) + (meta?.reason === 'occlusion_suspected' ? 0 : 1);
        profileTiming.occlusionPauseCount = (profileTiming.occlusionPauseCount || 0) + (meta?.reason === 'occlusion_suspected' ? 1 : 0);
        if (didResume) {
          profileTiming.resumeCount = (profileTiming.resumeCount || 0) + 1;
        }
        profileTiming.lastPauseReason = lastPauseReason;
        if (Array.isArray(profileTiming.pauseEvents) && meta) {
          profileTiming.pauseEvents.push(meta);
        }
      }
    }
  };

  const getActiveScrollElapsedMs = () => Math.max(0, (Date.now() - scrollStartTs) - scrollPausedMs);
  const getRemainingBudgetMs = () => {
    const remPhase = scrollPhaseTimeoutMs - getActiveScrollElapsedMs();
    const remProfile =
      profileTiming && typeof profileTiming.getRemainingMs === 'function'
        ? profileTiming.getRemainingMs()
        : Infinity;
    return Math.min(remPhase, remProfile);
  };
  const getBudgetExitReason = () => {
    if (profileTiming && typeof profileTiming.getRemainingMs === 'function' && profileTiming.getRemainingMs() <= 0) {
      return 'profile_deadline_reached';
    }
    return 'phase_timeout';
  };

  let scrollRounds = 0;
  let stableRounds = 0;
  let zeroRounds = 0;
  let loadingGraceRounds = 0;
  let occludedStallRounds = 0;
  let unfocusedStallRounds = 0;
  let occludedStallStreakStartTs = null;
  let recoveryBounceAttempted = false;
  let uniqueReelCount = 0;
  let allDiscovered = [];
  let lastLoadingSpinner = false;
  let lastDocVisibility = 'unknown';
  let exitReason = 'max_scrolls_reached';

  const targetValidCounts = 15;
  const maxScrolls = 20;
  const maxStableRounds = 8; // Increased from 5 to 8 for background occluded hydration resilience
  const maxZeroRounds = 8;   // Increased from 5 to 8 to avoid premature empty-page termination
  const maxLoadingGraceRounds = 3; // Bounded grace when loading indicator is active; never keeps scraper running indefinitely

  const resetStallCounters = () => {
    stableRounds = 0;
    zeroRounds = 0;
    loadingGraceRounds = 0;
    occludedStallRounds = 0;
    unfocusedStallRounds = 0;
    occludedStallStreakStartTs = null;
  };

  let thrownScrollError = null;
  try {
  while (scrollRounds < maxScrolls) {
    // 1. Check companion window state before scroll round: pause if genuinely minimized.
    // Paused duration is tracked in scrollPausedMs and excluded from active phase/profile timeouts.
    const wasPaused = await handleCompanionWindowPauseIfNeeded(
      normalizedUser,
      sender,
      payload,
      'scrollUntilEnoughReels',
      igTabId,
      scrollTimingTracker
    );
    if (wasPaused) {
      // Explicitly reset stall counters when resuming from a pause so pause duration never causes premature plateau!
      resetStallCounters();
    }

    const roundStartTs = Date.now();

    // 2. Check active (non-paused) scroll-phase and overall profile budget
    if (getRemainingBudgetMs() <= 0) {
      exitReason = getBudgetExitReason();
      console.warn(`[scrollUntilEnoughReels] Bounded timeout (${exitReason}, activeElapsed=${getActiveScrollElapsedMs()}ms, paused=${scrollPausedMs}ms) reached for @${normalizedUser}.`);
      break;
    }

    const currentBatch = await discoverReelLinks(igTabId, normalizedUser);
    const previousUniqueCount = uniqueReelCount;
    let newUrlsFoundThisRound = 0;

    // Deduplicate and update view counts if previously missed
    const urlMap = new Map(allDiscovered.map(r => [r.url, r]));
    for (const reel of currentBatch) {
      if (!urlMap.has(reel.url)) {
        allDiscovered.push(reel);
        urlMap.set(reel.url, reel);
        newUrlsFoundThisRound++;
      } else {
        const existing = urlMap.get(reel.url);
        if (existing.viewCount === null && reel.viewCount !== null) {
          existing.viewCount = reel.viewCount;
          existing.rawViewText = reel.rawViewText;
          existing.viewIconLocation = reel.viewIconLocation;
          existing.viewIconFound = reel.viewIconFound;
        }
      }
    }

    uniqueReelCount = allDiscovered.length;
    const validNonPinnedCount = allDiscovered.filter(r => !r.isPinned && typeof r.viewCount === 'number' && r.viewCount >= 0).length;

    sendEventToSender(sender, 'REELS_DISCOVERED', {
      ...payload,
      discovered: uniqueReelCount,
      validViews: validNonPinnedCount,
      newDiscovered: newUrlsFoundThisRound,
      scrollRound: scrollRounds,
      stableRounds,
      zeroRounds,
      elapsedMs: getActiveScrollElapsedMs(),
      pausedMs: scrollPausedMs
    });

    if (validNonPinnedCount >= targetValidCounts) {
      exitReason = 'target_reels_reached';
      break;
    }

    // Active loading indicator acts as a supporting signal with strictly bounded grace rounds
    const isLoadingActive = lastLoadingSpinner && loadingGraceRounds < maxLoadingGraceRounds;

    if (uniqueReelCount > previousUniqueCount) {
      // Observable DOM progress: reset all plateau and occlusion stall counters
      resetStallCounters();
      recoveryBounceAttempted = false;
    } else {
      // No new reels discovered this round
      if (isLoadingActive) {
        loadingGraceRounds++;
        occludedStallRounds = 0;
        unfocusedStallRounds = 0;
        occludedStallStreakStartTs = null;
        console.log(`[scrollUntilEnoughReels] Active loading indicator detected for @${normalizedUser} at ${uniqueReelCount} reels (grace round ${loadingGraceRounds}/${maxLoadingGraceRounds}). Deferring stall increment...`);
      } else {
        if (uniqueReelCount > 0) {
          stableRounds++;
        } else {
          zeroRounds++;
        }

        // Evaluate multi-signal occlusion state for this stalled round
        let roundWinStatus = { valid: true, state: 'normal', focused: true };
        try {
          roundWinStatus = await checkCompanionWindowState();
        } catch (e) {}

        if (lastDocVisibility === 'unknown' && igTabId) {
          try {
            const tabVis = await checkTabVisibility(igTabId);
            if (tabVis && tabVis.visibilityState) {
              lastDocVisibility = tabVis.visibilityState;
            }
          } catch (e) {}
        }

        const isUnminimizedAndUnfocused =
          roundWinStatus.valid &&
          !isCompanionWindowMinimized(roundWinStatus) &&
          !roundWinStatus.focused;
        const isConfirmedHiddenOcclusion =
          isUnminimizedAndUnfocused && lastDocVisibility === 'hidden';

        if (isConfirmedHiddenOcclusion) {
          if (occludedStallRounds === 0 || occludedStallStreakStartTs === null) {
            occludedStallStreakStartTs = roundStartTs;
          }
          occludedStallRounds++;
          unfocusedStallRounds++;
        } else if (isUnminimizedAndUnfocused && lastDocVisibility === 'unknown') {
          if (unfocusedStallRounds === 0 || occludedStallStreakStartTs === null) {
            occludedStallStreakStartTs = roundStartTs;
          }
          unfocusedStallRounds++;
          occludedStallRounds = 0;
        } else {
          // Window is visible or focused: ordinary slow-loading/pagination delay must NOT be excluded from active time
          occludedStallRounds = 0;
          unfocusedStallRounds = 0;
          occludedStallStreakStartTs = null;
        }

        const shouldTriggerOcclusionPause =
          isOcclusionAutoPauseEnabled(payload) &&
          (occludedStallRounds >= OCCLUSION_STALL_ROUNDS_HIDDEN ||
           (unfocusedStallRounds >= OCCLUSION_STALL_ROUNDS_FALLBACK && recoveryBounceAttempted));

        if (shouldTriggerOcclusionPause) {
          const confirmedPrePauseStallMs =
            occludedStallStreakStartTs !== null
              ? Math.max(0, Date.now() - occludedStallStreakStartTs)
              : 0;
          const stalledRoundsToRefund = Math.max(occludedStallRounds, unfocusedStallRounds);
          // Clear streak start before pausing so it can never be double-counted
          occludedStallStreakStartTs = null;

          const pausedForOcclusion = await handleCompanionOcclusionPauseIfNeeded(
            normalizedUser,
            sender,
            payload,
            'scrollUntilEnoughReels:occlusion_stall',
            igTabId,
            scrollTimingTracker,
            confirmedPrePauseStallMs
          );
          if (pausedForOcclusion) {
            resetStallCounters();
            recoveryBounceAttempted = false;
            scrollRounds = Math.max(0, scrollRounds - Math.max(0, stalledRoundsToRefund - 1));
            continue;
          }
        }
      }

      if (uniqueReelCount > 0 && stableRounds >= maxStableRounds) {
        // If we have not reached targetValidCounts, attempt adaptive recovery bounce before declaring plateau
        const remRecoveryBudget = getRemainingBudgetMs();
        if (uniqueReelCount < targetValidCounts && remRecoveryBudget > 0) {
          console.log(`[scrollUntilEnoughReels] Plateau encountered (${stableRounds} rounds) at ${uniqueReelCount} reels for @${normalizedUser}. Attempting adaptive recovery bounce...`);
          recoveryBounceAttempted = true;
          try {
            await injectScript(igTabId, () => {
              window.scrollBy(0, -400);
              window.scrollBy(0, 600);
              window.dispatchEvent(new Event('scroll', { bubbles: true }));
              window.dispatchEvent(new Event('resize', { bubbles: true }));
              window.dispatchEvent(new WheelEvent('wheel', { deltaY: 500, bubbles: true }));
            });
            const recoveryWaitMs = Math.max(0, Math.min(3500, getRemainingBudgetMs()));
            if (recoveryWaitMs > 0) {
              await new Promise(r => setTimeout(r, recoveryWaitMs));
            }
            const pausedInRecovery = await handleCompanionWindowPauseIfNeeded(
              normalizedUser,
              sender,
              payload,
              'scrollUntilEnoughReels:recovery_bounce',
              igTabId,
              scrollTimingTracker
            );
            if (pausedInRecovery) {
              resetStallCounters();
              continue;
            }
            const recoveryBatch = await discoverReelLinks(igTabId, normalizedUser);
            if (recoveryBatch.length > currentBatch.length || recoveryBatch.some(r => !urlMap.has(r.url))) {
              resetStallCounters();
              continue;
            }
          } catch (e) {}
        }
        // If the window became occluded during earlier visible slow-loading and hasn't yet reached 4 occluded rounds,
        // allow it to reach the occlusion pause threshold instead of exiting prematurely as Partial
        if (isOcclusionAutoPauseEnabled(payload) && occludedStallRounds > 0 && occludedStallRounds < OCCLUSION_STALL_ROUNDS_HIDDEN && getRemainingBudgetMs() > 0) {
          console.log(`[scrollUntilEnoughReels] Deferring plateau exit while occlusion stall confirmation is in progress (${occludedStallRounds}/${OCCLUSION_STALL_ROUNDS_HIDDEN})...`);
        } else {
          exitReason = getRemainingBudgetMs() <= 0 ? getBudgetExitReason() : 'plateau_reached';
          console.log(`[scrollUntilEnoughReels] Plateau confirmed (${exitReason}) after ${stableRounds} stable rounds for @${normalizedUser} (${uniqueReelCount} discovered, ${validNonPinnedCount} valid non-pinned).`);
          break; // Plateau reached after bounded adaptive attempts
        }
      } else if (uniqueReelCount === 0 && zeroRounds >= maxZeroRounds) {
        if (isOcclusionAutoPauseEnabled(payload) && occludedStallRounds > 0 && occludedStallRounds < OCCLUSION_STALL_ROUNDS_HIDDEN && getRemainingBudgetMs() > 0) {
          console.log(`[scrollUntilEnoughReels] Deferring zero_reels exit while occlusion stall confirmation is in progress (${occludedStallRounds}/${OCCLUSION_STALL_ROUNDS_HIDDEN})...`);
        } else {
          exitReason = 'zero_reels';
          console.log(`[scrollUntilEnoughReels] 0 reels remaining after ${zeroRounds} attempts for @${normalizedUser}.`);
          break; // If 0 reels remain after bounded attempts, stop scrolling empty page
        }
      }
    }

    // Real browser scroll operation with adaptive triggers
    let scrollDiag = null;
    try {
      scrollDiag = await injectScript(igTabId, (isStall) => {
        const doc = document;
        const allDocAnchors = Array.from(doc.querySelectorAll('a[href]'));
        const reelAnchors = allDocAnchors.filter(a => {
          const href = (a.getAttribute('href') || a.href || '').toLowerCase();
          return href.includes('/reel/') || href.includes('/p/') || /\/reels\/[A-Za-z0-9_-]+\/?/.test(href);
        });
        if (reelAnchors.length > 0) {
          const lastAnchor = reelAnchors[reelAnchors.length - 1];
          try {
            lastAnchor.scrollIntoView({ behavior: 'instant', block: 'end' });
          } catch (e) {}
        }

        const scrollingEl = doc.scrollingElement || doc.documentElement || doc.body;
        const scrollHeight = Math.max(
          doc.documentElement ? doc.documentElement.scrollHeight : 0,
          doc.body ? doc.body.scrollHeight : 0,
          scrollingEl ? scrollingEl.scrollHeight : 0
        );

        // Perform scroll
        window.scrollTo({ top: scrollHeight, behavior: 'instant' });
        if (scrollingEl) {
          scrollingEl.scrollTop = scrollHeight;
        }

        // Gentle pointer activation to mount lazy view count badges on visible tiles
        try {
          reelAnchors.slice(0, 15).forEach(a => {
            a.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true }));
            a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
          });
        } catch (e) {}

        // Real browser micro-scroll bounce to trigger IntersectionObserver threshold crossing
        if (isStall) {
          window.scrollBy(0, -250);
          window.scrollBy(0, 350);
        } else {
          window.scrollBy(0, -100);
          window.scrollBy(0, 200);
        }
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 300, bubbles: true }));

        // Multi-selector loading indicator detection: SVG spinner, ARIA progressbar, skeleton placeholder
        const isLoadingSpinner = !!(
          doc.querySelector('svg[aria-label*="Loading" i], svg[aria-label*="Loading..."], div[aria-label*="Loading" i]') ||
          doc.querySelector('div[role="progressbar"], [aria-busy="true"]') ||
          doc.querySelector('div[class*="Skeleton" i], div[class*="skeleton" i], div[class*="spinner" i], div[class*="loading" i]')
        );

        return {
          scrollHeight,
          isLoadingSpinner,
          docVisibility: doc.visibilityState || 'unknown',
          docHidden: !!doc.hidden
        };
      }, [stableRounds >= 2]);
    } catch (err) {
      if (isTabInvalidError(err)) {
        logTabOp('scrollUntilEnoughReels:tab_invalid', normalizedUser, igTabId, null, err.message);
        throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected during scrolling: ${err.message}`);
      }
    }

    lastLoadingSpinner = !!scrollDiag?.isLoadingSpinner;
    if (scrollDiag?.docVisibility) {
      lastDocVisibility = scrollDiag.docVisibility;
      if (lastDocVisibility === 'visible') {
        occludedStallRounds = 0;
        occludedStallStreakStartTs = null;
      }
    }
    scrollRounds++;

    // Clamp per-round wait to remaining phase/profile budget so sleeps never overshoot the deadline
    const desiredWaitMs = lastLoadingSpinner ? 3500 : 2500;
    const remainingBeforeSleep = getRemainingBudgetMs();
    if (remainingBeforeSleep <= 0) {
      exitReason = getBudgetExitReason();
      console.warn(`[scrollUntilEnoughReels] Bounded timeout (${exitReason}, activeElapsed=${getActiveScrollElapsedMs()}ms, paused=${scrollPausedMs}ms) reached before round sleep for @${normalizedUser}.`);
      break;
    }
    const clampedWaitMs = Math.max(0, Math.min(desiredWaitMs, remainingBeforeSleep));
    await new Promise(r => setTimeout(r, clampedWaitMs));

    // Check pause state immediately after round sleep so minimization during the final round sleep is caught before exit
    const pausedAfterSleep = await handleCompanionWindowPauseIfNeeded(
      normalizedUser,
      sender,
      payload,
      'scrollUntilEnoughReels:post_sleep',
      igTabId,
      scrollTimingTracker
    );
    if (pausedAfterSleep) {
      resetStallCounters();
    }
  }
  } catch (scrollErr) {
    thrownScrollError = scrollErr;
    const errMsg = String(scrollErr?.message || scrollErr || '');
    if (errMsg.includes('COMPANION_WINDOW_INACTIVITY_TIMEOUT') || errMsg.includes('COMPANION_WINDOW_MINIMIZED_TIMEOUT')) {
      exitReason = 'pause_inactivity_timeout';
    } else if (errMsg.includes('COMPANION_WINDOW_CLOSED')) {
      exitReason = 'companion_window_closed';
    } else {
      exitReason = 'scroll_error';
    }
  }

  let finalWinState = 'unknown';
  let finalWinFocused = false;
  try {
    const winStatus = await checkCompanionWindowState();
    finalWinState = winStatus.valid ? (winStatus.state || 'normal') : 'closed';
    finalWinFocused = !!winStatus.focused;
  } catch (e) {}

  if (lastDocVisibility === 'unknown' && igTabId) {
    try {
      const tabVis = await checkTabVisibility(igTabId);
      if (tabVis && tabVis.visibilityState) {
        lastDocVisibility = tabVis.visibilityState;
      }
    } catch (e) {}
  }

  const activeElapsedMs = getActiveScrollElapsedMs();
  const validViewsCount = allDiscovered.filter(r => !r.isPinned && typeof r.viewCount === 'number' && r.viewCount >= 0).length;
  const finalScrollDiag = {
    exitReason,
    elapsedMs: activeElapsedMs,
    wallElapsedMs: Date.now() - scrollStartTs,
    pausedMs: scrollPausedMs,
    minimizedPausedMs,
    occlusionPausedMs,
    prePauseStallExcludedMs,
    minimizedPauseCount,
    occlusionPauseCount,
    resumeCount,
    lastPauseReason,
    pauseEvents,
    scrollRounds,
    stableRounds,
    zeroRounds,
    loadingGraceRounds,
    totalDiscovered: uniqueReelCount,
    validViews: validViewsCount,
    lastLoadingIndicator: lastLoadingSpinner,
    docVisibility: lastDocVisibility,
    winState: finalWinState,
    winFocused: finalWinFocused
  };

  allDiscovered.scrollDiag = finalScrollDiag;
  if (typeof options?.onScrollDiag === 'function') {
    try {
      options.onScrollDiag(finalScrollDiag);
    } catch (e) {}
  }
  logBoundedDiag('scroll_phase_complete', normalizedUser, finalScrollDiag);

  console.log(`[scrollUntilEnoughReels] Completed for @${normalizedUser}: exitReason="${exitReason}", discovered=${uniqueReelCount}, validViews=${validViewsCount}, rounds=${scrollRounds}, activeElapsed=${activeElapsedMs}ms, paused=${scrollPausedMs}ms, vis=${lastDocVisibility}, win=${finalWinState}.`);

  if (thrownScrollError) {
    thrownScrollError.scrollDiag = finalScrollDiag;
    throw thrownScrollError;
  }

  return allDiscovered;
}

function categorize(views) {
  const validViews = Array.isArray(views)
    ? views.filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)
    : [];

  if (validViews.length < 7) {
    return "NotEnoughReels";
  }

  const counts = {
    C1L1: validViews.filter(v => v >= 1000000).length,
    C1L2: validViews.filter(v => v >= 500000).length,
    C2L1: validViews.filter(v => v >= 250000).length,
    C2L2: validViews.filter(v => v >= 100000).length,
    C3L1: validViews.filter(v => v >= 50000).length,
    C3L2: validViews.filter(v => v >= 25000).length,
    C4L1: validViews.filter(v => v >= 10000).length
  };
  const below_10k_count = validViews.filter(v => v < 10000).length;

  if (counts.C1L1 >= 7) {
    return "C1L1";
  } else if (counts.C1L2 >= 7) {
    return "C1L2";
  } else if (counts.C2L1 >= 7) {
    return "C2L1";
  } else if (counts.C2L2 >= 7) {
    return "C2L2";
  } else if (counts.C3L1 >= 7) {
    return "C3L1";
  } else if (counts.C3L2 >= 7) {
    return "C3L2";
  } else if (counts.C4L1 >= 7) {
    return "C4L1";
  } else if (below_10k_count >= 7) {
    return "C4L2";
  } else {
    return "Uncategorized";
  }
}

function processDiscoveredReels(discoveredArray, sender, payload) {
  // Exclude pinned
  const nonPinned = discoveredArray.filter(r => !r.isPinned);
  const pinnedCount = discoveredArray.length - nonPinned.length;

  sendEventToSender(sender, 'PINNED_REELS_FILTERED', { ...payload, excluded: pinnedCount });

  // Non-pinned reels with valid view counts
  const validWithViews = nonPinned.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0);

  // Select up to 15 valid non-pinned reels preserving order
  let selected;
  if (validWithViews.length >= 15) {
    selected = validWithViews.slice(0, 15);
  } else {
    // If fewer than 15 valid with views, include all valid ones, then remaining non-pinned reels
    const validUrlSet = new Set(validWithViews.map(r => r.url));
    const missingViews = nonPinned.filter(r => !validUrlSet.has(r.url));
    selected = [...validWithViews, ...missingViews].slice(0, 15);
  }

  const selectedReels = selected.map((r, i) => ({
    reelUrl: r.url,
    isPinned: false,
    discoveryIndex: i + 1,
    viewCount: typeof r.viewCount === 'number' ? r.viewCount : null,
    rawViewText: r.rawViewText || null,
    viewIconLocation: r.viewIconLocation || null,
    missingDiag: r.missingDiag || null
  }));

  const validCounts = selectedReels
    .map(r => r.viewCount)
    .filter(v => typeof v === 'number' && v >= 0);

  const failedAnchors = selectedReels.filter(r => typeof r.viewCount !== 'number');
  if (validCounts.length < 15) {
    console.log(`[processDiscoveredReels] Partial sample for @${payload?.username || 'unknown'}:`, {
      reelsDiscovered: discoveredArray.length,
      pinnedExcluded: pinnedCount,
      nonPinnedDiscovered: nonPinned.length,
      selectedReelCount: selectedReels.length,
      validViewCountsCount: validCounts.length,
      failedExtractionAnchorsCount: failedAnchors.length,
      failedAnchors: failedAnchors.map(f => ({
        reelUrl: f.reelUrl,
        viewIconLocation: f.viewIconLocation,
        missingDiag: f.missingDiag
      }))
    });
  }

  const totalViews = validCounts.reduce((sum, v) => sum + v, 0);
  const averageViews = validCounts.length > 0 ? Math.round(totalViews / validCounts.length) : 0;
  const category = categorize(validCounts);

  sendEventToSender(sender, 'REELS_SELECTION_COMPLETE', {
    ...payload,
    selected: selectedReels.length,
    validViewCounts: validCounts.length,
    averageViews,
    category
  });

  return {
    reelsDiscovered: discoveredArray.length,
    pinnedReelsExcluded: pinnedCount,
    selectedReelCount: selectedReels.length,
    selectedReels,
    validViewCountsCount: validCounts.length,
    averageViews,
    rawViewCounts: validCounts,
    category,
    creatorCategory: category,
    missingViewCountsCount: Math.max(0, 15 - validCounts.length),
    failedExtractionAnchorsCount: failedAnchors.length
  };
}

async function waitForReelsPage(igTabId, normalizedUser, timeoutMs = 15000, sender = null, payload = null, timingTracker = null) {
  const targetReelsUrl = `https://www.instagram.com/${normalizedUser}/reels/`;
  logTabOp('waitForReelsPage:start', normalizedUser, igTabId, targetReelsUrl);

  // Bounded polling for Reel anchors to ensure the grid has rendered
  let elapsed = 0;
  const interval = 500;
  let lastSnapshot = null;
  let routeToggleTriggered = false;

  let firstReelLogged = false;

  while (elapsed < timeoutMs) {
    // Check companion window state: pause countdown if minimized
    await handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, 'waitForReelsPage', igTabId, timingTracker);
    if (timingTracker && typeof timingTracker.getRemainingMs === 'function' && timingTracker.getRemainingMs() <= 0) {
      break;
    }

    const waited = await sleepBounded(interval, timingTracker);
    if (waited <= 0) break;
    elapsed += waited;

    try {
      const pageInfo = await injectScript(igTabId, (targetUser) => {
        const url = window.location.href;
        const urlLower = url.toLowerCase();
        const userLower = targetUser.toLowerCase();
        const visibilityState = document.visibilityState;
        const hidden = document.hidden;

        // STRICT: URL must actually be on the target user's reels page
        const isReels = urlLower.includes(`/${userLower}/reels`);
        const ready = document.readyState === 'complete' || document.readyState === 'interactive';
        function matchReelAnchor(a) {
          if (!a) return null;
          const rawHref = (a.getAttribute('href') || a.href || '').trim();
          if (!rawHref) return null;
          const href = rawHref.toLowerCase();

          if (
            href === '/reels/' || href === '/reels' || href.startsWith('/reels?') ||
            href === '/' || href === '/explore/' || href === '/direct/' ||
            href.startsWith('/stories/') || href.startsWith('/accounts/') ||
            href.startsWith('/about/') || href.startsWith('/legal/') ||
            (userLower && (
              href === `/${userLower}/reels/` || href === `/${userLower}/reels` ||
              href === `/${userLower}/` || href === `/${userLower}` ||
              href === `/${userLower}/tagged/` || href === `/${userLower}/tagged` ||
              href.endsWith(`/${userLower}/reels/`) || href.endsWith(`/${userLower}/reels`)
            ))
          ) {
            return null;
          }

          const reelMatch = rawHref.match(/(?:\/[^/]+)?\/reels?\/([A-Za-z0-9_-]+)/i);
          if (reelMatch && reelMatch[1]) {
            const sc = reelMatch[1];
            if (!['reels', 'videos', 'tagged', 'audio', 'explore', 'feed'].includes(sc.toLowerCase())) {
              return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: 'reel_path' };
            }
          }

          const postMatch = rawHref.match(/(?:\/[^/]+)?\/p\/([A-Za-z0-9_-]+)/i);
          if (postMatch && postMatch[1]) {
            const sc = postMatch[1];
            if (isReels) {
              return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: 'reels_tab_item' };
            }
            const hasVideo = !!a.querySelector('video');
            const hasReelSvg = !!a.querySelector('svg[aria-label*="Reel" i], svg[aria-label*="Clip" i], svg[aria-label*="Video" i], svg[aria-label*="Play" i]');
            const hasViewIcon = !!a.querySelector('svg[aria-label*="View count" i], svg[aria-label*="view count" i]');
            const t = (a.innerText || a.textContent || '').trim();
            const hasViewText = /\b\d[\d,.]*\s*[kmbKMB]?(?:\s*(?:views?|plays?))\b/i.test(t);

            if (hasVideo || hasReelSvg || hasViewIcon || hasViewText) {
              return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: hasReelSvg ? 'svg_indicator' : hasVideo ? 'video_tag' : 'view_indicator' };
            }
          }
          return null;
        }

        const allDocAnchors = Array.from(document.querySelectorAll('a[href]'));
        const matchedReelAnchors = allDocAnchors.filter(a => matchReelAnchor(a) !== null);
        const reelCount = matchedReelAnchors.length;
        const postCount = document.querySelectorAll('a[href*="/p/"]').length;
        const mediaCount = document.querySelectorAll('img, video').length;
        const gridElementCount = document.querySelectorAll('article, main, div[role="main"]').length;

        const mainEl = document.querySelector('main');
        const mainText = (mainEl ? mainEl.innerText : (document.body ? document.body.innerText : '') || '').toLowerCase();
        const text = document.body ? document.body.innerText.toLowerCase() : '';
        const hasProfileHeader = !!document.querySelector('header a[href*="/followers/"], main div[role="tablist"], div[role="tablist"]');
        const isUnavailable =
          isReels &&
          ready &&
          reelCount === 0 &&
          !hasProfileHeader &&
          (mainText.includes("sorry, this page isn't available") ||
           mainText.includes("profile isn't available") ||
           mainText.includes("the link you followed may be broken") ||
           mainText.includes("page not found"));
        const isPrivate = isReels && mainText.includes("this account is private");
        const isRestricted =
          mainText.includes("restricted profile") ||
          mainText.includes("confirm your age") ||
          mainText.includes("content isn't available in your region") ||
          mainText.includes("age-restricted");
        const isLoginWall = text.includes("log in to instagram") || text.includes("sign up to see photos") ||
                            text.includes("log in or sign up") ||
                            !!document.querySelector('input[name="username"], input[name="password"]');
        const tablist = document.querySelector('main div[role="tablist"], div[role="tablist"], main nav');
        const hasTablist = !!tablist;
        const hasReelsTab = hasTablist && !!(
          tablist.querySelector('a[href*="/reels/"]') ||
          tablist.querySelector('a[role="tab"][href*="/reels/"]') ||
          Array.from(tablist.querySelectorAll('a[href]')).some(a => {
            const h = (a.getAttribute('href') || '').toLowerCase();
            return h.includes(`/${userLower}/reels`) || (h.endsWith('/reels/') && h !== '/reels/');
          })
        );
        const hasNoReelsMessage = (isReels || (hasTablist && !hasReelsTab)) && (
          mainText.includes("no reels yet") ||
          mainText.includes("no reels available") ||
          mainText.includes("when you share reels") ||
          mainText.includes("no reels") ||
          mainText.includes("no videos yet") ||
          mainText.includes("no posts yet") ||
          mainText.includes("capture and share moments")
        );
        const isLoadingSpinner = !!document.querySelector('svg[aria-label="Loading..."], div[role="progressbar"], div[aria-label="Loading..."]');
        const noReelsConfirmed = (hasTablist && !hasReelsTab && ready) || (hasNoReelsMessage && !isLoadingSpinner);

        return {
          url,
          isReels,
          ready,
          reelCount,
          postCount,
          mediaCount,
          gridElementCount,
          isUnavailable,
          isPrivate,
          isLoginWall,
          hasNoReelsMessage,
          noReelsConfirmed,
          isLoadingSpinner,
          visibilityState,
          hidden
        };
      }, [normalizedUser]);

      lastSnapshot = pageInfo;

      if (pageInfo?.isUnavailable) {
        throw new Error(`Instagram profile @${normalizedUser} was not found or is unavailable.`);
      }

      if (pageInfo?.isPrivate) {
        throw new Error(`Instagram profile @${normalizedUser} is private.`);
      }

      if (pageInfo?.isRestricted) {
        throw new Error(`Instagram profile @${normalizedUser} is age/region restricted or blocked.`);
      }

      if (pageInfo?.isLoginWall) {
        throw new Error(`Instagram session login required. Encountered login wall for @${normalizedUser}.`);
      }

      // ONLY return success if page is ACTUALLY on target user's reels page!
      if (pageInfo && pageInfo.ready && pageInfo.isReels) {
        if (pageInfo.reelCount > 0) {
          if (!firstReelLogged) {
            firstReelLogged = true;
            logBoundedDiag('first_reel_anchor', normalizedUser, {
              elapsedMs: elapsed,
              reelCount: pageInfo.reelCount,
              docVisibility: pageInfo.visibilityState
            });
          }
          console.log(`[waitForReelsPage] Reels grid rendered for @${normalizedUser} with ${pageInfo.reelCount} reel anchors after ${elapsed}ms.`);
          return { ...pageInfo, elapsed, timedOut: false };
        }

        if (pageInfo.noReelsConfirmed && elapsed >= 2500 && !pageInfo.isLoadingSpinner) {
          console.log(`[waitForReelsPage] Profile @${normalizedUser} explicitly has no reels.`);
          return { ...pageInfo, elapsed, timedOut: false, noReelsConfirmed: true };
        }
      }

      // SAFE IN-PAGE ACTIVATION (ONE-SHOT ONLY):
      // In Instagram SPA, if after 3500ms undisturbed wait no reels have appeared and not confirmed empty,
      // routeToggleTriggered ensures this is strictly attempted ONCE and NEVER spams clicks or aborts in-flight GraphQL queries.
      if (!routeToggleTriggered && elapsed >= 3500 && pageInfo && pageInfo.reelCount === 0 && !pageInfo.noReelsConfirmed) {
        routeToggleTriggered = true;
        try {
          await injectScript(igTabId, (targetUser) => {
            const userLower = targetUser.toLowerCase();
            const tablist = document.querySelector('main div[role="tablist"], div[role="tablist"], main nav');
            const allTabs = Array.from(document.querySelectorAll('a[href]'));
            const profileReelsTab =
              (tablist && (
                tablist.querySelector('a[href*="/reels/"]') ||
                tablist.querySelector('a[role="tab"][href*="/reels/"]') ||
                Array.from(tablist.querySelectorAll('a[href]')).find(a => {
                  const h = (a.getAttribute('href') || '').toLowerCase();
                  return (h.includes(`/${userLower}/reels`) || h.endsWith('/reels/')) &&
                         !h.endsWith('.com/reels/') && h !== '/reels/' && !h.startsWith('/reels?');
                })
              )) ||
              allTabs.find(a => {
                const h = (a.getAttribute('href') || '').toLowerCase();
                return (h.includes(`/${userLower}/reels`) || h.endsWith('/reels/')) &&
                       !h.endsWith('.com/reels/') && h !== '/reels/' && !h.startsWith('/reels?');
              });

            if (profileReelsTab) {
              ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
                profileReelsTab.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
              });
              profileReelsTab.click();
            }
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new Event('scroll'));
          }, [normalizedUser]);
        } catch (e) {
          if (isTabInvalidError(e)) {
            throw e;
          }
        }
      }

      // Trigger scroll after 2000ms to awaken virtualized grid/intersection observers past the profile header
      if (elapsed >= 2000 && elapsed % 2000 === 0 && pageInfo && pageInfo.reelCount === 0) {
        try {
          await injectScript(igTabId, () => {
            window.scrollBy(0, 450);
            window.scrollBy(0, -50);
            window.dispatchEvent(new Event('scroll', { bubbles: true }));
            window.dispatchEvent(new Event('resize', { bubbles: true }));
          });
        } catch (e) {
          if (isTabInvalidError(e)) {
            throw e;
          }
        }
      }

    } catch (err) {
      if (isTabInvalidError(err)) {
        logTabOp('waitForReelsPage:tab_invalid', normalizedUser, igTabId, targetReelsUrl, err.message);
        throw new Error(`TAB_CLOSED_OR_INVALID: Instagram tab (${igTabId}) was closed or disconnected while waiting for Reels page: ${err.message}`);
      }
      if (err.message && (
        err.message.includes("Instagram profile") ||
        err.message.includes("Instagram session") ||
        err.message.includes("private")
      )) {
        throw err;
      }
      // Tab may be reloading or transitioning, continue polling
    }
  }

  // Bounded wait expired
  console.warn(`[waitForReelsPage] Bounded wait (${timeoutMs}ms) expired for @${normalizedUser}. Last snapshot:`, lastSnapshot);
  return {
    url: lastSnapshot?.url || targetReelsUrl,
    readyState: lastSnapshot?.ready ? 'complete' : 'timeout',
    reelCount: lastSnapshot?.reelCount || 0,
    postCount: lastSnapshot?.postCount || 0,
    mediaCount: lastSnapshot?.mediaCount || 0,
    gridElementCount: lastSnapshot?.gridElementCount || 0,
    elapsed,
    timedOut: true
  };
}

function formatScrollDiagSummary(diag, label = 'ScrollDiag') {
  if (!diag || typeof diag !== 'object') return '';
  return `[${label}: exit=${diag.exitReason}, elapsed=${diag.elapsedMs}ms, paused=${diag.pausedMs || 0}ms(min=${diag.minimizedPausedMs || 0}ms,occ=${diag.occlusionPausedMs || 0}ms,preStall=${diag.prePauseStallExcludedMs || 0}ms,resumes=${diag.resumeCount || 0}), rounds=${diag.scrollRounds}, stable=${diag.stableRounds}, zero=${diag.zeroRounds}, grace=${diag.loadingGraceRounds}, discovered=${diag.totalDiscovered}, validViews=${diag.validViews}, spinner=${diag.lastLoadingIndicator}, vis=${diag.docVisibility}, win=${diag.winState}(focused=${diag.winFocused})]`;
}

function createProfileTimingTracker(startTs, payload = null) {
  const PROFILE_ACTIVE_DEADLINE_MS =
    typeof payload?.profileActiveDeadlineMs === 'number' && payload.profileActiveDeadlineMs > 0
      ? payload.profileActiveDeadlineMs
      : 95000;
  return {
    startTs,
    pausedMs: 0,
    minimizedPausedMs: 0,
    occlusionPausedMs: 0,
    prePauseStallExcludedMs: 0,
    minimizedPauseCount: 0,
    occlusionPauseCount: 0,
    resumeCount: 0,
    lastPauseReason: null,
    pauseEvents: [],
    deadlineMs: PROFILE_ACTIVE_DEADLINE_MS,
    getActiveElapsedMs() {
      return Math.max(0, (Date.now() - this.startTs) - this.pausedMs);
    },
    getRemainingMs() {
      return Math.max(0, this.deadlineMs - this.getActiveElapsedMs());
    }
  };
}

async function executeProfileResearchOnTab(payload, sender, normalizedUser, startTs, forceNewTab = false, researchContext = null) {
  const { jobId, influencerCode, username } = payload;
  const targetReelsUrl = `https://www.instagram.com/${normalizedUser}/reels/`;

  // Use shared profileTiming from researchContext (preserving active time & pausedMs across tab recovery retries)
  const profileTiming = researchContext?.profileTiming || createProfileTimingTracker(startTs, payload);
  if (researchContext && !researchContext.profileTiming) {
    researchContext.profileTiming = profileTiming;
  }

  // 0. Check companion window state before starting research on profile: pause safely if minimized
  await handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, 'profile_start', null, profileTiming);

  // 1. Acquire a verified, live Instagram tab (or create one if none exists)
  const selectedTab = await acquireOrCreateInstagramTab(normalizedUser, 'startProfileResearch', forceNewTab);
  let igTabId = selectedTab.id;

  // 2. Navigate to target reels URL and update igTabId from Chrome's callback
  sendEventToSender(sender, 'PROFILE_VERIFYING', payload);
  let currentUrl = '';
  try {
    logTabOp('startProfileResearch:check_current_url', normalizedUser, igTabId, selectedTab.url);
    currentUrl = await injectScript(igTabId, () => window.location.href);
  } catch (e) {
    if (isTabInvalidError(e)) {
      const recoveredTab = await acquireOrCreateInstagramTab(normalizedUser, 'startProfileResearch:url_check_recover', true);
      igTabId = recoveredTab.id;
      currentUrl = recoveredTab.url || '';
    } else {
      currentUrl = selectedTab.url || '';
    }
  }

  const alreadyOnReels = (currentUrl || '').toLowerCase().includes(`/${normalizedUser.toLowerCase()}/reels`);
  if (!alreadyOnReels) {
    igTabId = await updateInstagramTabUrl(igTabId, targetReelsUrl, normalizedUser, 'startProfileResearch:initial_nav');
    // Give browser up to 1200ms (clamped to remaining profile budget) to begin loading the new profile
    await sleepBounded(1200, profileTiming);
  } else {
    // If already on Reels route, scroll to top so profile header and stats are mounted in the DOM
    try {
      await injectScript(igTabId, () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await sleepBounded(400, profileTiming);
    } catch (e) {}
  }

  // 3. Verify profile and extract followers directly on the reels page
  let followerDisplay = null;
  let followerExtractionDiag = null;
  try {
    const verifyTimeoutMs = Math.min(15000, profileTiming.getRemainingMs());
    followerDisplay = await verifyProfile(igTabId, normalizedUser, verifyTimeoutMs, sender, payload, profileTiming);
  } catch (verifyErr) {
    if (isTabInvalidError(verifyErr) || String(verifyErr?.message || '').includes('COMPANION_WINDOW_CLOSED')) {
      throw verifyErr;
    }
    console.warn(`[startProfileResearch] verifyProfile had issue for @${normalizedUser}:`, verifyErr.message);
    if (verifyErr.message.includes("could not be verified") || verifyErr.message.includes("private")) {
      throw verifyErr;
    }
    followerExtractionDiag = {
      attempted: true,
      error: verifyErr.message
    };
  }

  // Safe bounded retry for follower extraction when page was already open/scrolled
  if (!followerDisplay && profileTiming.getRemainingMs() >= 2000) {
    try {
      await injectScript(igTabId, () => {
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await sleepBounded(800, profileTiming);
      const retryVerifyTimeoutMs = Math.min(4000, profileTiming.getRemainingMs());
      if (retryVerifyTimeoutMs > 0) {
        followerDisplay = await verifyProfile(igTabId, normalizedUser, retryVerifyTimeoutMs, sender, payload, profileTiming);
      }
      if (followerDisplay) {
        logTabOp('verifyProfile:retry_success', normalizedUser, igTabId, null, `Extracted followers on retry: ${followerDisplay}`);
      }
    } catch (retryErr) {
      if (isTabInvalidError(retryErr) || String(retryErr?.message || '').includes('COMPANION_WINDOW_CLOSED')) throw retryErr;
      followerExtractionDiag = {
        attempted: true,
        error: retryErr.message
      };
    }
  }

  sendEventToSender(sender, 'PROFILE_DATA_FOUND', payload);

  // 4. Milestone 2: Reel Discovery with bounded wait (strictly clamped to remaining active budget)
  sendEventToSender(sender, 'REELS_PAGE_OPENING', payload);
  const initialWaitTimeoutMs = Math.min(15000, profileTiming.getRemainingMs());
  let pageState = await waitForReelsPage(igTabId, normalizedUser, initialWaitTimeoutMs, sender, payload, profileTiming);

  // Exact moment extraction begins: log and verify DOM evidence
  let extractionMoment = {
    actualUrl: pageState.url,
    finalUrl: pageState.url,
    normalizedUser,
    navigationSuccess: (!pageState.timedOut || pageState.reelCount > 0) && pageState.url.toLowerCase().includes(`/${normalizedUser.toLowerCase()}/reels`),
    pageReadiness: pageState.ready ? 'complete' : (pageState.readyState || 'unknown'),
    reelAnchorsCount: pageState.reelCount || 0,
    postAnchorsCount: pageState.postCount || 0,
    mediaCount: pageState.mediaCount || 0,
    gridElementCount: pageState.gridElementCount || 0,
    timedOut: !!pageState.timedOut,
    elapsedMs: pageState.elapsed || 0
  };

  console.log(`[startProfileResearch] Extraction starting for @${normalizedUser} on tab ${igTabId}:`, extractionMoment);

  sendEventToSender(sender, 'REELS_LOADING', {
    ...payload,
    extractionMoment
  });

  const primaryPhaseTimeoutMs = Math.min(60000, profileTiming.getRemainingMs());
  let discovered = await scrollUntilEnoughReels(igTabId, sender, payload, {
    phaseTimeoutMs: primaryPhaseTimeoutMs,
    profileTiming,
    onScrollDiag: (diag) => {
      if (researchContext) researchContext.primaryScrollDiag = diag;
    }
  });
  const primaryScrollDiag = discovered.scrollDiag || null;
  let retryScrollDiag = null;
  let retrySkippedReason = null;
  if (researchContext) {
    researchContext.primaryScrollDiag = primaryScrollDiag;
  }

  let reelResults = processDiscoveredReels(discovered, sender, payload);

  // 5. Retry once ONLY if 0 reels were discovered, page was not confirmed empty, and sufficient active profile budget remains
  const MIN_RETRY_BUDGET_MS = 8000;
  if (reelResults.selectedReelCount === 0 && !pageState.noReelsConfirmed) {
    if (profileTiming.getRemainingMs() < MIN_RETRY_BUDGET_MS) {
      retrySkippedReason = `profile_deadline_reached (remaining=${profileTiming.getRemainingMs()}ms)`;
      if (researchContext) researchContext.retrySkippedReason = retrySkippedReason;
      console.warn(`[startProfileResearch] Skipping retry for @${normalizedUser}: remaining active budget (${profileTiming.getRemainingMs()}ms) is below ${MIN_RETRY_BUDGET_MS}ms.`);
    } else {
      console.warn(`[startProfileResearch] 0 reels found on first pass for @${normalizedUser} (remainingBudget=${profileTiming.getRemainingMs()}ms). Retrying via profile root -> Reels tab hydration...`);
      sendEventToSender(sender, 'RESEARCH_RETRYING', payload);

      // Navigate to profile root first so Instagram hydrates PolarisProfilePageContentQuery cleanly,
      // and check if reels are available directly on the main profile grid
      const profileRootUrl = `https://www.instagram.com/${normalizedUser}/`;
      igTabId = await updateInstagramTabUrl(igTabId, profileRootUrl, normalizedUser, 'startProfileResearch:retry_profile_root');
      await sleepBounded(2000, profileTiming);
      await handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, 'retry_profile_root', igTabId, profileTiming);

      // First check: Are reels discoverable directly on the main profile grid?
      const profileGridDiscovered = await discoverReelLinks(igTabId, normalizedUser);
      const profileGridResults = processDiscoveredReels(profileGridDiscovered, sender, payload);

      let preservedProfileFeedResults = null;
      let preservedProfileFeedDiscovered = null;
      if (profileGridResults.selectedReelCount > 0) {
        console.log(`[startProfileResearch] Found ${profileGridResults.selectedReelCount} Reel candidate(s) on profile root for @${normalizedUser}. Preserving as fallback while attempting /reels/ tab for view counts...`);
        preservedProfileFeedResults = profileGridResults;
        preservedProfileFeedDiscovered = profileGridDiscovered;
      }

      if (profileTiming.getRemainingMs() >= 3000) {
        // Attempt in-page SPA transition by clicking the profile's Reels tab
        let tabClicked = false;
        try {
          tabClicked = await injectScript(igTabId, (u) => {
            const userLower = u.toLowerCase();
            const tablist = document.querySelector('main div[role="tablist"], div[role="tablist"], main nav');
            const allTabs = Array.from(document.querySelectorAll('a[href]'));
            const reelsTab =
              (tablist && (
                tablist.querySelector('a[href*="/reels/"]') ||
                tablist.querySelector('a[role="tab"][href*="/reels/"]') ||
                Array.from(tablist.querySelectorAll('a[href]')).find(a => {
                  const h = (a.getAttribute('href') || '').toLowerCase();
                  return (h.includes(`/${userLower}/reels`) || h.endsWith('/reels/')) &&
                         !h.endsWith('.com/reels/') && h !== '/reels/' && !h.startsWith('/reels?');
                })
              )) ||
              allTabs.find(a => {
                const h = (a.getAttribute('href') || '').toLowerCase();
                return (h.includes(`/${userLower}/reels`) || h.endsWith('/reels/')) &&
                       !h.endsWith('.com/reels/') && h !== '/reels/' && !h.startsWith('/reels?');
              });
            if (reelsTab) {
              ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
                reelsTab.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window }));
              });
              reelsTab.click();
              window.dispatchEvent(new Event('resize'));
              window.dispatchEvent(new Event('scroll'));
              return true;
            }
            return false;
          }, [normalizedUser]);
        } catch (e) {}

        if (!tabClicked) {
          igTabId = await updateInstagramTabUrl(igTabId, targetReelsUrl, normalizedUser, 'startProfileResearch:retry_reels_nav');
          await sleepBounded(1200, profileTiming);
        } else {
          await sleepBounded(1500, profileTiming);
        }
        await handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, 'retry_reels_nav', igTabId, profileTiming);

        const retryWaitTimeoutMs = Math.min(12000, Math.floor(profileTiming.getRemainingMs() * 0.35));
        pageState = await waitForReelsPage(igTabId, normalizedUser, retryWaitTimeoutMs, sender, payload, profileTiming);
        extractionMoment = {
          actualUrl: pageState.url,
          finalUrl: pageState.url,
          normalizedUser,
          navigationSuccess: (!pageState.timedOut || pageState.reelCount > 0) && pageState.url.toLowerCase().includes(`/${normalizedUser.toLowerCase()}/reels`),
          pageReadiness: pageState.ready ? 'complete' : (pageState.readyState || 'unknown'),
          reelAnchorsCount: pageState.reelCount || 0,
          postAnchorsCount: pageState.postCount || 0,
          mediaCount: pageState.mediaCount || 0,
          gridElementCount: pageState.gridElementCount || 0,
          timedOut: !!pageState.timedOut,
          elapsedMs: pageState.elapsed || 0
        };

        const retryScrollTimeoutMs = Math.min(60000, profileTiming.getRemainingMs());
        const retryDiscovered = await scrollUntilEnoughReels(igTabId, sender, payload, {
          phaseTimeoutMs: retryScrollTimeoutMs,
          profileTiming,
          onScrollDiag: (diag) => {
            if (researchContext) researchContext.retryScrollDiag = diag;
          }
        });
        retryScrollDiag = retryDiscovered.scrollDiag || null;
        if (researchContext) researchContext.retryScrollDiag = retryScrollDiag;
        const retryResults = processDiscoveredReels(retryDiscovered, sender, payload);

        if (retryResults.selectedReelCount > 0) {
          if (preservedProfileFeedDiscovered && preservedProfileFeedDiscovered.length > 0) {
            // Merge preserved feed reels with retryResults from /reels/ tab without losing view badges
            const mergedMap = new Map();
            // Priority 1: retryResults from /reels/ tab (they may carry view badges)
            (retryDiscovered || []).forEach(r => {
              mergedMap.set(r.url, { ...r });
            });
            // Priority 2: preserved feed reels (if not already found on /reels/ tab)
            (preservedProfileFeedDiscovered || []).forEach(r => {
              if (!mergedMap.has(r.url)) {
                mergedMap.set(r.url, { ...r });
              } else {
                const existing = mergedMap.get(r.url);
                if (existing.viewCount === null && typeof r.viewCount === 'number') {
                  existing.viewCount = r.viewCount;
                  existing.rawViewText = r.rawViewText;
                  existing.viewIconLocation = r.viewIconLocation;
                  existing.viewIconFound = r.viewIconFound;
                }
              }
            });
            reelResults = processDiscoveredReels(Array.from(mergedMap.values()), sender, payload);
          } else {
            reelResults = retryResults;
          }
        } else if (preservedProfileFeedResults && preservedProfileFeedResults.selectedReelCount > 0) {
          console.log(`[startProfileResearch] /reels/ tab returned 0 reels for @${normalizedUser}; falling back to ${preservedProfileFeedResults.selectedReelCount} Reel candidates discovered on profile root.`);
          reelResults = preservedProfileFeedResults;
        }
      } else if (preservedProfileFeedResults && preservedProfileFeedResults.selectedReelCount > 0) {
        retrySkippedReason = `profile_deadline_reached_after_root_check (remaining=${profileTiming.getRemainingMs()}ms)`;
        if (researchContext) researchContext.retrySkippedReason = retrySkippedReason;
        reelResults = preservedProfileFeedResults;
      } else {
        retrySkippedReason = `profile_deadline_reached_after_root_check (remaining=${profileTiming.getRemainingMs()}ms)`;
        if (researchContext) researchContext.retrySkippedReason = retrySkippedReason;
      }
    }
  }

  // 6. Bounded Individual Reel-page metric fallback (only if grid extraction still misses counts and active budget remains)
  // Strictly bounded to at most 3 reels per profile to preserve speed and avoid repeated navigation
  const missingCountReels = (reelResults.selectedReels || []).filter(
    r => typeof r.viewCount !== 'number' && !r.isPinned
  );

  if (missingCountReels.length > 0 && reelResults.validViewCountsCount < 15 && profileTiming.getRemainingMs() >= 4500) {
    const MAX_FALLBACK_PER_PROFILE = 3;
    const reelsToInspect = missingCountReels.slice(0, MAX_FALLBACK_PER_PROFILE);
    console.log(`[startProfileResearch] Bounded individual Reel fallback: inspecting ${reelsToInspect.length} Reel(s) with missing view counts for @${normalizedUser}...`);

    let anyViewUpdated = false;
    for (const reel of reelsToInspect) {
      if (profileTiming.getRemainingMs() < 3500) {
        console.warn(`[startProfileResearch] Stopping individual Reel fallback early for @${normalizedUser}: remaining active budget (${profileTiming.getRemainingMs()}ms) is low.`);
        break;
      }
      try {
        await handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, 'reel_metric_fallback', igTabId, profileTiming);
        if (profileTiming.getRemainingMs() < 3500) break;
        logTabOp('reel_metric_fallback:nav', normalizedUser, igTabId, reel.reelUrl);
        igTabId = await updateInstagramTabUrl(igTabId, reel.reelUrl, normalizedUser, 'startProfileResearch:reel_metric_fallback');
        await sleepBounded(1800, profileTiming);
        await handleCompanionWindowPauseIfNeeded(normalizedUser, sender, payload, 'reel_metric_fallback:post_wait', igTabId, profileTiming);

        const extracted = await injectScript(igTabId, () => {
          function parseCount(raw) {
            if (!raw || typeof raw !== 'string') return null;
            const cleaned = raw.trim().replace(/\s+/g, ' ');
            if (!cleaned) return null;
            const stripped = cleaned.replace(/^(?:(?:plays?|views?)(?:\s*counts?)?)\s*[:\-–—]?\s*/i, '').trim();
            const match = stripped.match(/^([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?(?:\s*(?:views?|plays?))?$/i);
            const m = match || stripped.match(/\b([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?\s*(?:views?|plays?)\b/i);
            if (!m) return null;
            const normStr = m[1].replace(/,/g, '');
            if ((normStr.match(/\./g) || []).length > 1) return null;
            const base = parseFloat(normStr);
            if (isNaN(base) || base < 0) return null;
            if (base === 0) return 0;
            const mult = (m[2] || '').toLowerCase();
            if (mult === 'k' || mult === 'thousand') return Math.round(base * 1000);
            if (mult === 'm' || mult === 'million') return Math.round(base * 1000000);
            if (mult === 'b' || mult === 'billion') return Math.round(base * 1000000000);
            if (mult === 'lakh' || mult === 'lakhs') return Math.round(base * 100000);
            if (mult === 'crore' || mult === 'crores') return Math.round(base * 10000000);
            if (!mult) return Math.round(base);
            return null;
          }

          let view = null;
          let raw = null;

          // Strategy A: Check accessibility labels on buttons, spans, or SVGs
          const ariaNodes = Array.from(document.querySelectorAll('[aria-label*="view" i], [aria-label*="play" i]'));
          for (const el of ariaNodes) {
            const val = el.getAttribute('aria-label');
            const c = parseCount(val);
            if (c !== null) { view = c; raw = val; break; }
          }

          // Strategy B: Check visible text nodes in player sidebar/details
          if (view === null) {
            const candidates = Array.from(document.querySelectorAll('span, [role="button"]'));
            for (const el of candidates) {
              if (el.children.length > 2) continue;
              const t = (el.innerText || el.textContent || '').trim();
              if (/\b(?:views?|plays?)\b/i.test(t)) {
                const c = parseCount(t);
                if (c !== null) { view = c; raw = t; break; }
              }
            }
          }

          // Strategy C: Check page meta description
          if (view === null) {
            const ogDesc = document.querySelector('meta[property="og:description"]')?.content ||
                           document.querySelector('meta[name="description"]')?.content || '';
            const m = ogDesc.match(/\b([\d,.]+\s*(?:[kmbKMB]|thousand|million|billion|lakhs?|crores?)?\s*(?:views?|plays?))\b/i);
            if (m) {
              const c = parseCount(m[1]);
              if (c !== null) { view = c; raw = m[1]; }
            }
          }

          return { view, raw };
        });

        if (extracted && typeof extracted.view === 'number') {
          reel.viewCount = extracted.view;
          reel.rawViewText = extracted.raw;
          reel.viewIconLocation = 'reel_page_fallback';
          anyViewUpdated = true;
          logTabOp('reel_metric_fallback:success', normalizedUser, igTabId, reel.reelUrl, `View count: ${extracted.view}`);
        }
      } catch (fbErr) {
        if (isTabInvalidError(fbErr) || String(fbErr?.message || '').includes('COMPANION_WINDOW_CLOSED')) throw fbErr;
        console.warn(`[startProfileResearch] Metric fallback issue for ${reel.reelUrl}:`, fbErr.message);
      }
    }

    // Always restore companion tab safely back to targetReelsUrl
    try {
      igTabId = await updateInstagramTabUrl(igTabId, targetReelsUrl, normalizedUser, 'startProfileResearch:return_from_fallback');
      await sleepBounded(1200, profileTiming);
    } catch (e) {}

    // If any view counts were updated, re-process metrics
    if (anyViewUpdated) {
      const allDiscovered = (reelResults.selectedReels || []).map(r => ({
        url: r.reelUrl,
        isPinned: r.isPinned,
        viewCount: r.viewCount,
        rawViewText: r.rawViewText,
        viewIconLocation: r.viewIconLocation
      }));
      reelResults = processDiscoveredReels(allDiscovered, sender, payload);
    }
  }

  const diagSummaryParts = [
    formatScrollDiagSummary(primaryScrollDiag, 'ScrollDiag'),
    retryScrollDiag ? formatScrollDiagSummary(retryScrollDiag, 'RetryScrollDiag') : '',
    retrySkippedReason ? `[RetrySkipped: ${retrySkippedReason}]` : ''
  ].filter(Boolean);
  const diagSuffix = diagSummaryParts.length > 0 ? ` ${diagSummaryParts.join(' ')}` : '';

  extractionMoment = {
    ...extractionMoment,
    scrollDiag: primaryScrollDiag,
    retryScrollDiag: retryScrollDiag || undefined,
    retrySkippedReason: retrySkippedReason || undefined,
    activeElapsedMs: profileTiming.getActiveElapsedMs(),
    pausedDurationMs: profileTiming.pausedMs
  };

  // Stage determination and failure classification
  let finalStatus = 'completed';
  let failureStage = null;
  let failureReason = null;

  if (reelResults.selectedReelCount === 0) {
    finalStatus = 'reels_not_found';
    if (pageState.noReelsConfirmed) {
      failureStage = 'no_reels';
      failureReason = `Profile @${normalizedUser} has no reels posted.${diagSuffix}`;
    } else if (reelResults.reelsDiscovered === 0) {
      failureStage = 'zero_reels';
      failureReason = `Zero Reel anchors (a[href*="/reel/"]) were discovered on ${targetReelsUrl}. (Page readiness: ${extractionMoment.pageReadiness}, Posts: ${extractionMoment.postAnchorsCount}, Media: ${extractionMoment.mediaCount}, Grid elements: ${extractionMoment.gridElementCount}, Wait: ${extractionMoment.elapsedMs}ms)${diagSuffix}`;
    } else {
      failureStage = 'all_pinned';
      failureReason = `Discovered ${reelResults.reelsDiscovered} reels, but all ${reelResults.pinnedReelsExcluded} were pinned posts.${diagSuffix}`;
    }
  } else if (reelResults.validViewCountsCount < 15) {
    finalStatus = 'partial';
    const failedAnchors = (reelResults.selectedReels || []).filter(r => typeof r.viewCount !== 'number');
    if (failedAnchors.length > 0) {
      failureStage = 'partial_view_extraction';
      const failedDetails = failedAnchors
        .map(f => `${f.reelUrl} (${f.viewIconLocation || 'no_icon'}${f.missingDiag?.anchorText ? `: "${f.missingDiag.anchorText}"` : ''})`)
        .join(', ');
      failureReason = `Collected ${reelResults.validViewCountsCount}/15 valid view counts from ${reelResults.selectedReelCount} non-pinned Reels (${reelResults.pinnedReelsExcluded} pinned excluded). ${failedAnchors.length} discovered Reel anchor(s) failed view-count extraction: ${failedDetails}.${diagSuffix}`;
    } else {
      failureStage = 'partial_reel_discovery';
      failureReason = `Collected ${reelResults.validViewCountsCount}/15 valid view counts: all ${reelResults.selectedReelCount} discovered non-pinned Reels had valid view counts (${reelResults.pinnedReelsExcluded} pinned excluded; 0 failed view-count extraction; only ${reelResults.selectedReelCount} non-pinned Reels were available on the profile).${diagSuffix}`;
    }
  }

  return {
    jobId,
    influencerCode,
    requestedUsername: username,
    verifiedUsername: normalizedUser,
    finalUrl: extractionMoment.actualUrl,
    navigationSuccess: extractionMoment.navigationSuccess,
    pageReadiness: extractionMoment.pageReadiness,
    reelAnchorsAtStart: extractionMoment.reelAnchorsCount,
    followerDisplay: followerDisplay || null,
    followerCount: followerDisplay ? parseViews(followerDisplay) : 0,
    followerExtractionDiag: followerExtractionDiag || undefined,
    ...reelResults,
    scrollDiag: primaryScrollDiag,
    retryScrollDiag: retryScrollDiag || undefined,
    retrySkippedReason: retrySkippedReason || undefined,
    activeElapsedMs: profileTiming.getActiveElapsedMs(),
    pausedDurationMs: profileTiming.pausedMs,
    status: finalStatus,
    failureStage,
    failureReason,
    error: failureReason || undefined,
    extractionMoment,
    startedAt: startTs,
    completedAt: Date.now()
  };
}

async function startProfileResearch(payload, sender) {
  const { jobId, influencerCode, username } = payload || {};
  const normalizedUser = normalizeUsername(username);
  const startTs = Date.now();
  const targetReelsUrl = normalizedUser ? `https://www.instagram.com/${normalizedUser}/reels/` : '';

  if (!normalizedUser) throw new Error('Invalid or missing username');

  const researchContext = {
    profileTiming: createProfileTimingTracker(startTs, payload),
    primaryScrollDiag: null,
    retryScrollDiag: null,
    retrySkippedReason: null
  };

  const buildFailedResult = (pageReadiness, failureStage, baseReason, finalUrl = targetReelsUrl) => {
    const diagParts = [
      formatScrollDiagSummary(researchContext.primaryScrollDiag, 'ScrollDiag'),
      researchContext.retryScrollDiag ? formatScrollDiagSummary(researchContext.retryScrollDiag, 'RetryScrollDiag') : '',
      researchContext.retrySkippedReason ? `[RetrySkipped: ${researchContext.retrySkippedReason}]` : ''
    ].filter(Boolean);
    const fullReason = diagParts.length > 0 ? `${baseReason} ${diagParts.join(' ')}` : baseReason;
    return {
      jobId,
      influencerCode,
      requestedUsername: username,
      verifiedUsername: normalizedUser,
      finalUrl,
      navigationSuccess: false,
      pageReadiness,
      reelAnchorsAtStart: 0,
      followerDisplay: null,
      followerCount: 0,
      reelsDiscovered: 0,
      pinnedReelsExcluded: 0,
      selectedReelCount: 0,
      selectedReels: [],
      validViewCountsCount: 0,
      averageViews: 0,
      rawViewCounts: [],
      missingViewCountsCount: 15,
      scrollDiag: researchContext.primaryScrollDiag,
      retryScrollDiag: researchContext.retryScrollDiag || undefined,
      retrySkippedReason: researchContext.retrySkippedReason || undefined,
      activeElapsedMs: researchContext.profileTiming.getActiveElapsedMs(),
      pausedDurationMs: researchContext.profileTiming.pausedMs,
      status: 'failed',
      failureStage,
      failureReason: fullReason,
      error: fullReason,
      startedAt: startTs,
      completedAt: Date.now()
    };
  };

  if (companionWindowClosedByUser) {
    const closedReason = 'Instagram research companion window was closed. Please keep the companion window open during batch research.';
    logBoundedDiag('research_failed_window_closed_early', normalizedUser, { error: closedReason });
    return buildFailedResult('companion_window_closed', 'companion_window_closed', closedReason);
  }

  sendEventToSender(sender, 'PROFILE_OPENING', payload);

  try {
    return await executeProfileResearchOnTab(payload, sender, normalizedUser, startTs, false, researchContext);
  } catch (err) {
    if (err && String(err.message || '').includes('COMPANION_WINDOW_CLOSED')) {
      const closedReason = 'Instagram research companion window was closed. Please keep the companion window open during batch research.';
      logBoundedDiag('research_failed_window_closed', normalizedUser, { error: closedReason });
      return buildFailedResult('companion_window_closed', 'companion_window_closed', closedReason);
    }

    if (err && (String(err.message || '').includes('COMPANION_WINDOW_MINIMIZED_TIMEOUT') || String(err.message || '').includes('COMPANION_WINDOW_INACTIVITY_TIMEOUT'))) {
      const timeoutReason = 'Instagram research companion window was inactive for an extended period. Please keep the companion window open during batch research.';
      logBoundedDiag('research_failed_window_inactive_timeout', normalizedUser, { error: timeoutReason });
      return buildFailedResult('companion_window_inactive_timeout', 'companion_window_inactive_timeout', timeoutReason);
    }

    if (err && String(err.message || '').includes('COMPANION_WINDOW_CREATION_FAILED')) {
      const creationReason = String(err.message);
      logBoundedDiag('research_failed_creation', normalizedUser, { error: creationReason });
      return buildFailedResult('companion_window_creation_failed', 'companion_window_creation_failed', creationReason);
    }

    if (isTabInvalidError(err) && researchContext.profileTiming.getRemainingMs() >= 8000) {
      logTabOp('startProfileResearch:tab_recovery_retry', normalizedUser, lastUsedIgTabId, null, `Recovering from invalid tab error: ${err.message}`);
      lastUsedIgTabId = null;
      sendEventToSender(sender, 'RESEARCH_RETRYING', payload);
      return await executeProfileResearchOnTab(payload, sender, normalizedUser, startTs, true, researchContext);
    }

    // If navigation was rejected even after updateInstagramTabUrl's 1 safe retry,
    // return a structured failed ProfileResearchResult with full diagnostics so the batch continues cleanly
    // without misclassifying the username as invalid.
    const isNavErr = !!(err && (err.isNavigationError || String(err.message || '').toLowerCase().includes('navigation rejected')));
    if (isNavErr) {
      const diag = err.navigationDiag || {
        stage: 'navigation_rejected',
        requestedUrl: targetReelsUrl,
        tabId: lastUsedIgTabId,
        currentTabUrl: 'unknown',
        originalChromeError: err.message || 'Navigation rejected.'
      };
      const detailedReason =
        `Navigation failed after 1 safe retry at stage "${diag.stage}". ` +
        `Requested URL: ${diag.requestedUrl} | Current Tab ID: ${diag.tabId ?? 'none'} | ` +
        `Current Tab URL: ${diag.currentTabUrl || 'unknown'} | Original Chrome Error: ${diag.originalChromeError}`;
      console.error(`[startProfileResearch] ${detailedReason}`);

      const resolvedUrl = diag.currentTabUrl && diag.currentTabUrl !== 'unknown' ? diag.currentTabUrl : targetReelsUrl;
      return buildFailedResult('navigation_rejected', diag.stage || 'navigation_rejected', detailedReason, resolvedUrl);
    }

    throw err;
  } finally {
    scheduleBatchCompletionCheck();
  }
}

function parseViews(text) {
  if (!text) return 0;
  text = String(text).toLowerCase().replace(/,/g, '').trim();
  if (text.includes('b')) return parseInt(parseFloat(text.replace('b', '')) * 1000000000);
  if (text.includes('m')) return parseInt(parseFloat(text.replace('m', '')) * 1000000);
  if (text.includes('k')) return parseInt(parseFloat(text.replace('k', '')) * 1000);
  const val = parseInt(text);
  return isNaN(val) ? 0 : val;
}

async function runReelDiagnostic(payload, sender) {
  const { username } = payload || {};
  const normalizedUser = normalizeUsername(username);

  if (!normalizedUser) {
    return {
      success: false,
      stage: 'communication_failure',
      message: 'Invalid or missing Instagram username for diagnostic.',
      error: 'MISSING_USERNAME'
    };
  }

  // 1. Acquire or create a verified Instagram Tab
  let selectedTab;
  try {
    selectedTab = await acquireOrCreateInstagramTab(normalizedUser, 'runReelDiagnostic');
  } catch (err) {
    return {
      success: false,
      stage: 'communication_failure',
      message: err.message || 'No open Instagram tab found. Please open an Instagram tab first.',
      error: 'TAB_NOT_FOUND'
    };
  }
  let igTabId = selectedTab.id;

  // 2. Minimal diagnostic handshake (PING -> PONG) via script injection
  let pingResult;
  try {
    pingResult = await injectScript(igTabId, () => {
      return {
        pong: true,
        url: window.location.href,
        readyState: document.readyState,
        title: document.title
      };
    });
  } catch (err) {
    return {
      success: false,
      stage: 'communication_failure',
      tabId: igTabId,
      message: `Failed to communicate with Instagram tab (${igTabId}): ${err.message}`,
      error: err.message
    };
  }

  if (!pingResult || !pingResult.pong) {
    return {
      success: false,
      stage: 'communication_failure',
      tabId: igTabId,
      message: `Instagram tab (${igTabId}) did not respond with PONG.`,
      error: 'NO_PONG_RECEIVED'
    };
  }

  // 3. Navigation Completion Verification
  const targetReelsUrl = `https://www.instagram.com/${normalizedUser}/reels/`;
  const isAlreadyOnPage = (pingResult.url || '').startsWith(targetReelsUrl);

  if (!isAlreadyOnPage) {
    try {
      igTabId = await updateInstagramTabUrl(igTabId, targetReelsUrl, normalizedUser, 'runReelDiagnostic:nav');
    } catch (err) {
      return {
        success: false,
        stage: 'navigation_failure',
        tabId: igTabId,
        targetUrl: targetReelsUrl,
        actualUrl: pingResult.url,
        readyState: pingResult.readyState,
        message: `Failed to trigger navigation to ${targetReelsUrl}: ${err.message}`,
        error: err.message
      };
    }
  }

  // Poll for navigation completion: document.readyState, URL match, and body content
  let navSuccess = false;
  let navState = null;
  const maxWaitMs = 15000;
  const intervalMs = 600;
  let elapsed = 0;

  while (elapsed < maxWaitMs) {
    await new Promise(r => setTimeout(r, intervalMs));
    elapsed += intervalMs;

    try {
      navState = await injectScript(igTabId, () => {
        const url = window.location.href;
        const urlLower = url.toLowerCase();
        const isTargetUrl = urlLower.includes(`/${normalizedUser.toLowerCase()}`);
        const mainEl = document.querySelector('main');
        const mainText = (mainEl ? mainEl.innerText : (document.body ? document.body.innerText : '') || '').toLowerCase();
        const hasProfileHeader = !!document.querySelector('header a[href*="/followers/"], main div[role="tablist"]');
        const isUnavailable =
          isTargetUrl &&
          !hasProfileHeader &&
          (mainText.includes("sorry, this page isn't available") ||
           mainText.includes("profile isn't available") ||
           mainText.includes("the link you followed may be broken") ||
           mainText.includes("page not found"));
        const isLoginWall = !!document.querySelector('input[name="username"], input[name="password"]');

        return {
          url,
          readyState: document.readyState,
          title: document.title,
          isUnavailable,
          isLoginWall,
          hasBody: !!document.body && document.body.innerHTML.length > 200
        };
      }, [normalizedUser]);

      if (navState) {
        if (navState.isUnavailable || navState.isLoginWall) {
          break; // Terminal condition
        }
        if (
          (navState.readyState === 'complete' || navState.readyState === 'interactive') &&
          navState.url.toLowerCase().includes(normalizedUser.toLowerCase()) &&
          navState.hasBody
        ) {
          navSuccess = true;
          break;
        }
      }
    } catch (err) {
      // Tab may be reloading, continue waiting
    }
  }

  if (!navSuccess) {
    const errorReason = navState?.isUnavailable
      ? `Instagram profile @${normalizedUser} was not found (404/Unavailable).`
      : navState?.isLoginWall
        ? `Instagram redirected to login wall. Session login required.`
        : `Navigation timeout after 15s waiting for ${targetReelsUrl} to load.`;

    return {
      success: false,
      stage: 'navigation_failure',
      tabId: igTabId,
      targetUrl: targetReelsUrl,
      actualUrl: navState?.url || pingResult.url,
      readyState: navState?.readyState || 'unknown',
      requestedUsername: normalizedUser,
      message: errorReason,
      error: navState?.isUnavailable ? 'PAGE_NOT_FOUND' : navState?.isLoginWall ? 'LOGIN_WALL' : 'NAVIGATION_TIMEOUT'
    };
  }

  // 4. Passive DOM Snapshot using selector: a[href*="/reel/"]
  async function takeSnapshot() {
    return await injectScript(igTabId, (targetUser) => {
      function parseView(rawText) {
        if (!rawText || typeof rawText !== 'string') return null;
        const cleaned = rawText.trim().replace(/\s+/g, ' ');
        if (!cleaned) return null;

        const stripped = cleaned.replace(/^(?:(?:plays?|views?)(?:\s*counts?)?)\s*[:\-–—]?\s*/i, '').trim();
        const match = stripped.match(/^([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?(?:\s*(?:views?|plays?))?$/i);
        const m = match || stripped.match(/\b([\d,.]+)\s*(k|m|b|thousand|million|billion|lakhs?|crores?)?\s*(?:views?|plays?)\b/i);
        if (!m) return null;

        const numPart = m[1].replace(/,/g, '');
        if ((numPart.match(/\./g) || []).length > 1) return null;
        const base = parseFloat(numPart);
        if (isNaN(base) || base < 0) return null;
        if (base === 0) return 0;

        const mult = (m[2] || '').toLowerCase();
        if (mult === 'k' || mult === 'thousand') return Math.round(base * 1000);
        if (mult === 'm' || mult === 'million') return Math.round(base * 1000000);
        if (mult === 'b' || mult === 'billion') return Math.round(base * 1000000000);
        if (mult === 'lakh' || mult === 'lakhs') return Math.round(base * 100000);
        if (mult === 'crore' || mult === 'crores') return Math.round(base * 10000000);
        if (!mult) return Math.round(base);
        return null;
      }

      function getTileContainer(a) {
        let tileContainer = a;
        let curr = a.parentElement;
        while (curr && curr !== document.body && curr.tagName !== 'MAIN') {
          const reelsInParent = curr.querySelectorAll('a[href*="/reel/"], a[href*="/p/"]');
          if (reelsInParent.length > 1) {
            break;
          }
          tileContainer = curr;
          curr = curr.parentElement;
        }
        return tileContainer;
      }

      function extractView(a) {
        const tileContainer = getTileContainer(a);

        // 1. Check pinned status on anchor and tileContainer
        const pinnedEl = tileContainer.querySelector('svg[aria-label*="Pinned" i], [aria-label*="Pinned" i]');
        if (pinnedEl) {
          return { rawText: null, count: null, location: 'pinned_skipped', isPinned: true, viewIconFound: false };
        }

        // 2. Check aria-labels & title on anchor and tileContainer
        const ariaCandidates = [
          a.getAttribute('aria-label'),
          a.getAttribute('title'),
          tileContainer.getAttribute('aria-label'),
          tileContainer.getAttribute('title')
        ];
        Array.from(tileContainer.querySelectorAll('[aria-label*="view" i], [aria-label*="play" i]')).forEach(el => {
          ariaCandidates.push(el.getAttribute('aria-label'));
        });
        for (const raw of ariaCandidates) {
          if (!raw) continue;
          const count = parseView(raw);
          if (count !== null) {
            return { rawText: raw, count, location: 'tile_aria_label', isPinned: false, viewIconFound: true };
          }
        }

        // 3. Search for view/play icon in tileContainer or anchor
        const viewIcon = tileContainer.querySelector(
          'svg[aria-label*="View count" i], svg[aria-label*="view count" i], svg[aria-label*="Play count" i], svg[aria-label*="Plays" i], svg[aria-label*="Play" i], svg[aria-label*="Clip" i], svg[aria-label*="Reel" i]'
        );
        if (viewIcon) {
          if (viewIcon.nextElementSibling) {
            const text = (viewIcon.nextElementSibling.innerText || viewIcon.nextElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_next_sibling', isPinned: false, viewIconFound: true };
          }
          if (viewIcon.previousElementSibling) {
            const text = (viewIcon.previousElementSibling.innerText || viewIcon.previousElementSibling.textContent || '').trim();
            const count = parseView(text);
            if (count !== null) return { rawText: text, count, location: 'icon_prev_sibling', isPinned: false, viewIconFound: true };
          }

          const parent = viewIcon.parentElement;
          if (parent) {
            const directChildren = Array.from(parent.querySelectorAll('span, div')).filter(el => el !== viewIcon && !viewIcon.contains(el));
            for (const child of directChildren) {
              const text = (child.innerText || child.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_child', isPinned: false, viewIconFound: true };
            }
            const parentText = (parent.innerText || parent.textContent || '').trim();
            const count = parseView(parentText);
            if (count !== null) return { rawText: parentText, count, location: 'parent_text', isPinned: false, viewIconFound: true };

            if (parent.nextElementSibling) {
              const text = (parent.nextElementSibling.innerText || parent.nextElementSibling.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'parent_next_sibling', isPinned: false, viewIconFound: true };
            }
          }

          let curr = parent ? parent.parentElement : null;
          while (curr && curr !== tileContainer.parentElement && curr !== document.body) {
            const candidateNodes = Array.from(curr.querySelectorAll('span, div')).filter(el => !viewIcon.contains(el));
            for (const node of candidateNodes) {
              const parentWithSvg = node.parentElement;
              if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
                continue;
              }
              const text = (node.innerText || node.textContent || '').trim();
              const count = parseView(text);
              if (count !== null) return { rawText: text, count, location: 'wrapper_span', isPinned: false, viewIconFound: true };
            }
            curr = curr.parentElement;
          }
        }

        const hasViewIcon = !!viewIcon;

        // 4. Fallback: inspect leaf spans/divs in tileContainer
        const leafCandidates = [];
        const innerSpans = Array.from(tileContainer.querySelectorAll('span, div'));
        for (const span of innerSpans) {
          if (span.querySelector('span, div')) continue;
          const parentWithSvg = span.parentElement;
          if (parentWithSvg && parentWithSvg.querySelector('svg[aria-label*="Like" i], svg[aria-label*="Comment" i]')) {
            continue;
          }
          const text = (span.innerText || span.textContent || '').trim();
          const count = parseView(text);
          if (count !== null) {
            leafCandidates.push({ rawText: text, count });
          }
        }

        if (leafCandidates.length > 0) {
          const lastCandidate = leafCandidates[leafCandidates.length - 1];
          return {
            rawText: lastCandidate.rawText,
            count: lastCandidate.count,
            location: leafCandidates.length > 1 ? `tile_last_leaf_of_${leafCandidates.length}` : 'tile_child_span',
            isPinned: false,
            viewIconFound: hasViewIcon
          };
        }

        // 5. Direct text & regex scan
        const anchorDirectText = (a.innerText || a.textContent || '').trim();
        const directCount = parseView(anchorDirectText);
        if (directCount !== null) {
          return { rawText: anchorDirectText, count: directCount, location: 'anchor_direct_text', isPinned: false, viewIconFound: hasViewIcon };
        }

        const tileDirectText = (tileContainer.innerText || tileContainer.textContent || '').trim();
        const tileCount = parseView(tileDirectText);
        if (tileCount !== null) {
          return { rawText: tileDirectText, count: tileCount, location: 'tile_direct_text', isPinned: false, viewIconFound: hasViewIcon };
        }

        const combinedText = `${anchorDirectText} ${tileDirectText}`;
        const allMatches = Array.from(combinedText.matchAll(/\b(\d[\d,.]*\s*(?:[kmbKMB]|thousand|million|billion|lakhs?|crores?)?(?:\s*(?:views?|plays?))?)\b/gi));
        for (let i = allMatches.length - 1; i >= 0; i--) {
          const candidateStr = allMatches[i][1].trim();
          const count = parseView(candidateStr);
          if (count !== null) {
            return { rawText: candidateStr, count, location: 'tile_candidate_regex', isPinned: false, viewIconFound: hasViewIcon };
          }
        }

        return { rawText: null, count: null, location: hasViewIcon ? 'text_not_matched' : 'icon_not_found', isPinned: false, viewIconFound: hasViewIcon };
      }

      function matchReelAnchor(a) {
        if (!a) return null;
        const rawHref = (a.getAttribute('href') || a.href || '').trim();
        if (!rawHref) return null;
        const href = rawHref.toLowerCase();
        const userLower = (targetUser || '').toLowerCase();
        const urlLower = window.location.href.toLowerCase();
        const isReelsPage = urlLower.includes(`/${userLower}/reels`);

        if (
          href === '/reels/' || href === '/reels' || href.startsWith('/reels?') ||
          href === '/' || href === '/explore/' || href === '/direct/' ||
          href.startsWith('/stories/') || href.startsWith('/accounts/') ||
          href.startsWith('/about/') || href.startsWith('/legal/') ||
          (userLower && (
            href === `/${userLower}/reels/` || href === `/${userLower}/reels` ||
            href === `/${userLower}/` || href === `/${userLower}` ||
            href === `/${userLower}/tagged/` || href === `/${userLower}/tagged` ||
            href.endsWith(`/${userLower}/reels/`) || href.endsWith(`/${userLower}/reels`)
          ))
        ) {
          return null;
        }

        const reelMatch = rawHref.match(/(?:\/[^/]+)?\/reels?\/([A-Za-z0-9_-]+)/i);
        if (reelMatch && reelMatch[1]) {
          const sc = reelMatch[1];
          if (!['reels', 'videos', 'tagged', 'audio', 'explore', 'feed'].includes(sc.toLowerCase())) {
            return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: 'reel_path' };
          }
        }

        const postMatch = rawHref.match(/(?:\/[^/]+)?\/p\/([A-Za-z0-9_-]+)/i);
        if (postMatch && postMatch[1]) {
          const sc = postMatch[1];
          if (isReelsPage) {
            return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: 'reels_tab_item' };
          }
          const hasVideo = !!a.querySelector('video');
          const hasReelSvg = !!a.querySelector('svg[aria-label*="Reel" i], svg[aria-label*="Clip" i], svg[aria-label*="Video" i], svg[aria-label*="Play" i]');
          const hasViewIcon = !!a.querySelector('svg[aria-label*="View count" i], svg[aria-label*="view count" i]');
          const text = (a.innerText || a.textContent || '').trim();
          const hasViewText = /\b\d[\d,.]*\s*[kmbKMB]?(?:\s*(?:views?|plays?))\b/i.test(text);

          if (hasVideo || hasReelSvg || hasViewIcon || hasViewText) {
            return { shortcode: sc, canonicalUrl: `https://www.instagram.com/reel/${sc}/`, reason: hasReelSvg ? 'svg_indicator' : hasVideo ? 'video_tag' : 'view_indicator' };
          }
        }
        return null;
      }

      const allDocAnchors = Array.from(document.querySelectorAll('a[href]'));
      const matchedItems = allDocAnchors
        .map(a => ({ anchor: a, match: matchReelAnchor(a) }))
        .filter(item => item.match !== null);
      const reelAnchors = matchedItems.map(item => item.anchor);
      const postAnchors = Array.from(document.querySelectorAll('a[href*="/p/"]'));
      const allMedia = Array.from(document.querySelectorAll('img, video'));
      const visibleMedia = allMedia.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      const gridElements = document.querySelectorAll('article, main, div[role="main"], div[style*="flex"]').length;
      const normalizedReelUrls = matchedItems.map(item => item.match.canonicalUrl);
      const uniqueReels = Array.from(new Set(normalizedReelUrls));

      const urlMatch = window.location.pathname.match(/^\/([^/]+)/);
      const urlUser = urlMatch ? urlMatch[1] : null;
      const headerEl = document.querySelector('header h1, header h2, main h1, main h2, section h2');
      const detectedUser = headerEl ? headerEl.innerText.trim() : urlUser;

      // Read-only DOM Diagnostics for evidence gathering
      let domEvidence = {
        first10VisibleAnchors: [],
        first20VisibleAnchors: [],
        allAnchorsInMain: [],
        mainText: '',
        pageTitle: '',
        windowScrollY: 0,
        scrollHeight: 0,
        first10VisibleMedia: [],
        sampleTileOuterHTML: '',
        totalHrefAnchors: 0,
        reelHrefAnchorsCount: 0,
        reelsHrefAnchorsCount: 0,
        postHrefAnchorsCount: 0,
        containerContext: {
          isInMain: false,
          isInArticle: false,
          isInDialog: false,
          parentSummary: 'None'
        },
        collectionError: null
      };

      try {
        domEvidence.pageTitle = document.title || '';
        domEvidence.windowScrollY = window.scrollY || 0;
        domEvidence.scrollHeight = document.documentElement ? document.documentElement.scrollHeight : 0;
        const mainEl = document.querySelector('main');
        if (mainEl) {
          domEvidence.mainText = (mainEl.innerText || '').replace(/\s+/g, ' ').slice(0, 1000);
          domEvidence.allAnchorsInMain = Array.from(mainEl.querySelectorAll('a[href]')).slice(0, 30).map(a => ({
            href: a.href || a.getAttribute('href') || '',
            text: (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
          }));
        }

        const allAnchors = Array.from(document.querySelectorAll('a[href]'));
        domEvidence.totalHrefAnchors = allAnchors.length;
        domEvidence.reelHrefAnchorsCount = document.querySelectorAll('a[href*="/reel/"]').length;
        domEvidence.reelsHrefAnchorsCount = document.querySelectorAll('a[href*="/reels/"]').length;
        domEvidence.postHrefAnchorsCount = document.querySelectorAll('a[href*="/p/"]').length;

        const visibleAnchors = allAnchors.filter(a => {
          const r = a.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });

        domEvidence.first10VisibleAnchors = visibleAnchors.slice(0, 10).map(a => ({
          href: a.href || a.getAttribute('href') || '',
          text: (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
        }));
        domEvidence.first20VisibleAnchors = visibleAnchors.slice(0, 20).map(a => ({
          href: a.href || a.getAttribute('href') || '',
          text: (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80)
        }));

        const visibleMediaList = Array.from(document.querySelectorAll('img, video')).filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });

        domEvidence.first10VisibleMedia = visibleMediaList.slice(0, 10).map(el => {
          let clickable = null;
          let curr = el;
          while (curr && curr !== document.body) {
            const role = curr.getAttribute ? curr.getAttribute('role') : null;
            const hasHref = curr.getAttribute ? curr.getAttribute('href') : null;
            if (curr.tagName === 'A' || curr.tagName === 'BUTTON' || role === 'button' || role === 'link' || hasHref) {
              clickable = curr;
              break;
            }
            try {
              if (window.getComputedStyle(curr).cursor === 'pointer') {
                clickable = curr;
                break;
              }
            } catch (e) {}
            curr = curr.parentElement;
          }

          const tileWrapper = el.closest('a') || el.parentElement?.querySelector('a') || el.parentElement?.parentElement?.querySelector('a');
          const tileAnchorHref = tileWrapper ? (tileWrapper.getAttribute('href') || tileWrapper.href || null) : null;

          const hierarchy = [];
          let hCurr = el;
          while (hCurr && hCurr !== document.body && hierarchy.length < 5) {
            let desc = hCurr.tagName.toLowerCase();
            const role = hCurr.getAttribute ? hCurr.getAttribute('role') : null;
            if (role) desc += `[role="${role}"]`;
            hierarchy.push(desc);
            hCurr = hCurr.parentElement;
          }

          return {
            tag: el.tagName,
            src: (el.src || el.getAttribute('src') || '').slice(0, 100),
            alt: (el.alt || el.getAttribute('alt') || '').slice(0, 80),
            nearestClickableTag: clickable ? clickable.tagName : null,
            nearestClickableHref: clickable ? (clickable.getAttribute('href') || clickable.href || null) : null,
            nearestClickableRole: clickable ? (clickable.getAttribute('role') || null) : null,
            nearestTileAnchorHref: tileAnchorHref,
            containerDescription: hierarchy.join(' < ')
          };
        });

        if (visibleMediaList.length > 0) {
          const firstMedia = visibleMediaList[0];
          const inMain = !!firstMedia.closest('main, [role="main"]');
          const inArticle = !!firstMedia.closest('article');
          const inDialog = !!firstMedia.closest('[role="dialog"], dialog');

          const path = [];
          let p = firstMedia.parentElement;
          while (p && p !== document.body && path.length < 7) {
            let desc = p.tagName.toLowerCase();
            const role = p.getAttribute ? p.getAttribute('role') : null;
            if (role) desc += `[role="${role}"]`;
            if (p.id) desc += `#${p.id}`;
            path.push(desc);
            p = p.parentElement;
          }

          domEvidence.containerContext = {
            isInMain: inMain,
            isInArticle: inArticle,
            isInDialog: inDialog,
            parentSummary: path.join(' -> ')
          };

          const tileCandidate = firstMedia.closest('a') ||
                                firstMedia.closest('article') ||
                                firstMedia.closest('div[role="link"]') ||
                                firstMedia.parentElement?.parentElement?.parentElement ||
                                firstMedia.parentElement;
          if (tileCandidate) {
            domEvidence.sampleTileOuterHTML = tileCandidate.outerHTML.slice(0, 1500);
          }
        }
      } catch (err) {
        domEvidence.collectionError = err.message || String(err);
      }

      // Phase 4: Detailed Reel Tile & View-Count Inspection (up to 5 visible reel anchors)
      let inspectedReels = [];
      try {
        const visibleReelAnchors = reelAnchors.filter(a => {
          const r = a.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const targetAnchors = (visibleReelAnchors.length > 0 ? visibleReelAnchors : reelAnchors).slice(0, 5);

        inspectedReels = targetAnchors.map(a => {
          let reelUrl = a.href;
          try {
            const u = new URL(a.href);
            reelUrl = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
          } catch (e) {
            reelUrl = (a.href || '').split('?')[0].replace(/\/+$/, '');
          }

          // Anchor's visible text
          const anchorText = (a.innerText || a.textContent || '').trim().replace(/\s+/g, ' ');

          // Pinned post detection using existing logic
          let pinnedSvg = a.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
          if (!pinnedSvg && a.parentElement && a.parentElement.querySelectorAll('a[href*="/reel/"]').length === 1) {
            pinnedSvg = a.parentElement.querySelector('svg[aria-label="Pinned post icon"], svg[aria-label*="Pinned" i]');
          }
          const isPinned = !!pinnedSvg;

          // Text from immediate descendants and relevant nested spans/divs
          const descendantNodes = Array.from(a.querySelectorAll('span, div, p, b, strong, em, svg'));
          const descendantTexts = descendantNodes
            .map(el => {
              const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
              const aria = el.getAttribute ? el.getAttribute('aria-label') || '' : '';
              const title = el.getAttribute ? el.getAttribute('title') || '' : '';
              const role = el.getAttribute ? el.getAttribute('role') || '' : '';
              const tag = el.tagName.toLowerCase();
              const className = (el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : '';
              return { tag, text, aria, title, role, className };
            })
            .filter(item => item.text.length > 0 || item.aria.length > 0 || item.title.length > 0)
            .slice(0, 15);

          // Accessible label or title attributes on anchor and its contents
          const accessibleLabels = [];
          const recordAria = (el) => {
            if (!el || !el.getAttribute) return;
            const aria = el.getAttribute('aria-label');
            const title = el.getAttribute('title');
            const alt = el.getAttribute('alt');
            if (aria) accessibleLabels.push({ tag: el.tagName.toLowerCase(), attr: 'aria-label', value: aria });
            if (title) accessibleLabels.push({ tag: el.tagName.toLowerCase(), attr: 'title', value: title });
            if (alt) accessibleLabels.push({ tag: el.tagName.toLowerCase(), attr: 'alt', value: alt });
          };
          recordAria(a);
          Array.from(a.querySelectorAll('[aria-label], [title], [alt]')).forEach(recordAria);

          // Find nearest relevant tile container WITHOUT crossing into sibling reels
          let tileContainer = a;
          let curr = a.parentElement;
          while (curr && curr !== document.body && curr.tagName !== 'MAIN') {
            const reelsInParent = curr.querySelectorAll('a[href*="/reel/"]');
            if (reelsInParent.length > 1) {
              break; // Stop: parent contains multiple reels
            }
            tileContainer = curr;
            curr = curr.parentElement;
          }

          const tileText = (tileContainer.innerText || tileContainer.textContent || '').trim().replace(/\s+/g, ' ');

          // Extra descendants in tile container that are not inside `a`
          const tileExtraDescendants = [];
          const tileLabels = [];
          if (tileContainer !== a) {
            recordAria(tileContainer);
            Array.from(tileContainer.querySelectorAll('[aria-label], [title], [alt]')).forEach(el => {
              if (!a.contains(el)) recordAria(el);
            });

            Array.from(tileContainer.querySelectorAll('span, div, p, b, strong, em, svg')).forEach(el => {
              if (!a.contains(el)) {
                const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
                const aria = el.getAttribute ? el.getAttribute('aria-label') || '' : '';
                const title = el.getAttribute ? el.getAttribute('title') || '' : '';
                const role = el.getAttribute ? el.getAttribute('role') || '' : '';
                if (text || aria || title) {
                  tileExtraDescendants.push({
                    tag: el.tagName.toLowerCase(),
                    text,
                    aria,
                    title,
                    role
                  });
                }
              }
            });
          }

          // Candidate numbers/view-count strings
          const candidateNumbers = [];
          const allStrings = [
            anchorText,
            tileText,
            ...descendantTexts.map(d => d.text),
            ...descendantTexts.map(d => d.aria),
            ...accessibleLabels.map(l => l.value),
            ...tileLabels.map(l => l.value),
            ...tileExtraDescendants.map(d => d.text),
            ...tileExtraDescendants.map(d => d.aria)
          ].filter(Boolean);

          for (const s of allStrings) {
            const matches = s.match(/([\d,.]+\s*[kmbKMB]?(\s*(views?|plays?))?)/g);
            if (matches) {
              for (const m of matches) {
                const trimmed = m.trim();
                if (trimmed && !candidateNumbers.includes(trimmed)) {
                  candidateNumbers.push(trimmed);
                }
              }
            }
          }

          const viewData = extractView(a);

          return {
            reelUrl,
            isPinned: viewData.isPinned || isPinned,
            anchorText,
            viewIconFound: viewData.viewIconFound,
            viewCount: viewData.count,
            rawViewText: viewData.rawText,
            viewIconLocation: viewData.location,
            descendantTexts,
            accessibleLabels: accessibleLabels.slice(0, 15),
            tileContainerTag: tileContainer.tagName.toLowerCase(),
            tileContainerText: tileText,
            tileExtraDescendants: tileExtraDescendants.slice(0, 15),
            tileLabels: tileLabels.slice(0, 15),
            candidateNumbers,
            hasViewCountText: candidateNumbers.length > 0,
            anchorOuterHTML: a.outerHTML.slice(0, 1500),
            tileOuterHTML: tileContainer.outerHTML.slice(0, 1500)
          };
        });
      } catch (err) {
        if (!domEvidence.collectionError) {
          domEvidence.collectionError = `Reel inspection error: ${err.message || String(err)}`;
        }
      }

      // Extract view counts across all discovered reelAnchors
      let validViewCountsCount = 0;
      let averageViews = 0;
      let rawViewCounts = [];
      let pinnedReelsCount = 0;
      let nonPinnedReelsCount = 0;

      try {
        const allExtractedReels = reelAnchors.map(a => {
          let reelUrl = a.href;
          try {
            const u = new URL(a.href);
            reelUrl = `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
          } catch (e) {
            reelUrl = (a.href || '').split('?')[0].replace(/\/+$/, '');
          }
          const viewData = extractView(a);
          return {
            reelUrl,
            isPinned: viewData.isPinned,
            viewCount: viewData.count,
            rawViewText: viewData.rawText,
            viewIconFound: viewData.viewIconFound,
            viewIconLocation: viewData.location
          };
        });

        const pinnedReels = allExtractedReels.filter(r => r.isPinned);
        const nonPinnedReels = allExtractedReels.filter(r => !r.isPinned);
        const validWithViews = nonPinnedReels.filter(r => typeof r.viewCount === 'number' && r.viewCount >= 0);
        const sample15 = validWithViews.slice(0, 15);
        const sampleCounts = sample15.map(r => r.viewCount);
        const sampleAvg = sampleCounts.length > 0 ? Math.round(sampleCounts.reduce((a, b) => a + b, 0) / sampleCounts.length) : 0;

        validViewCountsCount = validWithViews.length;
        averageViews = sampleAvg;
        rawViewCounts = sampleCounts;
        pinnedReelsCount = pinnedReels.length;
        nonPinnedReelsCount = nonPinnedReels.length;
      } catch (err) {
        console.warn("Failed calculating grid view stats:", err);
      }

      return {
        actualUrl: window.location.href,
        requestedUsername: targetUser,
        detectedUsername: detectedUser || urlUser || 'unknown',
        totalReelAnchors: reelAnchors.length,
        uniqueReelUrls: uniqueReels.length,
        first10Reels: uniqueReels.slice(0, 10),
        postAnchorsCount: postAnchors.length,
        visibleMediaCount: visibleMedia.length,
        gridElementCount: gridElements,
        readyState: document.readyState,
        domEvidence,
        inspectedReels,
        validViewCountsCount,
        averageViews,
        rawViewCounts,
        pinnedReelsCount,
        nonPinnedReelsCount
      };
    }, [normalizedUser]);
  }

  let snapshot = await takeSnapshot();
  let snapshotRetried = false;

  // If no Reel anchors are found, safely activate the profile's Reels tab and take one additional snapshot
  if (snapshot.uniqueReelUrls === 0) {
    try {
      await injectScript(igTabId, (targetUser) => {
        const userLower = targetUser.toLowerCase();
        const profileReelsTab =
          document.querySelector('main div[role="tablist"] a[href*="/reels/"]') ||
          document.querySelector('main a[role="tab"][href*="/reels/"]') ||
          document.querySelector('div[role="tablist"] a[href*="/reels/"]') ||
          Array.from(document.querySelectorAll('main a[href*="/reels/"]')).find(a => {
            const href = (a.getAttribute('href') || '').toLowerCase();
            return (href.includes(`/${userLower}/reels`) || href.endsWith('/reels/')) &&
                   href !== '/reels/' && href !== '/reels' && !href.startsWith('/reels?');
          });
        if (profileReelsTab) profileReelsTab.click();
      }, [normalizedUser]);
    } catch (e) {}
    await new Promise(r => setTimeout(r, 3000));
    snapshot = await takeSnapshot();
    snapshotRetried = true;
  }

  if (snapshot.uniqueReelUrls === 0) {
    return {
      success: true,
      stage: 'zero_reels',
      tabId: igTabId,
      actualUrl: snapshot.actualUrl,
      targetUrl: targetReelsUrl,
      readyState: snapshot.readyState,
      requestedUsername: normalizedUser,
      detectedUsername: snapshot.detectedUsername,
      totalReelAnchors: 0,
      uniqueReelUrls: 0,
      first10Reels: [],
      postAnchorsCount: snapshot.postAnchorsCount,
      visibleMediaCount: snapshot.visibleMediaCount,
      gridElementCount: snapshot.gridElementCount,
      snapshotRetried,
      domEvidence: snapshot.domEvidence,
      inspectedReels: snapshot.inspectedReels || [],
      message: `Diagnostic completed: Page loaded for @${normalizedUser}, but 0 Reel anchors (a[href*="/reel/"]) were found in the DOM (Posts: ${snapshot.postAnchorsCount}, Media: ${snapshot.visibleMediaCount}).`
    };
  }

  return {
    success: true,
    stage: 'reels_discovered',
    tabId: igTabId,
    actualUrl: snapshot.actualUrl,
    targetUrl: targetReelsUrl,
    readyState: snapshot.readyState,
    requestedUsername: normalizedUser,
    detectedUsername: snapshot.detectedUsername,
    totalReelAnchors: snapshot.totalReelAnchors,
    uniqueReelUrls: snapshot.uniqueReelUrls,
    first10Reels: snapshot.first10Reels,
    postAnchorsCount: snapshot.postAnchorsCount,
    visibleMediaCount: snapshot.visibleMediaCount,
    gridElementCount: snapshot.gridElementCount,
    snapshotRetried,
    domEvidence: snapshot.domEvidence,
    inspectedReels: snapshot.inspectedReels || [],
    validViewCountsCount: snapshot.validViewCountsCount || 0,
    averageViews: snapshot.averageViews || 0,
    rawViewCounts: snapshot.rawViewCounts || [],
    pinnedReelsCount: snapshot.pinnedReelsCount || 0,
    nonPinnedReelsCount: snapshot.nonPinnedReelsCount || 0,
    message: `Diagnostic successful: Discovered ${snapshot.uniqueReelUrls} unique Reels (${snapshot.validViewCountsCount || 0} valid non-pinned view counts, avg: ${(snapshot.averageViews || 0).toLocaleString()}) for @${normalizedUser}!`
  };
}
