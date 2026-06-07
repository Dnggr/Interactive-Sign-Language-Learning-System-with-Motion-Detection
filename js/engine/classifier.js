/*
  classifier.js — Gesture Recognition Engine
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  v7.0 — DATA-DRIVEN FIX (based on real m2-debug.html captures)

  ══ ROOT CAUSE ANALYSIS (from your actual raw numbers) ══

  BUG 1 — A → N:
    v6 used isThumbSideOfFist: tipY < INDEX_PIP.y AND tipY < THUMB_MCP.y
    Your A data: tipΔIdxPIP = +0.004 → thumb tip is BARELY BELOW INDEX_PIP, not above it.
    So sideY = FALSE for A. N also has sideY=FALSE. Both [0,0,0,0,0] → N wins (listed first).

    REAL FIX: Use thumb-to-index-tip DISTANCE as the separator.
    From your data:
      A: thumbToIdxTip = 0.171  (thumb beside fist, far from index tip)
      N: thumbToIdxTip = 0.154
      M: thumbToIdxTip = 0.131
      E: thumbToIdxTip = 0.029  (all tips close together)
      S: thumbToIdxTip = 0.063
      T: thumbToIdxTip = 0.046
    A is the LARGEST in the fist group. New tiebreaker: minThumbIdxTip:0.15

  BUG 2 — Open hand → C:
    C has fingerStates [1,1,1,1,1] same as flat open hand.
    The key separator: SPREAD.
    Your C data: spread = 0.0323  (fingers curved in tight C arc)
    A flat open hand: spread > 0.08 (fingers splayed wide)
    New tiebreaker: maxSpread:0.07 for C (C has tight spread)
    PLUS: thumbToIdxTip < handScale*0.65 check kept as thumbCurvedIn

  ADDITIONAL FIXES from data:
    T: between=T confirmed working ✅ (tipΔIdxPIP=0.089, between=T)
    S: thumbToIdxTip=0.063 → maxThumbIdxTip:0.10
    O: thumbToIdxTip=0.049, spread=0.0131 → tipsClose:true (spread<0.06) ✅
    R vs U vs V: spread separates them well (R:0.2368, U:0.2439, V:0.2561)
    K vs P: belowPIP separates them ✅
    G vs Q: belowPIP separates them ✅
    L vs D: curvedV6 — L has thumbToIdxTip=0.394 (far), D has 0.378 (similar but D=D)
*/

import { SIGN_DICTIONARY } from './dictionary.js';

// ─────────────────────────────────────────────────────────
// Landmark index constants
// ─────────────────────────────────────────────────────────
const WRIST      = 0;
const THUMB_CMC  = 1;
const THUMB_MCP  = 2;
const THUMB_IP   = 3;
const THUMB_TIP  = 4;
const INDEX_MCP  = 5;
const INDEX_PIP  = 6;
const INDEX_TIP  = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_MCP   = 13;
const RING_PIP   = 14;
const RING_TIP   = 16;
const PINKY_MCP  = 17;
const PINKY_PIP  = 18;
const PINKY_TIP  = 20;

// ─────────────────────────────────────────────────────────
// Tuning constants
// ─────────────────────────────────────────────────────────
const NULL_ZONE_THRESHOLD  = 0.62;
const CONFIDENCE_THRESHOLD = 84;
const HOLD_FRAMES          = 24;   // ~0.8s at 30fps

// ─────────────────────────────────────────────────────────
// Temporal smoothing state
// ─────────────────────────────────────────────────────────
let _holdCount      = 0;
let _lastRawLabel   = null;
let _confirmedLabel = null;

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

export function classifyGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) {
        _resetSmoothing();
        return { label: null, confidence: 0, matched: false };
    }

    const descriptor = computeHandDescriptor(landmarks);
    let bestLabel = null;
    let bestScore = 0;

    for (const [label, signData] of Object.entries(SIGN_DICTIONARY)) {
        if (signData.disabled) continue;
        const score = scoreAgainstSign(descriptor, signData);
        if (score > bestScore) {
            bestScore = score;
            bestLabel = label;
        }
    }

    if (bestScore < NULL_ZONE_THRESHOLD) {
        _resetSmoothing();
        return { label: null, confidence: 0, matched: false };
    }

    const rawConfidence = Math.round(bestScore * 100);

    if (bestLabel === _lastRawLabel) {
        _holdCount++;
    } else {
        _holdCount    = 1;
        _lastRawLabel = bestLabel;
    }

    if (_holdCount >= HOLD_FRAMES && rawConfidence >= CONFIDENCE_THRESHOLD) {
        _confirmedLabel = bestLabel;
    }

    if (_confirmedLabel !== null && rawConfidence >= CONFIDENCE_THRESHOLD) {
        return { label: _confirmedLabel, confidence: rawConfidence, matched: true };
    }

    return { label: null, confidence: rawConfidence, matched: false };
}

export function resetClassifier() {
    _resetSmoothing();
}

function _resetSmoothing() {
    _holdCount      = 0;
    _lastRawLabel   = null;
    _confirmedLabel = null;
}

// ─────────────────────────────────────────────────────────
// Hand descriptor
// ─────────────────────────────────────────────────────────

function computeHandDescriptor(lm) {
    const thumbState = getThumbState(lm);

    const allTips = [lm[INDEX_TIP], lm[MIDDLE_TIP], lm[RING_TIP], lm[PINKY_TIP]];
    const avgX    = (allTips.reduce((s, t) => s + t.x, 0) + lm[THUMB_TIP].x) / 5;
    const avgY    = (allTips.reduce((s, t) => s + t.y, 0) + lm[THUMB_TIP].y) / 5;
    const spread  = allTips.reduce((s, t) =>
        s + Math.sqrt((t.x - avgX) ** 2 + (t.y - avgY) ** 2), 0) / 4;

    const thumbExt = thumbState >= 1;
    const pinkExt  = getFingerState(lm, PINKY_TIP, PINKY_PIP, PINKY_MCP) >= 1;
    const idxCurl  = getFingerState(lm, INDEX_TIP,  INDEX_PIP,  INDEX_MCP)  === 0;
    const midCurl  = getFingerState(lm, MIDDLE_TIP, MIDDLE_PIP, MIDDLE_MCP) === 0;
    const rngCurl  = getFingerState(lm, RING_TIP,   RING_PIP,   RING_MCP)   === 0;

    // ── v7.0: data-driven distances ──
    const thumbToIdxTip = landmarkDistance(lm[THUMB_TIP], lm[INDEX_TIP]);
    const handScale     = landmarkDistance(lm[MIDDLE_TIP], lm[WRIST]);

    return {
        fingerStates: [
            thumbState,
            getFingerState(lm, INDEX_TIP,  INDEX_PIP,  INDEX_MCP),
            getFingerState(lm, MIDDLE_TIP, MIDDLE_PIP, MIDDLE_MCP),
            getFingerState(lm, RING_TIP,   RING_PIP,   RING_MCP),
            getFingerState(lm, PINKY_TIP,  PINKY_PIP,  PINKY_MCP),
        ],
        extras: {
            indexHooked:           lm[INDEX_PIP].y < lm[INDEX_TIP].y && lm[INDEX_TIP].y < lm[INDEX_MCP].y,
            fingersCrossed:        Math.abs(lm[INDEX_TIP].x - lm[MIDDLE_TIP].x) < 0.03,
            indexMiddleSpread:     landmarkDistance(lm[INDEX_TIP], lm[MIDDLE_TIP]),
            thumbTipBelowIndexPIP: lm[THUMB_TIP].y > lm[INDEX_PIP].y,
            tipsClose:             spread < 0.06,
            spread,                               // raw spread value
            pinkThumbOnly:         thumbExt && idxCurl && midCurl && rngCurl && pinkExt,

            // v7.0: distance-based tiebreakers (mirror-safe, data-validated)
            thumbToIdxTip,                        // raw distance, used by min/maxThumbIdxTip
            thumbWrapped:          isThumbWrapped(lm),
            thumbBetweenFingers:   isThumbBetweenFingers(lm),
            thumbSideOfFist:       isThumbSideOfFist(lm),
            thumbCurvedIn:         thumbToIdxTip < handScale * 0.65,  // C: 0.143 < 0.387*0.65=0.251 ✅
        },
    };
}

// ─────────────────────────────────────────────────────────
// Finger state — Y-axis only (mirror-safe)
// ─────────────────────────────────────────────────────────

function getFingerState(lm, tipIdx, pipIdx, mcpIdx) {
    const tipY = lm[tipIdx].y;
    const pipY = lm[pipIdx].y;
    const mcpY = lm[mcpIdx].y;
    if (tipY < pipY && tipY < mcpY) return 2;  // fully extended
    if (tipY < mcpY)                return 1;  // partially bent
    return 0;                                   // curled
}

/**
 * Thumb state using Y-axis joint chain (mirror-safe).
 * MediaPipe Y increases downward.
 */
function getThumbState(lm) {
    const tipY = lm[THUMB_TIP].y;
    const ipY  = lm[THUMB_IP].y;
    const mcpY = lm[THUMB_MCP].y;
    const cmcY = lm[THUMB_CMC].y;

    // Fully extended: tip above IP and MCP
    if (tipY < ipY && tipY < mcpY) return 2;

    // Beside fist (A): tip lifted above CMC base
    if (tipY < cmcY) return 1;

    // Tucked/curled
    return 0;
}

// ─────────────────────────────────────────────────────────
// Tiebreakers (all Y-axis / distance based — mirror-safe)
// ─────────────────────────────────────────────────────────

/**
 * A: thumb beside fist — tip is displaced UP relative to fist.
 * From data: A tipΔIdxMCP = -0.084 (tip is 0.084 ABOVE index MCP).
 * N tipΔIdxMCP = -0.082, M = -0.045.
 * This alone doesn't separate well, so we use minThumbIdxTip in dictionary instead.
 */
function isThumbSideOfFist(lm) {
    // Tip is above CMC (thumb lifted from base) AND above INDEX_MCP (not tucked under fist)
    return lm[THUMB_TIP].y < lm[THUMB_CMC].y && lm[THUMB_TIP].y < lm[INDEX_MCP].y;
}

/**
 * S: thumb wrapped across front of fist.
 * thumbToIdxTip is small (0.063) — thumb pressed against knuckles.
 * Tip is at roughly the same Y as INDEX_MCP.
 */
function isThumbWrapped(lm) {
    const tipAtKnuckleLevel = lm[THUMB_TIP].y >= lm[INDEX_MCP].y - 0.04;
    const notTuckedUnder    = lm[THUMB_TIP].y <  lm[INDEX_MCP].y + 0.07;
    const aboveWrist        = lm[THUMB_TIP].y >  lm[WRIST].y;
    return tipAtKnuckleLevel && notTuckedUnder && aboveWrist;
}

/**
 * T: thumb between index and middle fingers.
 * Your data: between=T confirmed for T, also appears on R/U — but R/U have
 * different fingerStates so no collision.
 */
function isThumbBetweenFingers(lm) {
    const tipY    = lm[THUMB_TIP].y;
    const tipX    = lm[THUMB_TIP].x;
    const idxPipY = lm[INDEX_PIP].y;
    const idxMcpY = lm[INDEX_MCP].y;
    const idxMcpX = lm[INDEX_MCP].x;
    const midMcpX = lm[MIDDLE_MCP].x;
    const yInRange = tipY > idxPipY && tipY < idxMcpY;
    const xMin = Math.min(idxMcpX, midMcpX) - 0.02;
    const xMax = Math.max(idxMcpX, midMcpX) + 0.02;
    return yInRange && (tipX >= xMin && tipX <= xMax);
}

// ─────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────

function scoreAgainstSign(descriptor, signData) {
    const ref  = signData.fingerStates;
    const live = descriptor.fingerStates;
    let primaryScore = 0;

    for (let i = 0; i < 5; i++) {
        if (ref[i] === 1) {
            if (live[i] === 2)      primaryScore += 1.0;
            else if (live[i] === 1) primaryScore += 0.7;
        } else {
            if (live[i] === 0)      primaryScore += 1.0;
            else if (live[i] === 1) primaryScore += 0.3;
        }
    }

    let score = primaryScore / 5;

    if (signData.tiebreakers) {
        const tb  = signData.tiebreakers;
        const e   = descriptor.extras;
        const tbW = signData.tbWeight ?? 0.28;
        let bonus = 0, cnt = 0;

        if (tb.indexHooked         !== undefined) { cnt++; if (e.indexHooked            === tb.indexHooked)         bonus++; }
        if (tb.fingersCrossed      !== undefined) { cnt++; if (e.fingersCrossed          === tb.fingersCrossed)      bonus++; }
        if (tb.tipsClose           !== undefined) { cnt++; if (e.tipsClose               === tb.tipsClose)           bonus++; }
        if (tb.thumbBelowPIP       !== undefined) { cnt++; if (e.thumbTipBelowIndexPIP   === tb.thumbBelowPIP)       bonus++; }
        if (tb.pinkThumbOnly       !== undefined) { cnt++; if (e.pinkThumbOnly           === tb.pinkThumbOnly)       bonus++; }
        if (tb.thumbWrapped        !== undefined) { cnt++; if (e.thumbWrapped            === tb.thumbWrapped)        bonus++; }
        if (tb.thumbBetweenFingers !== undefined) { cnt++; if (e.thumbBetweenFingers     === tb.thumbBetweenFingers) bonus++; }
        if (tb.thumbSideOfFist     !== undefined) { cnt++; if (e.thumbSideOfFist         === tb.thumbSideOfFist)     bonus++; }
        if (tb.thumbCurvedIn       !== undefined) { cnt++; if (e.thumbCurvedIn           === tb.thumbCurvedIn)       bonus++; }
        if (tb.minSpread           !== undefined) { cnt++; if (e.indexMiddleSpread       >= tb.minSpread)            bonus++; }
        if (tb.maxSpread           !== undefined) { cnt++; if (e.indexMiddleSpread       <= tb.maxSpread)            bonus++; }

        // v7.0: thumb-to-index-tip distance gates (data-driven from debug captures)
        if (tb.minThumbIdxTip !== undefined) { cnt++; if (e.thumbToIdxTip >= tb.minThumbIdxTip) bonus++; }
        if (tb.maxThumbIdxTip !== undefined) { cnt++; if (e.thumbToIdxTip <= tb.maxThumbIdxTip) bonus++; }

        // v7.0: raw spread gate (for C vs open hand)
        if (tb.maxRawSpread !== undefined) { cnt++; if (e.spread <= tb.maxRawSpread) bonus++; }

        if (cnt > 0) score = score * (1 - tbW) + (bonus / cnt) * tbW;
    }

    return score;
}

// ─────────────────────────────────────────────────────────
// Legacy exports (backward compatibility)
// ─────────────────────────────────────────────────────────

export function detectFingerStates(lm) {
    return computeHandDescriptor(lm).fingerStates.map(v => v >= 1 ? 1 : 0);
}

export function isFingerExtended(lm, tipIdx, mcpIdx) {
    return lm[tipIdx].y < lm[mcpIdx].y ? 1 : 0;
}

export function isThumbExtended(lm) {
    return getThumbState(lm) >= 1 ? 1 : 0;
}

export function compareFingerStates(live, reference) {
    if (!reference || live.length !== reference.length) return 0;
    let m = 0;
    for (let i = 0; i < live.length; i++) if (live[i] === reference[i]) m++;
    return m / live.length;
}

export function landmarkDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z ?? 0) - (b.z ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}