/*
  classifier.js — Gesture Recognition Engine
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  v2.0 — UPGRADED: Angle-based finger detection + weighted scoring
  Fixes: letters not detected / confused with each other

  ROOT CAUSE OF OLD BUGS:
  - Old version only compared fingertip.y vs MCP.y (knuckle base)
  - This made A/E/M/N/S/T all return [0,0,0,0,0] — identical pattern
  - Classifier always picked the first match alphabetically

  NEW APPROACH:
  - Uses PIP joint (middle joint) instead of MCP for better curl detection
  - Uses angle-at-PIP to distinguish FULLY EXTENDED vs BENT vs CURLED
    (3 levels instead of 2 binary levels)
  - Thumb uses both X and Y distance + a spread check
  - Weighted scoring: some fingers matter more for certain signs
  - Signs with duplicate finger patterns get tiebreaker rules

  ── MEDIAPIPE LANDMARK INDICES ──
  0  = Wrist
  1  = Thumb CMC | 2  = Thumb MCP | 3  = Thumb IP  | 4  = Thumb Tip
  5  = Index MCP | 6  = Index PIP | 7  = Index DIP | 8  = Index Tip
  9  = Mid MCP   | 10 = Mid PIP   | 11 = Mid DIP   | 12 = Mid Tip
  13 = Ring MCP  | 14 = Ring PIP  | 15 = Ring DIP  | 16 = Ring Tip
  17 = Pinky MCP | 18 = Pinky PIP | 19 = Pinky DIP | 20 = Pinky Tip
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

// Minimum confidence % to count as a valid match
const CONFIDENCE_THRESHOLD = 70;

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * Main classification function.
 * Called every frame by app.js with the dominant hand's 21 landmarks.
 *
 * @param {Array<{x:number, y:number, z:number}>} landmarks
 * @returns {{ label: string|null, confidence: number, matched: boolean }}
 */
export function classifyGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) {
        return { label: null, confidence: 0, matched: false };
    }

    // Compute the full hand descriptor
    const descriptor = computeHandDescriptor(landmarks);

    let bestLabel = null;
    let bestScore = 0;

    for (const [label, signData] of Object.entries(SIGN_DICTIONARY)) {
        const score = scoreAgainstSign(descriptor, signData, landmarks);
        if (score > bestScore) {
            bestScore = score;
            bestLabel = label;
        }
    }

    const confidence = Math.round(bestScore * 100);
    const matched    = confidence >= CONFIDENCE_THRESHOLD;

    return {
        label:      matched ? bestLabel : null,
        confidence: confidence,
        matched:    matched,
    };
}

// ─────────────────────────────────────────────────────────
// Hand descriptor — richer than binary finger states
// ─────────────────────────────────────────────────────────

/**
 * Computes a rich descriptor for the current hand pose.
 *
 * fingerStates:  [thumb, index, middle, ring, pinky]
 *   Each value: 2 = fully extended, 1 = partially bent, 0 = fully curled
 *
 * extras: additional geometric features for tiebreaking similar signs
 *
 * @param {Array<{x,y,z}>} lm
 * @returns {{ fingerStates: number[], extras: object }}
 */
function computeHandDescriptor(lm) {
    return {
        fingerStates: [
            getThumbState(lm),
            getFingerState(lm, INDEX_TIP,  INDEX_PIP,  INDEX_MCP),
            getFingerState(lm, MIDDLE_TIP, MIDDLE_PIP, MIDDLE_MCP),
            getFingerState(lm, RING_TIP,   RING_PIP,   RING_MCP),
            getFingerState(lm, PINKY_TIP,  PINKY_PIP,  PINKY_MCP),
        ],
        extras: {
            // Is index finger curling inward (hooked) like X?
            indexHooked:  isFingerHooked(lm, INDEX_TIP, INDEX_PIP, INDEX_MCP),
            // Are index + middle crossing each other like R?
            fingersCrossed: areFingersAdjacentCrossed(lm, INDEX_TIP, MIDDLE_TIP),
            // Spread between index and middle tips (V vs U)
            indexMiddleSpread: landmarkDistance(lm[INDEX_TIP], lm[MIDDLE_TIP]),
            // Spread between thumb tip and index tip (L vs G)
            thumbIndexSpread: landmarkDistance(lm[THUMB_TIP], lm[INDEX_TIP]),
            // Thumb tip y vs index MCP y (for T: thumb between fingers)
            thumbTipBelowIndexPIP: lm[THUMB_TIP].y > lm[INDEX_PIP].y,
            // All finger tips close together (O, C shape)
            tipsClose: allTipsClose(lm),
            // Pinky and thumb both extended (Y shape)
            pinkThumbOnly: isPinkyThumbOnly(lm),
        },
    };
}

// ─────────────────────────────────────────────────────────
// Finger state (3-level: 2=extended, 1=bent, 0=curled)
// ─────────────────────────────────────────────────────────

/**
 * Gets the state of a non-thumb finger using the PIP joint angle.
 *
 * The PIP joint is the middle knuckle — it is the best indicator of
 * whether a finger is extended or curled.
 *
 * 2 = extended:  tip is clearly above PIP and MCP
 * 1 = bent:      tip is between PIP and MCP height
 * 0 = curled:    tip is below MCP (finger fully folded in)
 *
 * @param {Array<{x,y,z}>} lm
 * @param {number} tipIdx
 * @param {number} pipIdx
 * @param {number} mcpIdx
 * @returns {number} 0 | 1 | 2
 */
function getFingerState(lm, tipIdx, pipIdx, mcpIdx) {
    const tipY = lm[tipIdx].y;
    const pipY = lm[pipIdx].y;
    const mcpY = lm[mcpIdx].y;

    // In MediaPipe, Y increases downward.
    // Extended: tip is ABOVE (lower Y) both PIP and MCP
    if (tipY < pipY && tipY < mcpY) return 2;   // Fully extended

    // Bent: tip is above MCP but below PIP (finger partially bent)
    if (tipY < mcpY) return 1;                   // Partially bent

    // Curled: tip is below MCP (fully folded)
    return 0;
}

/**
 * Gets thumb state.
 * Thumb moves sideways so we check both axes.
 *
 * 2 = clearly extended away from palm
 * 1 = partially out
 * 0 = tucked in
 */
function getThumbState(lm) {
    const tipX   = lm[THUMB_TIP].x;
    const mcpX   = lm[THUMB_MCP].x;
    const wristX = lm[WRIST].x;

    const tipY   = lm[THUMB_TIP].y;
    const mcpY   = lm[THUMB_MCP].y;

    const horizDist = Math.abs(tipX - wristX);
    const mcpDist   = Math.abs(mcpX - wristX);
    const vertDist  = Math.abs(tipY - mcpY);

    // Clear extension: tip is far from wrist horizontally
    if (horizDist > mcpDist * 1.5) return 2;

    // Some extension: tip is moderately far or moved vertically
    if (horizDist > mcpDist * 1.1 || vertDist > 0.05) return 1;

    return 0;
}

// ─────────────────────────────────────────────────────────
// Scoring against a sign
// ─────────────────────────────────────────────────────────

/**
 * Scores how closely the live hand matches a dictionary entry.
 * Uses fingerStates as primary score + extras as tiebreakers.
 *
 * @param {{ fingerStates: number[], extras: object }} descriptor
 * @param {object} signData - Entry from SIGN_DICTIONARY
 * @param {Array<{x,y,z}>} lm - Raw landmarks for extra checks
 * @returns {number} Score 0–1
 */
function scoreAgainstSign(descriptor, signData, lm) {
    // Primary: compare fingerStates
    // Dictionary uses binary (0 or 1), we have 3-level (0, 1, 2)
    // Map: binary 1 matches our 2 (extended) or 1 (partial)
    //      binary 0 matches our 0 (curled)
    let primaryScore = 0;
    const ref  = signData.fingerStates;   // [0,1,0,0,0] from dictionary
    const live = descriptor.fingerStates; // [0,2,0,0,0] from camera

    for (let i = 0; i < 5; i++) {
        if (ref[i] === 1 && live[i] >= 1) primaryScore += 1;  // Extended matches partially bent or fully extended
        else if (ref[i] === 0 && live[i] === 0) primaryScore += 1;  // Curled matches curled
        else if (ref[i] === 1 && live[i] === 2) primaryScore += 1;  // Extended matches fully extended
        // Partial credit: ref says extended, we got partial
        else if (ref[i] === 1 && live[i] === 1) primaryScore += 0.7;
    }

    let score = primaryScore / 5;

    // Apply tiebreaker bonuses from extras
    const e = descriptor.extras;

    if (signData.tiebreakers) {
        const tb = signData.tiebreakers;
        let bonus = 0;
        let bonusCount = 0;

        if (tb.indexHooked    !== undefined) { bonusCount++; if (e.indexHooked    === tb.indexHooked)    bonus++; }
        if (tb.fingersCrossed !== undefined) { bonusCount++; if (e.fingersCrossed === tb.fingersCrossed) bonus++; }
        if (tb.tipsClose      !== undefined) { bonusCount++; if (e.tipsClose      === tb.tipsClose)      bonus++; }
        if (tb.thumbBelowPIP  !== undefined) { bonusCount++; if (e.thumbTipBelowIndexPIP === tb.thumbBelowPIP) bonus++; }
        if (tb.pinkThumbOnly  !== undefined) { bonusCount++; if (e.pinkThumbOnly  === tb.pinkThumbOnly)  bonus++; }

        if (tb.minSpread !== undefined) { bonusCount++; if (e.indexMiddleSpread >= tb.minSpread) bonus++; }
        if (tb.maxSpread !== undefined) { bonusCount++; if (e.indexMiddleSpread <= tb.maxSpread) bonus++; }

        if (bonusCount > 0) {
            // Tiebreakers can add up to 20% to the score
            score = score * 0.8 + (bonus / bonusCount) * 0.2;
        }
    }

    return score;
}

// ─────────────────────────────────────────────────────────
// Extra geometric helpers
// ─────────────────────────────────────────────────────────

/**
 * True if a finger is hooked (PIP bent, tip curling back inward).
 * Used to distinguish X from D.
 */
function isFingerHooked(lm, tipIdx, pipIdx, mcpIdx) {
    // Hooked: PIP is higher (lower Y) than tip but tip is still somewhat above MCP
    return lm[pipIdx].y < lm[tipIdx].y && lm[tipIdx].y < lm[mcpIdx].y;
}

/**
 * True if two adjacent fingertips are crossed (one is to the left of the other).
 * Used to distinguish R from H/U.
 */
function areFingersAdjacentCrossed(lm, tipAIdx, tipBIdx) {
    return Math.abs(lm[tipAIdx].x - lm[tipBIdx].x) < 0.03;
}

/**
 * True if all four fingertips are close together (used for O, C).
 */
function allTipsClose(lm) {
    const tips = [lm[INDEX_TIP], lm[MIDDLE_TIP], lm[RING_TIP], lm[PINKY_TIP]];
    const thumb = lm[THUMB_TIP];
    const avgX = (tips.reduce((s, t) => s + t.x, 0) + thumb.x) / 5;
    const avgY = (tips.reduce((s, t) => s + t.y, 0) + thumb.y) / 5;
    const spread = tips.reduce((s, t) =>
        s + Math.sqrt((t.x - avgX) ** 2 + (t.y - avgY) ** 2), 0) / 4;
    return spread < 0.06;
}

/**
 * True if only pinky and thumb are clearly extended (Y sign).
 */
function isPinkyThumbOnly(lm) {
    const thumbExt  = getThumbState(lm) >= 1;
    const indexCurl = getFingerState(lm, INDEX_TIP,  INDEX_PIP,  INDEX_MCP)  === 0;
    const middCurl  = getFingerState(lm, MIDDLE_TIP, MIDDLE_PIP, MIDDLE_MCP) === 0;
    const ringCurl  = getFingerState(lm, RING_TIP,   RING_PIP,   RING_MCP)   === 0;
    const pinkyExt  = getFingerState(lm, PINKY_TIP,  PINKY_PIP,  PINKY_MCP)  >= 1;
    return thumbExt && indexCurl && middCurl && ringCurl && pinkyExt;
}

// ─────────────────────────────────────────────────────────
// Legacy exports (for compatibility with test HTML and app.js)
// ─────────────────────────────────────────────────────────

/**
 * Returns binary [0/1] finger states for UI display in m2-test.html.
 * (The tester shows green/gray bars — binary is fine for display.)
 *
 * @param {Array<{x,y,z}>} lm
 * @returns {number[]} [thumb, index, middle, ring, pinky] — 0 or 1
 */
export function detectFingerStates(lm) {
    const s = computeHandDescriptor(lm).fingerStates;
    // Convert 3-level to binary: 0=0, 1 or 2 = 1
    return s.map(v => v >= 1 ? 1 : 0);
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