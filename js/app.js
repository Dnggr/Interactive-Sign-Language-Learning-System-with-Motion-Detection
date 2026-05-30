/*
  app.js — Core Application Controller (Entry Point for lesson.html)

  This is the main orchestrator loaded by lesson.html via <script type="module">.
  It connects all modules together but contains no business logic itself.

  Responsibilities:
  - Read the lessonId from the URL query parameter (?lessonId=lesson-1a)
  - Import and initialize the camera module (cameraUtils.js)
  - Import and initialize the MediaPipe tracking module (mediapipe.js)
  - Pass the webcam stream into MediaPipe for per-frame processing
  - On each processed frame, receive the landmarks array and:
      1. Send landmarks to renderer.js  → draw the skeleton overlay on canvas
      2. Send landmarks to classifier.js → detect the current gesture
      3. Pass the classifier result to feedback.js → update UI text and score
  - Listen for lesson mode (practice vs quiz) and current quiz prompt
    from curriculum.js and lessonData.js
  - Handle page unload event: stop camera, stop MediaPipe animation loop

  This file is the "wiring" — it connects inputs to outputs.
  No raw DOM manipulation or detection math should live here.
*/
