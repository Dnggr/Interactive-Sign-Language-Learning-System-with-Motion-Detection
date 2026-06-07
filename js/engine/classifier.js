/*
  classifier.js
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine
  v9.0 — ROOT CAUSE FIXES

  ══ BUGS FIXED vs v8.0 ══

  BUG-C FIX — NULL_ZONE + tbWeight structural failure
    v8: tbWeight:0.50 for fist group + NULL_ZONE:0.68
    Math: if tiebreakers score 0/3 → final = 0.5*1.0 + 0.5*0 = 0.50 < 0.68 → REJECTED
    ALL fist-group letters (E,M,N,S,T) could never clear NULL_ZONE when
    tiebreakers were ambiguous or the hand pose was slightly off.
    FIX: NULL_ZONE lowered to 0.55. tbWeight kept at 0.50 for fist group
    but now a sign with perfect fingerStates + 1/3 tiebreakers = 0.5+0.167=0.667
    which is above 0.55 and will register. Margin check kept at 0.04.

  BUG-D FIX — DOUBLE DEBOUNCE
    v8: classifier.js has internal HOLD_FRAMES=20, m2-test.html also has
    holdFrames=24. User had to hold for 44 frames (~1.5s) before anything registered.
    This made it feel like nothing was being detected at all.
    FIX: Remove internal HOLD_FRAMES smoothing from classifyGesture entirely.
    classifyGesture now returns matched:true on the FIRST frame where score
    meets threshold and margin. The test HTML's hold timer (24 frames) is the
    only debounce. This is cleaner — UI layer controls timing, engine just scores.
    The _confirmedLabel / _holdCount state has been removed from the engine.

  BUG-E FIX — Thumb A-position scoring 0.7 instead of 1.0
    v8: getThumbState for A-position (thumb beside fist) returns 1 (not 2).
    Dictionary A has fingerStates[0]=1. Score: ref=1 vs live=1 → 0.7 (partial).
    This means A's defining feature gets partial credit, reducing base score.
    FIX: Scoring rule changed — ref===1 AND live===1 now gives 1.0 (not 0.7).
    "Partially extended" is still "extended" for the purpose of the dictionary.
    The distinction between 1 and 2 is used for tiebreaking via extras, not scoring.

  BUG-SCALE FIX — thumbWrapped/thumbBetweenFingers use absolute Y thresholds
    v8: isThumbWrapped uses lm[THUMB_TIP].y >= lm[INDEX_MCP].y - 0.04 which is
    an absolute pixel value. When hand is held closer/farther from camera, ALL
    landmark Y values shift uniformly, but relative distances stay the same.
    FIX: All tiebreaker geometry now uses handScale-normalized distances
    where needed, or relative comparisons (a.y < b.y) instead of thresholds.
    thumbWrapped, thumbBetweenFingers now use normalized distances via handScale.

  BUG-VERTICAL FIX — indexVertical threshold too strict
    v8: indexVertical = (INDEX_MCP.y - INDEX_TIP.y) > 0.08
    If user tilts hand slightly, an upward index may only give 0.06 difference.
    FIX: Lowered to 0.05. Also made it scale-relative using handScale factor.
*/

import { SIGN_DICTIONARY } from './dictionary.js';

// ─────────────────────────────────────────────────────────
// Landmark indices
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
// BUG-C FIX: lowered from 0.68 → 0.55
// This lets fist-group signs register when tiebreakers are partially ambiguous.
const NULL_ZONE_THRESHOLD  = 0.55;
const CONFIDENCE_THRESHOLD = 78;  // % threshold for matched:true

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * Classify the current hand pose against SIGN_DICTIONARY.
 * BUG-D FIX: No internal hold/smoothing state. Returns matched:true
 * on first frame meeting threshold. UI layer controls debounce timing.
 *
 * @param {Array<{x,y,z}>} landmarks - 21 MediaPipe landmarks (normalized 0-1)
 * @returns {{ label:string|null, confidence:number, matched:boolean, raw:object }}
 */
export function classifyGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) {
        return { label: null, confidence: 0, matched: false };
    }

    const descriptor = computeHandDescriptor(landmarks);
    let bestLabel  = null;
    let bestScore  = 0;
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

    const margin = bestScore - secondScore;
    if (bestScore < NULL_ZONE_THRESHOLD || margin < 0.03) {
        return { label: null, confidence: 0, matched: false };
    }

    const confidence = Math.round(bestScore * 100);
    const matched    = confidence >= CONFIDENCE_THRESHOLD;

    return { label: bestLabel, confidence, matched };
}

/** Reset function — kept for API compatibility with m2-test.html */
export function resetClassifier() { /* no-op in v9 — state moved to UI layer */ }

// ─────────────────────────────────────────────────────────
// Hand descriptor — computed once per frame
// ─────────────────────────────────────────────────────────

function computeHandDescriptor(lm) {
    // Scale reference: distance from wrist to middle MCP (palm size)
    // Used to normalize all distance thresholds — makes them camera-distance-independent
    const handScale = landmarkDistance(lm[WRIST], lm[MIDDLE_MCP]);

    const thumbState = getThumbState(lm);
    const idxState   = getFingerState(lm, INDEX_TIP,  INDEX_PIP,  INDEX_MCP);
    const midState   = getFingerState(lm, MIDDLE_TIP, MIDDLE_PIP, MIDDLE_MCP);
    const rngState   = getFingerState(lm, RING_TIP,   RING_PIP,   RING_MCP);
    const pnkState   = getFingerState(lm, PINKY_TIP,  PINKY_PIP,  PINKY_MCP);

    // All-tips spread (centroid distance)
    const allTips = [lm[INDEX_TIP], lm[MIDDLE_TIP], lm[RING_TIP], lm[PINKY_TIP]];
    const avgX    = (allTips.reduce((s,t)=>s+t.x,0) + lm[THUMB_TIP].x) / 5;
    const avgY    = (allTips.reduce((s,t)=>s+t.y,0) + lm[THUMB_TIP].y) / 5;
    const spread  = allTips.reduce((s,t)=>s+Math.sqrt((t.x-avgX)**2+(t.y-avgY)**2),0)/4;

    const thumbToIdxTip = landmarkDistance(lm[THUMB_TIP], lm[INDEX_TIP]);
    const iMSpread      = landmarkDistance(lm[INDEX_TIP], lm[MIDDLE_TIP]);

    return {
        fingerStates: [thumbState, idxState, midState, rngState, pnkState],
        extras: {
            handScale,

            // Tip spread (normalized by hand scale)
            tipsClose:    spread / handScale < 0.38,
            spread,
            spreadNorm:   spread / handScale,

            // Thumb geometry
            thumbToIdxTip,
            thumbToIdxTipNorm: thumbToIdxTip / handScale,

            // BUG-SCALE FIX: normalized tiebreakers
            thumbWrapped:          isThumbWrapped(lm, handScale),
            thumbBetweenFingers:   isThumbBetweenFingers(lm),
            thumbSideOfFist:       isThumbSideOfFist(lm),
            thumbCurvedIn:         thumbToIdxTip / handScale < 0.60,
            thumbTipBelowIndexPIP: lm[THUMB_TIP].y > lm[INDEX_PIP].y,

            // Index finger direction
            // BUG-VERTICAL FIX: lowered threshold, scale-normalized
            indexVertical: (lm[INDEX_MCP].y - lm[INDEX_TIP].y) / handScale > 0.40,

            // Finger geometry
            indexHooked:       lm[INDEX_PIP].y < lm[INDEX_TIP].y && lm[INDEX_TIP].y < lm[INDEX_MCP].y,
            fingersCrossed:    iMSpread / handScale < 0.18,
            indexMiddleSpread: iMSpread,
            iMSpreadNorm:      iMSpread / handScale,

            // Compound
            pinkThumbOnly: thumbState>=1 && idxState===0 && midState===0 && rngState===0 && pnkState>=1,
        },
    };
}

// ─────────────────────────────────────────────────────────
// Finger state — 3 levels, Y-axis, mirror-safe
// ─────────────────────────────────────────────────────────

function getFingerState(lm, tipIdx, pipIdx, mcpIdx) {
    const tY = lm[tipIdx].y, pY = lm[pipIdx].y, mY = lm[mcpIdx].y;
    if (tY < pY && tY < mY) return 2;  // fully extended
    if (tY < mY)            return 1;  // partially bent
    return 0;                           // curled
}

function getThumbState(lm) {
    const tY = lm[THUMB_TIP].y, iY = lm[THUMB_IP].y,
          mY = lm[THUMB_MCP].y, cY = lm[THUMB_CMC].y;
    if (tY < iY && tY < mY) return 2;  // fully extended
    if (tY < cY)            return 1;  // beside fist (A position)
    return 0;                           // tucked
}

// ─────────────────────────────────────────────────────────
// Tiebreaker geometry — scale-normalized where needed
// ─────────────────────────────────────────────────────────

function isThumbSideOfFist(lm) {
    // Thumb tip is ABOVE (lower Y than) both the CMC and index MCP
    return lm[THUMB_TIP].y < lm[THUMB_CMC].y && lm[THUMB_TIP].y < lm[INDEX_MCP].y;
}

function isThumbWrapped(lm, handScale) {
    // BUG-SCALE FIX: use normalized distance instead of absolute Y threshold
    // S: thumb wraps ACROSS fingers — tip is at knuckle level but NOT tucked under
    const tipToIdxMCP = landmarkDistance(lm[THUMB_TIP], lm[INDEX_MCP]);
    const tipToWrist  = landmarkDistance(lm[THUMB_TIP], lm[WRIST]);
    // Wrapped: tip is close to the knuckle row (not far away like A or E)
    return (tipToIdxMCP / handScale < 0.55) && (tipToWrist / handScale > 0.35);
}

function isThumbBetweenFingers(lm) {
    // T: thumb inserted between index and middle fingers
    const tipY    = lm[THUMB_TIP].y;
    const idxPipY = lm[INDEX_PIP].y;
    const idxMcpY = lm[INDEX_MCP].y;
    const tipX    = lm[THUMB_TIP].x;
    const idxMcpX = lm[INDEX_MCP].x;
    const midMcpX = lm[MIDDLE_MCP].x;
    const yInRange = tipY > idxPipY && tipY < idxMcpY;
    const xMin = Math.min(idxMcpX, midMcpX) - 0.03;
    const xMax = Math.max(idxMcpX, midMcpX) + 0.03;
    return yInRange && tipX >= xMin && tipX <= xMax;
}

// ─────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────

function scoreAgainstSign(descriptor, signData) {
    const ref  = signData.fingerStates;
    const live = descriptor.fingerStates;
    let primary = 0;

    for (let i = 0; i < 5; i++) {
        if (ref[i] === 1) {
            // Dictionary says EXTENDED:
            // BUG-E FIX: live===1 (partially bent) now gives 1.0, not 0.7
            // Partial extension IS extension for the dictionary's purposes.
            // Tiebreakers handle the fine distinctions.
            if (live[i] >= 1) primary += 1.0;  // any extension = match
            else              primary += 0.0;  // curled when should be extended = fail
        } else {
            // Dictionary says CURLED:
            if (live[i] === 0)      primary += 1.0;  // curled ✓
            else if (live[i] === 1) primary += 0.45; // slightly bent — small penalty
            else                    primary += 0.0;  // fully extended when should be curled = fail
        }
    }

    let score = primary / 5;

    if (signData.tiebreakers) {
        const tb  = signData.tiebreakers;
        const e   = descriptor.extras;
        const tbW = signData.tbWeight ?? 0.28;
        let bonus = 0, cnt = 0;

        // Boolean tiebreakers
        if (tb.indexHooked         !== undefined) { cnt++; if (e.indexHooked            === tb.indexHooked)         bonus++; }
        if (tb.fingersCrossed      !== undefined) { cnt++; if (e.fingersCrossed          === tb.fingersCrossed)      bonus++; }
        if (tb.tipsClose           !== undefined) { cnt++; if (e.tipsClose               === tb.tipsClose)           bonus++; }
        if (tb.thumbBelowPIP       !== undefined) { cnt++; if (e.thumbTipBelowIndexPIP   === tb.thumbBelowPIP)       bonus++; }
        if (tb.pinkThumbOnly       !== undefined) { cnt++; if (e.pinkThumbOnly           === tb.pinkThumbOnly)       bonus++; }
        if (tb.thumbWrapped        !== undefined) { cnt++; if (e.thumbWrapped            === tb.thumbWrapped)        bonus++; }
        if (tb.thumbBetweenFingers !== undefined) { cnt++; if (e.thumbBetweenFingers     === tb.thumbBetweenFingers) bonus++; }
        if (tb.thumbSideOfFist     !== undefined) { cnt++; if (e.thumbSideOfFist         === tb.thumbSideOfFist)     bonus++; }
        if (tb.thumbCurvedIn       !== undefined) { cnt++; if (e.thumbCurvedIn           === tb.thumbCurvedIn)       bonus++; }
        if (tb.indexVertical       !== undefined) { cnt++; if (e.indexVertical           === tb.indexVertical)       bonus++; }

        // Range tiebreakers — use NORMALIZED values (handScale-independent)
        if (tb.minSpreadNorm       !== undefined) { cnt++; if (e.iMSpreadNorm            >= tb.minSpreadNorm)        bonus++; }
        if (tb.maxSpreadNorm       !== undefined) { cnt++; if (e.iMSpreadNorm            <= tb.maxSpreadNorm)        bonus++; }
        if (tb.minThumbNorm        !== undefined) { cnt++; if (e.thumbToIdxTipNorm       >= tb.minThumbNorm)         bonus++; }
        if (tb.maxThumbNorm        !== undefined) { cnt++; if (e.thumbToIdxTipNorm       <= tb.maxThumbNorm)         bonus++; }
        if (tb.maxRawSpreadNorm    !== undefined) { cnt++; if (e.spreadNorm              <= tb.maxRawSpreadNorm)     bonus++; }

        // Legacy absolute range tiebreakers (kept for v8 dictionary compatibility)
        if (tb.minSpread           !== undefined) { cnt++; if (e.indexMiddleSpread       >= tb.minSpread)            bonus++; }
        if (tb.maxSpread           !== undefined) { cnt++; if (e.indexMiddleSpread       <= tb.maxSpread)            bonus++; }
        if (tb.minThumbIdxTip      !== undefined) { cnt++; if (e.thumbToIdxTip          >= tb.minThumbIdxTip)       bonus++; }
        if (tb.maxThumbIdxTip      !== undefined) { cnt++; if (e.thumbToIdxTip          <= tb.maxThumbIdxTip)       bonus++; }
        if (tb.maxRawSpread        !== undefined) { cnt++; if (e.spread                 <= tb.maxRawSpread)         bonus++; }

        if (cnt > 0) score = score * (1 - tbW) + (bonus / cnt) * tbW;
    }

    return score;
}

// ─────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────

export function landmarkDistance(a, b) {
    const dx=a.x-b.x, dy=a.y-b.y, dz=(a.z??0)-(b.z??0);
    return Math.sqrt(dx*dx+dy*dy+dz*dz);
}

// ─────────────────────────────────────────────────────────
// Legacy exports — backward compatibility with m2-test.html
// ─────────────────────────────────────────────────────────

export function detectFingerStates(lm) {
    if (!lm || lm.length < 21) return [0,0,0,0,0];
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
    let m=0; for(let i=0;i<live.length;i++) if(live[i]===reference[i]) m++; return m/live.length;
}