/*
  mediapipe.js — Google MediaPipe Hands Initialization and Frame Processing

  Wraps the MediaPipe Tasks-Vision library to detect hand landmarks.
  This module only extracts coordinates — it does NOT classify gestures.

  Dependency (loaded via CDN in lesson.html):
    https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm

  MediaPipe HandLandmarker settings to use:
    numHands: 2                          (support two-hand signs)
    minHandDetectionConfidence: 0.6
    minHandPresenceConfidence: 0.6
    minTrackingConfidence: 0.5
    runningMode: "VIDEO"                 (real-time stream, not static image)

  Functions to export:

  - initMediaPipe(videoElement, onResultsCallback)
      Loads the WASM model files from the CDN.
      Sets up the HandLandmarker with the settings above.
      Starts a requestAnimationFrame() loop that:
        1. Reads the current frame from the video element
        2. Calls handLandmarker.detectForVideo(videoElement, timestamp)
        3. Calls onResultsCallback(results) with the detection output
      Returns a Promise that resolves once the model is loaded and ready.

  - stopMediaPipe()
      Cancels the active requestAnimationFrame loop.
      Closes the HandLandmarker and frees WASM memory.

  The results object passed to onResultsCallback:
    results.landmarks       — Array of hands; each hand = 21 {x, y, z} points (normalized 0–1)
    results.worldLandmarks  — Same but in real-world metric coordinates (meters)
    results.handedness      — Array of { label: "Left"|"Right", score: 0–1 } per hand

  Landmark index reference:
    0: Wrist
    1–4: Thumb (CMC → tip)
    5–8: Index finger (MCP → tip)
    9–12: Middle finger
    13–16: Ring finger
    17–20: Pinky finger
*/

/*
  mediapipe.js — MediaPipe Hand Tracking Module
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  Loads the MediaPipe HandLandmarker model and extracts 21-point
  landmark coordinates from each webcam video frame.

  Returns raw landmark data ONLY.
  No drawing. No classification. No DOM updates.

  ── LANDMARK INDICES (0–20) ──
  0  = Wrist
  1–4  = Thumb   (CMC → Tip)
  5–8  = Index   (MCP → Tip)
  9–12 = Middle  (MCP → Tip)
  13–16= Ring    (MCP → Tip)
  17–20= Pinky   (MCP → Tip)

  ── FLICKER FIX (v1.1) ──
  Added landmark persistence buffer (GHOST_FRAMES = 5).
  When detection drops for ≤5 frames (e.g. brief occlusion or confidence dip),
  the last known landmarks are returned instead of null.
  This eliminates the "hands: 1 → 0 → 1 → 0" flickering on the counter.
*/

import {
    HandLandmarker,
    FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';

// ─────────────────────────────────────────────────────────
// Module state
// ─────────────────────────────────────────────────────────
let handLandmarker  = null;   // The loaded model instance
let lastVideoTime   = -1;     // Prevents reprocessing the same frame

// ── FLICKER FIX: persistence state ──
// How many consecutive empty frames to tolerate before clearing landmarks.
// At 30fps, 5 frames = ~167ms — long enough to smooth over brief occlusions
// but short enough that the user will never notice the hand "sticking".
const GHOST_FRAMES = 5;
let ghostCounter        = 0;          // Counts consecutive empty detection frames
let lastGoodLandmarks   = null;       // Last landmarks array when hands were found
let lastGoodHandedness  = null;       // Last handedness array when hands were found
let lastGoodDominant    = null;       // Last dominant hand landmarks when found

// ─────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────

/**
 * Loads the MediaPipe HandLandmarker model from CDN.
 * Must be called once (await it) before calling processFrame().
 *
 * @returns {Promise<void>}
 */
export async function initMediaPipe() {
    console.log('[mediapipe] Loading HandLandmarker model...');

    const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );

    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',   // Falls back to CPU automatically if GPU unavailable
        },
        runningMode:       'VIDEO',  // VIDEO mode: optimized for continuous webcam frames
        numHands:          2,        // Detect up to 2 hands

        // ── FLICKER FIX: raised from 0.5 → 0.7 / 0.7 / 0.6 ──
        // Lower values caused MediaPipe to drop and re-acquire the hand every few frames,
        // producing the flickering "hands: 1 → 0 → 1 → 0" pattern.
        // Higher thresholds mean MediaPipe only reports a hand when it is confident,
        // producing a stable lock instead of noisy on/off toggling.
        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence:  0.7,
        minTrackingConfidence:      0.6,
    });

    console.log('[mediapipe] HandLandmarker model ready.');
}

/**
 * Processes a single video frame and returns hand landmark data.
 * Called inside requestAnimationFrame loop in app.js.
 *
 * ── TWO-HAND DETECTION WITH RIGHT-HAND PRIORITY ──
 * MediaPipe returns all detected hands in an array.
 * This function sorts results so the dominant (right) hand is always first.
 * If only one hand is visible, that hand is returned regardless of which hand it is.
 *
 * ── FLICKER FIX: GHOST FRAME PERSISTENCE ──
 * When detection returns 0 hands for up to GHOST_FRAMES consecutive frames,
 * the last known landmarks are returned instead of null.
 * After GHOST_FRAMES empty frames in a row, we treat the hand as truly gone.
 *
 * @param {HTMLVideoElement} videoElement
 * @returns {{
 *   landmarks:   Array<Array<{x:number, y:number, z:number}>>,
 *   handedness:  Array<{categoryName: string, score: number}>,
 *   dominantLandmarks: Array<{x:number, y:number, z:number}> | null
 * }}
 */
export function processFrame(videoElement) {
    // Guard: model not loaded yet
    if (!handLandmarker) {
        return { landmarks: [], handedness: [], dominantLandmarks: null };
    }

    // Guard: same frame as last time — skip to avoid duplicate processing
    if (videoElement.currentTime === lastVideoTime) {
        // ── FLICKER FIX: return last good data on skipped frames too ──
        // Previously this returned empty arrays, which caused the hand counter
        // to flash 0 on every skipped/duplicate frame.
        return {
            landmarks:         lastGoodLandmarks  ?? [],
            handedness:        lastGoodHandedness ?? [],
            dominantLandmarks: lastGoodDominant,
        };
    }
    lastVideoTime = videoElement.currentTime;

    // Run detection on the current video frame
    const result = handLandmarker.detectForVideo(videoElement, performance.now());

    const landmarks  = result.landmarks  ?? [];
    const handedness = result.handedness ?? [];

    if (landmarks.length > 0) {
        // ── FLICKER FIX: hand found — reset ghost counter and cache results ──
        ghostCounter       = 0;
        lastGoodLandmarks  = landmarks;
        lastGoodHandedness = handedness;
        lastGoodDominant   = pickDominantHand(landmarks, handedness);

        return {
            landmarks,
            handedness,
            dominantLandmarks: lastGoodDominant,
        };
    }

    // ── FLICKER FIX: no hand detected this frame ──
    // Increment ghost counter. If within tolerance, return last known data.
    // This hides brief 1–5 frame dropout gaps from the rest of the pipeline.
    ghostCounter++;
    if (ghostCounter <= GHOST_FRAMES && lastGoodLandmarks) {
        return {
            landmarks:         lastGoodLandmarks,
            handedness:        lastGoodHandedness,
            dominantLandmarks: lastGoodDominant,
        };
    }

    // Hand is truly gone — clear cached state and return empty
    lastGoodLandmarks  = null;
    lastGoodHandedness = null;
    lastGoodDominant   = null;

    // ── RIGHT-HAND PRIORITY LOGIC ──
    // MediaPipe's handedness is mirrored because the webcam is mirrored.
    // "Left" reported by MediaPipe = the user's RIGHT hand on screen.
    // We prioritize the user's right (dominant) hand for classification.
    const dominantLandmarks = pickDominantHand(landmarks, handedness);

    return { landmarks, handedness, dominantLandmarks };
}

/**
 * Returns true if the model has been loaded and is ready.
 * @returns {boolean}
 */
export function isModelReady() {
    return handLandmarker !== null;
}

// ─────────────────────────────────────────────────────────
// Internal: dominant hand selection
// ─────────────────────────────────────────────────────────

/**
 * Picks the dominant (right) hand landmarks from the detection result.
 * Falls back to the first detected hand if no right hand is found.
 *
 * @param {Array} landmarks  - Array of hand landmark sets
 * @param {Array} handedness - Array of handedness objects from MediaPipe
 * @returns {Array<{x,y,z}> | null} 21 landmarks for the chosen hand, or null
 */
function pickDominantHand(landmarks, handedness) {
    if (!landmarks || landmarks.length === 0) return null;

    // Only one hand — just return it
    if (landmarks.length === 1) return landmarks[0];

    // Two hands — find the right hand
    // NOTE: MediaPipe reports "Left" for the user's right hand (mirrored webcam)
    for (let i = 0; i < handedness.length; i++) {
        const category = handedness[i]?.[0]?.categoryName ?? '';
        if (category === 'Left') {
            // This is the user's right (dominant) hand
            return landmarks[i];
        }
    }

    // Neither was clearly right — fall back to first detected hand
    return landmarks[0];
}