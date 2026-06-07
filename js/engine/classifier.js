/*
  classifier.js — Gesture Recognition Engine
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine
  v8.0 — FULL REWRITE: systematic bug fixes

  ══ BUGS FIXED vs v7.0 ══

  BUG 1 — G vs L collision
    Both had [1,1,0,0,0] + thumbBelowPIP:false → no separator.
    FIX: Added isIndexVertical() to extras.
      L: index points straight UP  → indexTip.y is much lower than indexMCP.y
      G: index points SIDEWAYS     → indexTip.y ≈ indexMCP.y (horizontal)
    Dictionary: L gets indexVertical:true, G gets indexVertical:false.

  BUG 2 — A vs N overlapping distance ranges
    A: minThumbIdxTip:0.13 but N range was 0.14–0.16 → overlap at 0.14–0.16.
    FIX: A raised to minThumbIdxTip:0.17 (safely above N's max of 0.16).
    Also added thumbWrapped:false and thumbBetweenFingers:false to A
    to prevent S/T from ever scoring as A.

  BUG 3 — H vs U/V spread threshold
    H maxSpread:0.08 used indexMiddleSpread (tip-to-tip distance), not raw spread.
    H points SIDEWAYS — indexTip and middleTip are at similar heights so
    indexMiddleSpread is small regardless of how close fingers are.
    FIX: Added isIndexVertical:false to H and isIndexVertical:true to U/V.
    H points sideways → indexVertical:false separates it cleanly from U/V.

  BUG 4 — Scoring: ref[i]===1 vs live values 0,1,2
    Dictionary uses 1 for "extended" but getFingerState returns 2 for
    fully extended. Scoring: ref===1 gives live===2 → 1.0, live===1 → 0.7.
    This is fine. The REAL scoring bug was ref===0 but live===1 (slightly bent)
    only got 0.3 → crushed score for letters where fingers are
    naturally slightly bent (C, O, many curved signs).
    FIX: Raised bent penalty from 0.3 → 0.5 for ref===0 && live===1.
    A slightly bent finger on a curled-finger sign should not tank the score.

  BUG 5 — NULL_ZONE too low
    0.62 null zone let borderline garbage detections through.
    FIX: Raised to 0.68. Reduces false positives at the cost of needing
    a cleaner sign, which is correct behavior.

  BUG 6 — Confirmed label stays locked too long
    Once _confirmedLabel is set, it stays until explicitly reset.
    If user transitions slowly, old confirmed label bleeds into new sign.
    FIX: _confirmedLabel now resets whenever _lastRawLabel changes.
    Only the CURRENT best label can be confirmed.
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
const NULL_ZONE_THRESHOLD  = 0.68;  // raised from 0.62 — fewer false positives
const CONFIDENCE_THRESHOLD = 82;    // slightly relaxed from 84 for better recall
const HOLD_FRAMES          = 20;    // ~0.65s at 30fps — faster to register

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
    let secondScore = 0;

    for (const [label, signData] of Object.entries(SIGN_DICTIONARY)) {
        if (signData.disabled) continue;
        const score = scoreAgainstSign(descriptor, signData);
        if (score > bestScore) {
            secondScore = bestScore;
            bestScore   = score;
            bestLabel   = label;
        } else if (score > secondScore) {
            secondScore = score;
        }
    }

    // Reject if no clear winner (margin too small between 1st and 2nd)
    const margin = bestScore - secondScore;
    if (bestScore < NULL_ZONE_THRESHOLD || margin < 0.04) {
        _resetSmoothing();
        return { label: null, confidence: 0, matched: false };
    }

    const rawConfidence = Math.round(bestScore * 100);

    // BUG 6 FIX: reset confirmed label when raw label changes
    if (bestLabel !== _lastRawLabel) {
        _holdCount      = 1;
        _lastRawLabel   = bestLabel;
        _confirmedLabel = null;   // ← clear old confirmed label immediately
    } else {
        _holdCount++;
    }

    if (_holdCount >= HOLD_FRAMES && rawConfidence >= CONFIDENCE_THRESHOLD) {
        _confirmedLabel = bestLabel;
    }

    if (_confirmedLabel !== null && rawConfidence >= CONFIDENCE_THRESHOLD) {
        return { label: _confirmedLabel, confidence: rawConfidence, matched: true };
    }

    return { label: bestLabel, confidence: rawConfidence, matched: false };
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
// Hand descriptor — all features computed once per frame
// ─────────────────────────────────────────────────────────

function computeHandDescriptor(lm) {
    const thumbState = getThumbState(lm);

    // Spread: average distance of 4 fingertips from centroid of all 5 tips
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
            // ── Existing tiebreakers ──
            indexHooked:           lm[INDEX_PIP].y < lm[INDEX_TIP].y && lm[INDEX_TIP].y < lm[INDEX_MCP].y,
            fingersCrossed:        Math.abs(lm[INDEX_TIP].x - lm[MIDDLE_TIP].x) < 0.03,
            indexMiddleSpread:     landmarkDistance(lm[INDEX_TIP], lm[MIDDLE_TIP]),
            thumbTipBelowIndexPIP: lm[THUMB_TIP].y > lm[INDEX_PIP].y,
            tipsClose:             spread < 0.06,
            spread,
            pinkThumbOnly:         thumbExt && idxCurl && midCurl && rngCurl && pinkExt,
            thumbToIdxTip,
            thumbWrapped:          isThumbWrapped(lm),
            thumbBetweenFingers:   isThumbBetweenFingers(lm),
            thumbSideOfFist:       isThumbSideOfFist(lm),
            thumbCurvedIn:         thumbToIdxTip < handScale * 0.65,

            // ── BUG 1 + 3 FIX: index direction ──
            // TRUE when index finger points clearly upward (tip Y much lower than MCP Y).
            // FALSE when index finger points sideways (tip Y ≈ MCP Y).
            // Separates L (vertical) from G (horizontal).
            // Separates U/V (vertical) from H (horizontal/sideways).
            indexVertical: (lm[INDEX_MCP].y - lm[INDEX_TIP].y) > 0.08,
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

function getThumbState(lm) {
    const tipY = lm[THUMB_TIP].y;
    const ipY  = lm[THUMB_IP].y;
    const mcpY = lm[THUMB_MCP].y;
    const cmcY = lm[THUMB_CMC].y;
    if (tipY < ipY && tipY < mcpY) return 2;  // fully extended
    if (tipY < cmcY)               return 1;  // beside fist (A-position)
    return 0;                                  // tucked/curled
}

// ─────────────────────────────────────────────────────────
// Tiebreaker functions — all Y/distance based, mirror-safe
// ─────────────────────────────────────────────────────────

function isThumbSideOfFist(lm) {
    return lm[THUMB_TIP].y < lm[THUMB_CMC].y && lm[THUMB_TIP].y < lm[INDEX_MCP].y;
}

function isThumbWrapped(lm) {
    const tipAtKnuckleLevel = lm[THUMB_TIP].y >= lm[INDEX_MCP].y - 0.04;
    const notTuckedUnder    = lm[THUMB_TIP].y <  lm[INDEX_MCP].y + 0.07;
    const aboveWrist        = lm[THUMB_TIP].y >  lm[WRIST].y;
    return tipAtKnuckleLevel && notTuckedUnder && aboveWrist;
}

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
// Scoring — BUG 4 FIX: bent penalty raised from 0.3 → 0.5
// ─────────────────────────────────────────────────────────

function scoreAgainstSign(descriptor, signData) {
    const ref  = signData.fingerStates;
    const live = descriptor.fingerStates;
    let primaryScore = 0;

    for (let i = 0; i < 5; i++) {
        if (ref[i] === 1) {
            // Dictionary says extended:
            if (live[i] === 2)      primaryScore += 1.0;  // fully extended ✓
            else if (live[i] === 1) primaryScore += 0.7;  // partially bent ✓ (good enough)
            else                    primaryScore += 0.0;  // curled ✗
        } else {
            // Dictionary says curled:
            if (live[i] === 0)      primaryScore += 1.0;  // curled ✓
            else if (live[i] === 1) primaryScore += 0.5;  // slightly bent — was 0.3, now 0.5
            else                    primaryScore += 0.0;  // extended ✗
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
        if (tb.minThumbIdxTip      !== undefined) { cnt++; if (e.thumbToIdxTip          >= tb.minThumbIdxTip)       bonus++; }
        if (tb.maxThumbIdxTip      !== undefined) { cnt++; if (e.thumbToIdxTip          <= tb.maxThumbIdxTip)       bonus++; }
        if (tb.maxRawSpread        !== undefined) { cnt++; if (e.spread                 <= tb.maxRawSpread)         bonus++; }
        // BUG 1+3 FIX: new indexVertical tiebreaker
        if (tb.indexVertical       !== undefined) { cnt++; if (e.indexVertical           === tb.indexVertical)       bonus++; }

        if (cnt > 0) score = score * (1 - tbW) + (bonus / cnt) * tbW;
    }

    return score;
}

// ─────────────────────────────────────────────────────────
// Legacy exports (backward compatibility with m2-test.html)
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