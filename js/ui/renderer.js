/*
  renderer.js — Canvas Skeleton Drawing Module

  Draws the hand skeleton overlay on the <canvas> element in lesson.html.
  Only handles drawing — contains no detection or classification logic.

  Uses the HTML5 Canvas 2D API: ctx = canvas.getContext("2d")

  Bone connections to draw (MediaPipe hand skeleton):
  HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],          // Thumb
    [0,5],[5,6],[6,7],[7,8],          // Index finger
    [0,9],[9,10],[10,11],[11,12],     // Middle finger
    [0,13],[13,14],[14,15],[15,16],   // Ring finger
    [0,17],[17,18],[18,19],[19,20],   // Pinky finger
    [5,9],[9,13],[13,17]              // Palm connectors (knuckle row)
  ]

  Functions to export:

  - drawSkeleton(ctx, landmarks, canvasWidth, canvasHeight)
      Called every frame by app.js with the latest landmarks.
      Steps:
      1. ctx.clearRect(0, 0, canvasWidth, canvasHeight) — clear previous frame
      2. Scale landmark coordinates from normalized (0–1) to canvas pixels:
           pixelX = landmark.x * canvasWidth
           pixelY = landmark.y * canvasHeight
      3. Draw bone lines connecting each HAND_CONNECTIONS pair:
           ctx.beginPath() → ctx.moveTo() → ctx.lineTo() → ctx.stroke()
           Style: strokeStyle "#FFFFFFAA", lineWidth 2
      4. Draw joint dots at each of the 21 landmarks:
           ctx.arc(x, y, 4, 0, Math.PI * 2) → ctx.fill()
           Style: fillStyle "#34D399" (emerald green)
      5. Highlight fingertip landmarks (indices 4, 8, 12, 16, 20):
           Larger dot, radius 6, fillStyle "#FFFFFF"
      Supports drawing both hands if two are detected.

  - clearCanvas(ctx, canvasWidth, canvasHeight)
      Clears the entire canvas. Called when no hand is detected in the frame.

  NOTE: The CSS mirror (transform: scaleX(-1)) is applied to both the <video>
  and <canvas> elements in styles.css. Do NOT flip coordinates in JavaScript here.
*/
