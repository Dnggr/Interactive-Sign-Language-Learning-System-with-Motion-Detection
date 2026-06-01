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
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence:  0.5,
        minTrackingConfidence:      0.5,
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
        return { landmarks: [], handedness: [], dominantLandmarks: null };
    }
    lastVideoTime = videoElement.currentTime;

    // Run detection on the current video frame
    const result = handLandmarker.detectForVideo(videoElement, performance.now());

    const landmarks  = result.landmarks  ?? [];
    const handedness = result.handedness ?? [];

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
