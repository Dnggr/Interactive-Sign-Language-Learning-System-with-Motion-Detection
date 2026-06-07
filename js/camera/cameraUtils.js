/*
  cameraUtils.js — Webcam Streaming Setup Module
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  Handles everything related to accessing and managing the device camera.
  This module has NO knowledge of MediaPipe or gesture detection.
  Pure camera input only.
*/

/**
 * Starts the webcam stream and attaches it to the <video> element.
 * Syncs the <canvas> dimensions to match the video size.
 *
 * @param {HTMLVideoElement} videoElement   - The <video id="webcam"> element
 * @param {HTMLCanvasElement} canvasElement - The <canvas id="output_canvas"> element
 * @returns {Promise<void>} Resolves when stream is live and dimensions are set
 */
export async function startCamera(videoElement, canvasElement) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError('Your browser does not support camera access. Please use Chrome or Edge.');
        throw new Error('getUserMedia not supported');
    }

    const constraints = {
        video: {
            width:      { ideal: 1280 },
            height:     { ideal: 720  },
            facingMode: 'user',          // Front-facing (selfie) camera
        },
        audio: false,
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;

        // Wait for the video to be fully ready before syncing canvas
        await new Promise((resolve, reject) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play()
                    .then(() => {
                        // ── FLICKER FIX: only set canvas dimensions if they actually changed ──
                        // Setting canvas.width or canvas.height always clears the canvas context,
                        // even if the value is the same. Guarding here prevents unnecessary wipes.
                        if (canvasElement.width  !== videoElement.videoWidth)  canvasElement.width  = videoElement.videoWidth;
                        if (canvasElement.height !== videoElement.videoHeight) canvasElement.height = videoElement.videoHeight;
                        resolve();
                    })
                    .catch(reject);
            };
            videoElement.onerror = reject;
        });

        console.log(
            `[cameraUtils] Camera ready: ${videoElement.videoWidth}x${videoElement.videoHeight}`
        );

    } catch (err) {
        handleCameraError(err);
        throw err; // Re-throw so app.js can catch it
    }
}

/**
 * Stops all active camera tracks and releases the hardware.
 * Call this on page unload to turn off the camera indicator light.
 *
 * @param {HTMLVideoElement} videoElement
 */
export function stopCamera(videoElement) {
    if (videoElement && videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
        console.log('[cameraUtils] Camera stopped.');
    }
}

// ─────────────────────────────────────────────────────────
// Internal error handler
// ─────────────────────────────────────────────────────────

function handleCameraError(err) {
    let message = '';

    switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
            message = 'Camera access was denied. Please allow camera permissions in your browser settings and reload the page.';
            break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
            message = 'No webcam detected. Please connect a camera and reload the page.';
            break;
        case 'NotReadableError':
        case 'TrackStartError':
            message = 'Your camera is already in use by another app. Please close it and try again.';
            break;
        case 'OverconstrainedError':
            message = 'Your camera does not support the required resolution. Trying fallback...';
            break;
        default:
            message = `Camera error: ${err.message || 'Unknown error'}. Please reload the page.`;
    }

    console.error('[cameraUtils]', err.name, err.message);
    showCameraError(message);
}

function showCameraError(message) {
    // Look for the camera status overlay defined in lesson.html
    const statusEl = document.getElementById('camera-status');
    if (statusEl) {
        statusEl.innerHTML = `
            <div style="text-align:center;padding:1rem;">
                <p style="color:#f87171;font-size:14px;margin:0;">⚠️ ${message}</p>
            </div>
        `;
    }
}