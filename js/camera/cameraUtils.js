/*
  cameraUtils.js — Webcam Streaming Setup Module

  Handles everything related to accessing and managing the device camera.
  This module has no knowledge of MediaPipe or gesture detection.

  Functions to export:

  - startCamera(videoElement, canvasElement)
      Requests webcam permission from the browser:
        navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
      Attaches the stream to the <video> element.
      Waits for video metadata to load, then syncs canvas dimensions to video size.
      Returns a Promise that resolves when the camera is ready to stream.

  - stopCamera(videoElement)
      Stops all active media tracks in the stream.
      This turns off the camera indicator light in the browser/OS.
      Should be called on page unload or when navigating away from lesson.html.

  Error handling:
  - NotAllowedError: user denied camera permission
      → Display a message: "Camera access is required to detect gestures."
  - NotFoundError: no camera device found
      → Display a message: "No webcam detected. Please connect a camera."
  - Any other error: show a generic fallback error message.

  NOTE: The visual mirror effect (scaleX -1) is handled by CSS in styles.css,
  not in this module. Do not flip coordinates here.
*/
