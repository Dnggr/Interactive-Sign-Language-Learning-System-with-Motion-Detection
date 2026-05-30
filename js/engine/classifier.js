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
