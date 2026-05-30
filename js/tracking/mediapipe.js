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
