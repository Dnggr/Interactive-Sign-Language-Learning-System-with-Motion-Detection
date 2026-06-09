/*
  classifier.js — Static Model Classifier (Path 3)
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  FIXES vs previous version:
  1. tf.tidy() wraps prediction so tensors never leak on error
  2. ILY dictionary key mapped correctly ('I LOVE YOU' in dictionary, 'ILY' from model)
  3. output tensor now disposed via tf.tidy (was disposed manually — unsafe on throw)
  4. isClassifierReady() also checks staticLabels (was only checking staticModel)
*/

// ── TF.JS LOAD ──────────────────────────────────────────────────────────────
// tf.min.js is a UMD bundle — it sets window.tf, not an ES export.
// We inject it as a script tag and wait for onload before grabbing window.tf.
await new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js';
  s.onload = resolve;
  s.onerror = () => reject(new Error('[classifier] Failed to load TensorFlow.js from CDN.'));
  document.head.appendChild(s);
});

const tf = window.tf;
if (!tf) throw new Error('[classifier] window.tf is undefined after script load.');

import { SIGN_DICTIONARY } from './dictionary.js';

// ── CONFIG ───────────────────────────────────────────────────────────────────
// These paths are relative to the project root (served by your local HTTP server).
// If you get a 404, verify: http://localhost:8080/asl_static_model/model.json
const MODEL_PATH      = '/asl_static_model/model.json';
const LABELS_PATH     = '/asl_static_model/labels.json';
const MATCH_THRESHOLD = 75;

// ── STATE ────────────────────────────────────────────────────────────────────
let staticModel  = null;
let staticLabels = null;   // { "0": "A", "1": "B", ..., "9": "ILY", ... }

// ── LOAD ─────────────────────────────────────────────────────────────────────
export async function loadModels() {
  console.log('[classifier] Loading static model...');

  try {
    staticModel = await tf.loadLayersModel(MODEL_PATH);
  } catch (e) {
    console.error('[classifier] Failed to load model.json:', e.message);
    console.error('[classifier] → Make sure asl_static_model/ folder is in your project root.');
    console.error('[classifier] → Verify: http://localhost:8080/asl_static_model/model.json');
    throw e;
  }

  try {
    const res   = await fetch(LABELS_PATH);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    staticLabels = await res.json();
  } catch (e) {
    console.error('[classifier] Failed to load labels.json:', e.message);
    console.error('[classifier] → Verify: http://localhost:8080/asl_static_model/labels.json');
    throw e;
  }

  console.log('[classifier] Model ready.');
  console.log('[classifier] Labels:', staticLabels);
}

export function isClassifierReady() {
  return staticModel !== null && staticLabels !== null;
}

// ── CLASSIFY ─────────────────────────────────────────────────────────────────
// Input:  Array<{x,y,z}> — exactly 21 landmarks (dominantLandmarks from mediapipe.js)
// Output: { label: string|null, confidence: number (0–100), matched: boolean }
export function classifyGesture(landmarks) {
  if (!staticModel || !staticLabels) {
    return { label: null, confidence: 0, matched: false };
  }
  if (!landmarks || landmarks.length !== 21) {
    return { label: null, confidence: 0, matched: false };
  }

  // Flatten 21 {x,y,z} landmarks → 63 numbers → tensor shape [1, 63]
  const flat  = landmarks.flatMap(p => [p.x, p.y, p.z]);
  const input = tf.tensor2d([flat]);   // shape: [1, 63]

  let rawLabel   = null;
  let confidence = 0;

  // tf.tidy() disposes all tensors created inside it, even on error.
  tf.tidy(() => {
    const output = staticModel.predict(input);   // shape: [1, n_classes]
    const probs  = Array.from(output.dataSync());
    const maxIdx = probs.indexOf(Math.max(...probs));
    confidence   = Math.round(probs[maxIdx] * 100);
    rawLabel     = staticLabels[String(maxIdx)] ?? null;
  });

  input.dispose();   // input was created outside tidy, dispose manually

  if (!rawLabel) {
    return { label: null, confidence: 0, matched: false };
  }

  // ── ILY KEY FIX ──────────────────────────────────────────────────────────
  // The trained model outputs the label "ILY".
  // The SIGN_DICTIONARY stores it under the key "I LOVE YOU".
  // We expose "ILY" to the outside world (test board, output text) because
  // that's what the model was trained on.
  // Dictionary validation uses the mapped key.
  const dictKey = rawLabel === 'ILY' ? 'I LOVE YOU' : rawLabel;
  const entry   = SIGN_DICTIONARY[dictKey];

  if (!entry || entry.disabled) {
    return { label: null, confidence: 0, matched: false };
  }

  return {
    label:      rawLabel,          // "ILY", "A", "B", etc. — what app.js / test board sees
    confidence,
    matched:    confidence >= MATCH_THRESHOLD,
  };
}

// ── UTILITIES ────────────────────────────────────────────────────────────────
export function landmarkDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Kept for backward compatibility — m2-test.html Tab 2 may reference these
export function detectFingerStates() { return [0, 0, 0, 0, 0]; }
export function resetClassifier()    {}