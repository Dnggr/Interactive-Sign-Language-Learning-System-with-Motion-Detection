/*
  classifier.js — Gesture Classification Engine

  The brain of the gesture detection system.
  Receives raw landmark data from mediapipe.js and determines which sign is being made.
  Supports two detection strategies:

  ── STRATEGY 1: STATIC GESTURE DETECTION ──
  Used for: Alphabet A–Z and static word signs (e.g. "Yes", "No")

  Method — Geometric finger state analysis on a single frame:
  1. For each finger, determine if it is "extended", "bent", or "curled":
       Compare tip landmark y-coordinate vs. the pip (middle) joint y-coordinate.
       In MediaPipe coords, lower y = higher on screen.
       If tip.y < pip.y → finger is extended upward.
  2. Calculate the angle at key joints using arctangent / dot product math.
  3. Compare the resulting finger state fingerprint against entries in dictionary.js.
  4. Return the closest matching sign and a confidence score (0–100).

  ── STRATEGY 2: DYNAMIC GESTURE DETECTION ──
  Used for: Words and phrases with motion (e.g. "Hello", "Thank You", "Nice to meet you")

  Method — Keyframe state machine over a rolling frame buffer:
  1. Maintain a motionBuffer array storing the last 30 frames (~1 second at 30fps).
  2. Each frame, push the latest landmarks snapshot into the buffer.
  3. For each known dynamic sign, check if checkpoints are satisfied in sequence:
       Checkpoint 1: Is the hand in starting position? (e.g. flat near forehead)
       Checkpoint 2: Is the hand mid-motion? (e.g. moving outward)
       Checkpoint 3: Is the hand in end position? (e.g. flat facing camera)
  4. If all checkpoints detected within the time window → confirm the sign.

  Functions to export:

  - processGesture(landmarks, handedness)
      Main entry point called every frame by app.js.
      Runs both static and dynamic checks.
      Returns: { type: 'static'|'dynamic', sign: 'A'|'Hello'|null, confidence: 0–100 }
      Returns null if no confident match is found.

  - resetMotionBuffer()
      Clears the rolling frame buffer.
      Call this when switching lessons or when no hand is detected.

  Internal helpers (not exported):
  - checkStaticGestures(landmarks)  → { sign, confidence }
  - trackMotionPattern(landmarks)   → { sign, confidence } | null
  - isFingerExtended(landmarks, tipIdx, pipIdx) → boolean
  - getAngleBetweenPoints(a, b, c)  → angle in degrees
*/
/*
  classifier.js — Gesture Recognition Engine
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  Takes raw MediaPipe landmark coordinates and determines:
    1. Which finger states are active (extended or folded)
    2. Which sign in the dictionary best matches those states
    3. A confidence score (0–100)

  ── PURE MATH MODULE ──
  No DOM access. No drawing. No state mutation.
  Input: landmarks array → Output: { label, confidence, matched }

  ── MEDIAPIPE LANDMARK INDICES ──
  0  = Wrist
  1  = Thumb CMC   | 2  = Thumb MCP  | 3  = Thumb IP   | 4  = Thumb Tip
  5  = Index MCP   | 6  = Index PIP  | 7  = Index DIP  | 8  = Index Tip
  9  = Middle MCP  | 10 = Middle PIP | 11 = Middle DIP | 12 = Middle Tip
  13 = Ring MCP    | 14 = Ring PIP   | 15 = Ring DIP   | 16 = Ring Tip
  17 = Pinky MCP   | 18 = Pinky PIP  | 19 = Pinky DIP  | 20 = Pinky Tip
*/

import { SIGN_DICTIONARY } from './dictionary.js';

// ─────────────────────────────────────────────────────────
// Landmark index constants (readability)
// ─────────────────────────────────────────────────────────
const WRIST       = 0;
const THUMB_CMC   = 1;
const THUMB_MCP   = 2;
const THUMB_TIP   = 4;
const INDEX_MCP   = 5;
const INDEX_TIP   = 8;
const MIDDLE_MCP  = 9;
const MIDDLE_TIP  = 12;
const RING_MCP    = 13;
const RING_TIP    = 16;
const PINKY_MCP   = 17;
const PINKY_TIP   = 20;

// Minimum confidence % to count as a valid match
const CONFIDENCE_THRESHOLD = 75;

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * Main classification function.
 * Called every frame by app.js with the dominant hand's 21 landmarks.
 *
 * @param {Array<{x:number, y:number, z:number}>} landmarks - 21 MediaPipe landmarks (0–1 normalized)
 * @returns {{ label: string|null, confidence: number, matched: boolean }}
 */
export function classifyGesture(landmarks) {
    if (!landmarks || landmarks.length < 21) {
        return { label: null, confidence: 0, matched: false };
    }

    // Step 1: Determine which fingers are extended
    const fingerStates = detectFingerStates(landmarks);

    // Step 2: Compare against every sign in the dictionary
    let bestLabel = null;
    let bestScore = 0;

    for (const [label, signData] of Object.entries(SIGN_DICTIONARY)) {
        const score = compareFingerStates(fingerStates, signData.fingerStates);
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
// Finger state detection
// ─────────────────────────────────────────────────────────

/**
 * Returns an array of 5 values indicating which fingers are extended.
 * Order: [thumb, index, middle, ring, pinky]
 * 1 = extended/open, 0 = folded/closed
 *
 * @param {Array<{x,y,z}>} lm - 21 MediaPipe landmarks
 * @returns {number[]} [thumb, index, middle, ring, pinky]
 */
export function detectFingerStates(lm) {
    return [
        isThumbExtended(lm),
        isFingerExtended(lm, INDEX_TIP,  INDEX_MCP),
        isFingerExtended(lm, MIDDLE_TIP, MIDDLE_MCP),
        isFingerExtended(lm, RING_TIP,   RING_MCP),
        isFingerExtended(lm, PINKY_TIP,  PINKY_MCP),
    ];
}

/**
 * Checks if a non-thumb finger is extended.
 *
 * Logic: In MediaPipe's coordinate system, Y increases downward (0 = top, 1 = bottom).
 * When a finger is extended (pointing up), the fingertip Y is SMALLER than the knuckle Y.
 * When folded, the tip curls below the knuckle so tip.y > mcp.y.
 *
 * @param {Array<{x,y,z}>} lm
 * @param {number} tipIdx   - Landmark index of fingertip
 * @param {number} mcpIdx   - Landmark index of knuckle base (MCP joint)
 * @returns {number} 1 if extended, 0 if folded
 */
export function isFingerExtended(lm, tipIdx, mcpIdx) {
    // tip.y < mcp.y means tip is HIGHER on screen (finger pointing up = extended)
    return lm[tipIdx].y < lm[mcpIdx].y ? 1 : 0;
}

/**
 * Checks if the thumb is extended.
 *
 * Logic: The thumb moves horizontally, not vertically, so we compare the X axis.
 * The thumb tip should be farther from the wrist than the thumb MCP joint.
 * We also check that it extends outward away from the palm center.
 *
 * @param {Array<{x,y,z}>} lm
 * @returns {number} 1 if extended, 0 if tucked
 */
export function isThumbExtended(lm) {
    const tipX  = lm[THUMB_TIP].x;
    const mcpX  = lm[THUMB_MCP].x;
    const wristX = lm[WRIST].x;

    // Distance from wrist to tip vs wrist to MCP
    const tipDist = Math.abs(tipX - wristX);
    const mcpDist = Math.abs(mcpX - wristX);

    // Thumb is extended when tip is significantly farther from wrist than MCP
    return tipDist > mcpDist * 1.3 ? 1 : 0;
}

// ─────────────────────────────────────────────────────────
// Score calculation
// ─────────────────────────────────────────────────────────

/**
 * Compares live finger states against a reference pattern.
 * Returns a score from 0.0 (no match) to 1.0 (perfect match).
 *
 * @param {number[]} live      - Detected: [thumb, index, middle, ring, pinky]
 * @param {number[]} reference - Expected from SIGN_DICTIONARY
 * @returns {number} Score 0–1
 */
export function compareFingerStates(live, reference) {
    if (!reference || live.length !== reference.length) return 0;

    let matches = 0;
    for (let i = 0; i < live.length; i++) {
        if (live[i] === reference[i]) matches++;
    }
    return matches / live.length;
}

// ─────────────────────────────────────────────────────────
// Utility — Euclidean distance between two landmarks
// Available for future use (angle-based classification upgrade)
// ─────────────────────────────────────────────────────────

/**
 * @param {{x:number, y:number, z:number}} a
 * @param {{x:number, y:number, z:number}} b
 * @returns {number}
 */
export function landmarkDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z ?? 0) - (b.z ?? 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}