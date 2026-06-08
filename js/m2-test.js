/**
 * m2-test.js — Model Accuracy Tester
 * Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine
 *
 * Used exclusively by m2-test.html
 * Handles: webcam init, MediaPipe, TF.js model loading,
 *          4-tab UI: Static live test, Accuracy Audit, Quiz Mode, Raw Data
 *
 * Requires (served from project root):
 *   /asl_static_model/model.json
 *   /asl_static_model/labels.json
 *   /asl_static_model/group1-shard1of1.bin
 *
 * FIX LOG:
 *   - tf.io.fromMemory() was called with 3 positional args (wrong).
 *     Correct signature is tf.io.fromMemory({ modelTopology, weightsManifest, weightData }).
 *     The old call silently produced a broken IOHandler that tf.loadLayersModel() crashed on.
 *
 *   - probs[] was assigned inside tf.tidy() via side-effect, which is fragile.
 *     Restructured runClassifier() so probs is extracted cleanly outside tidy.
 *
 *   - DOMContentLoaded listener for the autolog toggle was unreliable when the
 *     module script executes after DOM parse. Replaced with a safe init-time hookup.
 */

import { HandLandmarker, FilesetResolver }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';

// tf comes from the UMD <script> tag in m2-test.html — it is a global, NOT an ES module.
// Do NOT attempt to import tf here. It is available as window.tf.

// ══════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════

const MATCH_THRESHOLD = 75;   // % minimum to count as matched
const AUTOLOG_HOLD_MS = 1000; // ms hand must hold before auto-log
const HARD_SIGNS      = ['M','N','S','T','A','U','V','R','I','K'];

// Signs that exist in labels.json (populated after model loads)
let ALL_SIGNS = [];

// ══════════════════════════════════════════════════════════
// MEDIAPIPE + TF.JS STATE
// ══════════════════════════════════════════════════════════

let handLandmarker    = null;
let staticModel       = null;
let labelsMap         = {};   // { "0": "A", "1": "B", ... }
let lastVideoTime     = -1;
let currentLandmarks  = null; // Array<{x,y,z}> | null — dominant hand, 21 pts
let frameCount        = 0;
let fpsLast           = performance.now();
let fpsCounter        = 0;
let allProbs          = [];   // last full probability array from model

// ══════════════════════════════════════════════════════════
// SKELETON DRAWING
// ══════════════════════════════════════════════════════════

const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawSkeleton(ctx, landmarks, w, h) {
  if (!landmarks || landmarks.length < 21) return;
  ctx.lineWidth   = 2;
  ctx.strokeStyle = 'rgba(0,229,160,0.75)';
  CONNECTIONS.forEach(([a, b]) => {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * w, landmarks[a].y * h);
    ctx.lineTo(landmarks[b].x * w, landmarks[b].y * h);
    ctx.stroke();
  });
  landmarks.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x * w, pt.y * h, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5a0';
    ctx.fill();
  });
}

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════

async function init() {
  try {
    setStatus('Requesting webcam…', 'loading');

    // ── Webcam ────────────────────────────────────────────
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });

    // Feed stream to all 4 tab video elements
    ['webcam-static','webcam-audit','webcam-quiz','webcam-raw'].forEach(id => {
      const v = document.getElementById(id);
      v.srcObject = stream;
    });

    const vMain = document.getElementById('webcam-static');
    await new Promise(r => { vMain.onloadedmetadata = () => vMain.play().then(r); });
    ['webcam-audit','webcam-quiz','webcam-raw'].forEach(id =>
      document.getElementById(id).play()
    );

    // Sync canvas sizes once video dimensions are known
    const syncCanvas = (videoId, canvasId) => {
      const v = document.getElementById(videoId);
      const c = document.getElementById(canvasId);
      c.width  = v.videoWidth;
      c.height = v.videoHeight;
    };
    syncCanvas('webcam-static', 'canvas-static');
    syncCanvas('webcam-audit',  'canvas-audit');
    syncCanvas('webcam-quiz',   'canvas-quiz');
    syncCanvas('webcam-raw',    'canvas-raw');

    // ── MediaPipe ─────────────────────────────────────────
    setStatus('Loading MediaPipe…', 'loading');
    setDot('mp-dot', 'loading');
    document.getElementById('mp-status-text').textContent = 'MediaPipe — loading…';

    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.7,
      minHandPresenceConfidence:  0.7,
      minTrackingConfidence:      0.6,
    });

    setDot('mp-dot', 'ok');
    document.getElementById('mp-status-text').style.color = 'var(--green)';
    document.getElementById('mp-status-text').textContent = 'MediaPipe — ready ✓';

    // ── TF.js model ───────────────────────────────────────
    setStatus('Loading TF.js model…', 'loading');
    setDot('model-dot', 'loading');
    document.getElementById('model-status-text').textContent = 'TF.js model — loading…';

    // Keras 3 names weights as "asl_static_model/dense/kernel" but TF.js 4.x
    // expects just "dense/kernel" — patch the manifest before loading.
    const modelJsonResp = await fetch('/asl_static_model/model.json');
    const modelJson     = await modelJsonResp.json();

    // Strip the "asl_static_model/" prefix from every weight name
    modelJson.weightsManifest.forEach(group => {
      group.weights.forEach(w => {
        w.name = w.name.replace(/^asl_static_model\//, '');
      });
    });

    // Fix Keras 3 InputLayer: rename "batch_shape" → "batchInputShape"
    modelJson.modelTopology.model_config.config.layers.forEach(layer => {
      if (layer.class_name === 'InputLayer' && layer.config.batch_shape) {
        layer.config.batchInputShape = layer.config.batch_shape;
        delete layer.config.batch_shape;
      }
    });

    const weightsResp   = await fetch('/asl_static_model/group1-shard1of1.bin');
    const weightsBuffer = await weightsResp.arrayBuffer();

    // ────────────────────────────────────────────────────────────────────────
    // FIX: tf.io.fromMemory() takes a SINGLE object, NOT 3 positional args.
    //
    // WRONG (old code):
    //   tf.io.fromMemory(modelJson.modelTopology, modelJson.weightsManifest, weightsBuffer)
    //
    // CORRECT:
    //   tf.io.fromMemory({
    //     modelTopology:    modelJson.modelTopology,
    //     weightsManifest:  modelJson.weightsManifest,
    //     weightData:       weightsBuffer        // ← key name is weightData, not weights
    //   })
    // ────────────────────────────────────────────────────────────────────────
    const modelArtifacts = tf.io.fromMemory({
      modelTopology:   modelJson.modelTopology,
      weightsManifest: modelJson.weightsManifest,
      weightData:      weightsBuffer
    });

    staticModel = await tf.loadLayersModel(modelArtifacts);

    setDot('model-dot', 'ok');
    document.getElementById('model-status-text').style.color = 'var(--green)';
    document.getElementById('model-status-text').textContent = 'TF.js model — ready ✓';

    // ── Labels ────────────────────────────────────────────
    setDot('labels-dot', 'loading');
    document.getElementById('labels-status-text').textContent = 'labels.json — loading…';

    const resp = await fetch('/asl_static_model/labels.json');
    labelsMap  = await resp.json();
    ALL_SIGNS  = Object.values(labelsMap).sort();

    setDot('labels-dot', 'ok');
    document.getElementById('labels-status-text').style.color = 'var(--green)';
    document.getElementById('labels-status-text').textContent =
      `labels.json — ${ALL_SIGNS.length} signs ✓`;

    // ── Build UI grids ────────────────────────────────────
    buildSignSelectorGrid();
    buildAuditSignGrid();

    // ── Wire up autolog toggle (safe — DOM is definitely ready by now) ────
    const toggle = document.getElementById('autolog-toggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        autologEnabled = toggle.checked;
        document.getElementById('autolog-label').textContent = toggle.checked ? 'ON' : 'OFF';
      });
    }

    setStatus('✅ All systems ready — show your hand', 'ok');
    document.getElementById('hand-status-pill').textContent = 'No hand';

    requestAnimationFrame(loop);

  } catch (e) {
    setStatus('❌ ' + e.message, 'err');
    console.error('[m2-test]', e);
  }
}

// ══════════════════════════════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════════════════════════════

function loop() {
  if (!handLandmarker) { requestAnimationFrame(loop); return; }

  const v = document.getElementById('webcam-static');
  if (v.currentTime !== lastVideoTime) {
    lastVideoTime = v.currentTime;
    const result  = handLandmarker.detectForVideo(v, performance.now());
    const lms     = result.landmarks  ?? [];
    const hdns    = result.handedness ?? [];

    frameCount++;
    fpsCounter++;
    const now = performance.now();
    if (now - fpsLast >= 1000) {
      document.getElementById('fps-pill').textContent = fpsCounter + ' fps';
      fpsCounter = 0;
      fpsLast    = now;
    }

    if (lms.length > 0) {
      currentLandmarks = pickDominantHand(lms, hdns);

      // Draw skeleton on every tab's canvas
      ['canvas-static','canvas-audit','canvas-quiz','canvas-raw'].forEach(id => {
        const c   = document.getElementById(id);
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        lms.forEach(lm => drawSkeleton(ctx, lm, c.width, c.height));
      });

      const plural = lms.length > 1 ? 's' : '';
      ['hand-status','hand-status-audit','hand-status-quiz','hand-status-raw'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = lms.length + ' hand' + plural + ' detected';
      });
      document.getElementById('hand-status-pill').textContent =
        lms.length + ' hand' + plural;

    } else {
      currentLandmarks = null;
      ['canvas-static','canvas-audit','canvas-quiz','canvas-raw'].forEach(id => {
        const c = document.getElementById(id);
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
      });
      ['hand-status','hand-status-audit','hand-status-quiz','hand-status-raw'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = 'No hand detected';
      });
      document.getElementById('hand-status-pill').textContent = 'No hand';
    }

    // Run classifier if model ready and hand present
    if (staticModel && currentLandmarks) {
      const { label, confidence, probs } = runClassifier(currentLandmarks);
      allProbs = probs;

      onStaticResult(label, confidence);
      onAuditResult(label, confidence);
      onQuizResult(label, confidence);
      onRawResult(currentLandmarks, probs);
    } else {
      if (!currentLandmarks) {
        onStaticResult(null, 0);
        onAuditResult(null, 0);
        onQuizResult(null, 0);
      }
      onRawResult(currentLandmarks, []);
    }
  }

  requestAnimationFrame(loop);
}

// ══════════════════════════════════════════════════════════
// CLASSIFIER — TF.js inference
// ══════════════════════════════════════════════════════════

function runClassifier(landmarks) {
  const flat  = landmarks.flatMap(p => [p.x, p.y, p.z]);
  const input = tf.tensor2d([flat]);   // shape [1, 63]

  // FIX: extract the output tensor BEFORE tf.tidy() disposes it.
  // tf.tidy() runs synchronously and disposes every tensor created inside it
  // after the callback returns. dataSync() is fine inside tidy, but assigning
  // to outer variables via side-effect is fragile. Cleaner approach below.
  const outputTensor = staticModel.predict(input);
  const rawProbs     = Array.from(outputTensor.dataSync());  // plain JS array — safe
  outputTensor.dispose();
  input.dispose();

  const maxIdx   = rawProbs.indexOf(Math.max(...rawProbs));
  const confidence = Math.round(rawProbs[maxIdx] * 100);
  const label      = labelsMap[String(maxIdx)] ?? null;

  return { label, confidence, probs: rawProbs };
}

// ══════════════════════════════════════════════════════════
// UTILITY
// ══════════════════════════════════════════════════════════

function pickDominantHand(landmarks, handedness) {
  if (!landmarks || landmarks.length === 0) return null;
  if (landmarks.length === 1) return landmarks[0];
  for (let i = 0; i < (handedness || []).length; i++) {
    const cat = (handedness[i]?.[0]?.categoryName) || '';
    if (cat === 'Left') return landmarks[i]; // mirrored: "Left" = user's right
  }
  return landmarks[0];
}

function setStatus(msg, cls) {
  const el = document.getElementById('status-bar');
  el.textContent = msg;
  el.className   = cls ? cls : '';
}

function setDot(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.background = state === 'ok'      ? 'var(--green)'
                      : state === 'loading' ? 'var(--amber)'
                      : 'var(--red)';
  el.style.animation  = state === 'loading' ? 'pulse 1s infinite' : 'none';
}

function confClass(pct) {
  return pct >= 75 ? 'high' : pct >= 50 ? 'mid' : 'low';
}

function confBarColor(pct) {
  return pct >= 75 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
}

// ══════════════════════════════════════════════════════════
// TAB SWITCHING
// ══════════════════════════════════════════════════════════

window.switchTab = function(name) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name)
  );
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('active', p.id === 'panel-' + name)
  );
};

// ══════════════════════════════════════════════════════════
// TAB 1 — STATIC MODEL LIVE TEST
// ══════════════════════════════════════════════════════════

let testMode          = 'any';    // 'any' | 'filter'
let testWatchSign     = null;
let autologEnabled    = true;
let autologTimer      = null;
let autologLastLabel  = null;
let liveLog           = [];

function buildSignSelectorGrid() {
  const grid = document.getElementById('sign-selector-grid');
  grid.innerHTML = '';
  ALL_SIGNS.forEach(sign => {
    const btn = document.createElement('button');
    btn.className   = 'sign-btn' + (sign === testWatchSign ? ' active' : '');
    btn.textContent = sign;
    btn.id          = 'sgrid-' + sign;
    btn.onclick     = () => setWatchSign(sign);
    grid.appendChild(btn);
  });
}

function setWatchSign(sign) {
  testWatchSign = sign;
  document.querySelectorAll('#sign-selector-grid .sign-btn').forEach(b =>
    b.classList.toggle('active', b.textContent === sign)
  );
}

window.setMode = function(mode) {
  testMode = mode;
  ['any','filter'].forEach(m => {
    document.getElementById('mode-' + m)
      ?.classList.toggle('active', m === mode);
  });
  const block = document.getElementById('sign-selector-block');
  if (block) block.style.display = mode === 'filter' ? 'block' : 'none';

  if (mode === 'filter' && !testWatchSign && ALL_SIGNS.length) {
    setWatchSign(ALL_SIGNS[0]);
  }
};

window.clearLog = function() {
  liveLog = [];
  document.getElementById('live-log-body').innerHTML =
    '<div class="empty-state">Auto-logged detections appear here</div>';
};

function onStaticResult(label, confidence) {
  const resultCard   = document.getElementById('result-card');
  const resultLabel  = document.getElementById('result-label');
  const resultConf   = document.getElementById('result-conf');
  const resultStatus = document.getElementById('result-status');
  const confBar      = document.getElementById('conf-bar');
  const liveDot      = document.getElementById('live-dot');

  if (!label) {
    resultCard.className    = 'result-card no-hand';
    resultLabel.className   = 'result-label no-match';
    resultLabel.textContent = '–';
    resultConf.textContent  = '0%';
    resultConf.className    = 'result-conf low';
    resultStatus.textContent = 'No hand detected';
    confBar.style.width      = '0%';
    confBar.style.background = 'var(--muted)';
    liveDot.style.background = 'var(--muted)';
    updateTop5([]);
    return;
  }

  const isWatched = testMode === 'any' || label === testWatchSign;
  const matched   = confidence >= MATCH_THRESHOLD && isWatched;

  resultCard.className    = matched ? 'result-card matched' : 'result-card';
  resultLabel.className   = matched ? 'result-label' : 'result-label unmatched';
  resultLabel.textContent = label;
  resultConf.textContent  = confidence + '%';
  resultConf.className    = 'result-conf ' + confClass(confidence);
  resultStatus.textContent = matched ? `Matched ≥${MATCH_THRESHOLD}%` : 'Low confidence';
  confBar.style.width      = confidence + '%';
  confBar.style.background = confBarColor(confidence);
  liveDot.style.background = matched ? 'var(--green)' : 'var(--muted)';

  updateTop5(allProbs);

  if (autologEnabled && matched) {
    if (autologLastLabel !== label) {
      autologLastLabel = label;
      clearTimeout(autologTimer);
      autologTimer = setTimeout(() => appendLiveLog(label, confidence), AUTOLOG_HOLD_MS);
    }
  } else {
    autologLastLabel = null;
    clearTimeout(autologTimer);
  }
}

function updateTop5(probs) {
  const body = document.getElementById('top5-body');
  if (!probs || probs.length === 0) {
    body.innerHTML = '<div class="empty-state">Show your hand to see predictions</div>';
    return;
  }

  const indexed = probs.map((p, i) => ({ i, p }));
  indexed.sort((a, b) => b.p - a.p);
  const top5 = indexed.slice(0, 5);

  body.innerHTML = top5.map((item, rank) => {
    const sign  = labelsMap[String(item.i)] ?? '?';
    const pct   = Math.round(item.p * 100);
    const isTop = rank === 0;
    return `
      <div class="top5-row${isTop ? ' winner' : ''}">
        <span class="top5-rank">#${rank + 1}</span>
        <span class="top5-sign${isTop ? ' winner-sign' : ''}">${sign}</span>
        <div class="top5-bar-wrap">
          <div class="top5-bar-fill${isTop ? ' top' : ''}" style="width:${pct}%"></div>
        </div>
        <span class="top5-pct">${pct}%</span>
      </div>`;
  }).join('');
}

function appendLiveLog(label, confidence) {
  const body = document.getElementById('live-log-body');
  const now  = new Date().toLocaleTimeString('en-US', { hour12: false });

  if (body.querySelector('.empty-state')) body.innerHTML = '';

  const row = document.createElement('div');
  row.className = 'live-log-row';
  row.style.cssText = 'display:flex;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid var(--border);font-size:12px;';
  row.innerHTML = `
    <span style="font-size:20px;font-weight:800;color:var(--green);min-width:40px;text-align:center">${label}</span>
    <span style="font-family:var(--font-mono);font-size:11px;color:${confBarColor(confidence)}">${confidence}%</span>
    <div style="flex:1;background:var(--border);border-radius:3px;height:4px;overflow:hidden">
      <div style="height:100%;width:${confidence}%;background:${confBarColor(confidence)};border-radius:3px"></div>
    </div>
    <span style="font-family:var(--font-mono);font-size:10px;color:var(--muted)">${now}</span>`;

  body.prepend(row);
  while (body.children.length > 50) body.removeChild(body.lastChild);
  liveLog.push({ label, confidence, time: now });
}

// ══════════════════════════════════════════════════════════
// TAB 2 — ACCURACY AUDIT
// ══════════════════════════════════════════════════════════

let auditSign         = null;
let auditData         = {};
let auditRunning      = false;
let auditTrialsTarget = 10;
let auditHoldTimer    = null;
let auditLastLabel    = null;
let auditTrialsDone   = 0;

function buildAuditSignGrid() {
  const grid = document.getElementById('audit-sign-grid');
  grid.innerHTML = '';
  ALL_SIGNS.forEach(sign => {
    const btn = document.createElement('button');
    btn.className   = 'sign-btn' + (sign === auditSign ? ' active' : '');
    btn.textContent = sign;
    btn.id          = 'agrid-' + sign;
    btn.onclick     = () => {
      auditSign = sign;
      document.querySelectorAll('#audit-sign-grid .sign-btn').forEach(b =>
        b.classList.toggle('active', b.textContent === sign)
      );
      document.getElementById('audit-current-sign').textContent = sign;
    };
    grid.appendChild(btn);
  });
}

window.startAuditSign = function() {
  if (!auditSign) { alert('Select a sign first'); return; }
  auditTrialsTarget = parseInt(document.getElementById('trials-slider').value);
  auditRunning      = true;
  auditTrialsDone   = 0;
  auditLastLabel    = null;
  clearTimeout(auditHoldTimer);

  if (!auditData[auditSign]) auditData[auditSign] = { trials: 0, correct: 0 };

  document.getElementById('audit-progress-text').textContent = `0 / ${auditTrialsTarget} trials`;
  document.getElementById('audit-progress-bar').style.width  = '0%';
};

window.resetAudit = function() {
  auditRunning    = false;
  auditData       = {};
  auditTrialsDone = 0;
  clearTimeout(auditHoldTimer);
  document.getElementById('audit-current-sign').textContent  = '–';
  document.getElementById('audit-progress-text').textContent = 'Idle';
  document.getElementById('audit-progress-bar').style.width  = '0%';
  document.getElementById('audit-table-body').innerHTML      =
    '<div class="empty-state">Select a sign and press Start Test</div>';
  document.getElementById('stat-overall').textContent  = '–';
  document.getElementById('stat-tested').textContent   = '0';
  document.getElementById('stat-passing').textContent  = '0';
  document.getElementById('stat-trials').textContent   = '0';
};

function onAuditResult(label, confidence) {
  if (!auditRunning || !auditSign || !label) return;

  if (label !== auditLastLabel) {
    auditLastLabel = label;
    clearTimeout(auditHoldTimer);
    auditHoldTimer = setTimeout(() => {
      if (!auditRunning) return;
      const entry = auditData[auditSign] || { trials: 0, correct: 0 };
      entry.trials++;
      if (label === auditSign && confidence >= MATCH_THRESHOLD) entry.correct++;
      auditData[auditSign] = entry;
      auditTrialsDone      = entry.trials;

      const pct = Math.round((auditTrialsDone / auditTrialsTarget) * 100);
      document.getElementById('audit-progress-text').textContent =
        `${auditTrialsDone} / ${auditTrialsTarget} trials`;
      document.getElementById('audit-progress-bar').style.width = pct + '%';

      refreshAuditTable();
      refreshAuditStats();

      if (auditTrialsDone >= auditTrialsTarget) {
        auditRunning = false;
        document.getElementById('audit-progress-text').textContent =
          `✅ Done — ${entry.correct}/${entry.trials} correct`;
      }
    }, 600);
  }
}

function refreshAuditTable() {
  const body = document.getElementById('audit-table-body');
  const keys = Object.keys(auditData).sort();
  if (keys.length === 0) {
    body.innerHTML = '<div class="empty-state">Select a sign and press Start Test</div>';
    return;
  }

  body.innerHTML = keys.map(sign => {
    const d   = auditData[sign];
    const acc = d.trials > 0 ? Math.round((d.correct / d.trials) * 100) : 0;
    const col = acc >= 80 ? 'var(--green)' : acc >= 60 ? 'var(--amber)' : 'var(--red)';
    return `
      <div style="display:grid;grid-template-columns:48px 60px 60px 64px 1fr;
                  align-items:center;gap:8px;padding:7px 14px;
                  border-bottom:1px solid var(--border);font-size:12px;">
        <span style="font-weight:700;color:var(--text)">${sign}</span>
        <span style="font-family:var(--font-mono);color:var(--muted)">${d.trials}</span>
        <span style="font-family:var(--font-mono);color:var(--muted)">${d.correct}</span>
        <span style="font-family:var(--font-mono);color:${col};font-weight:700">${acc}%</span>
        <div style="background:var(--border);border-radius:3px;height:6px;overflow:hidden">
          <div style="height:100%;width:${acc}%;background:${col};border-radius:3px;transition:width .3s"></div>
        </div>
      </div>`;
  }).join('');
}

function refreshAuditStats() {
  const keys = Object.keys(auditData);
  let totalT = 0, totalC = 0, passing = 0;
  keys.forEach(s => {
    const d = auditData[s];
    totalT += d.trials;
    totalC += d.correct;
    if (d.trials > 0 && Math.round((d.correct / d.trials) * 100) >= 80) passing++;
  });
  const overall = totalT > 0 ? Math.round((totalC / totalT) * 100) : 0;
  const col     = overall >= 80 ? 'var(--green)' : overall >= 60 ? 'var(--amber)' : 'var(--red)';

  document.getElementById('stat-overall').textContent  = totalT > 0 ? overall + '%' : '–';
  document.getElementById('stat-overall').style.color  = col;
  document.getElementById('stat-tested').textContent   = keys.length;
  document.getElementById('stat-passing').textContent  = passing;
  document.getElementById('stat-trials').textContent   = totalT;
}

window.exportAuditCSV = function() {
  const keys = Object.keys(auditData).sort();
  if (keys.length === 0) { alert('No audit data to export yet.'); return; }

  let csv = 'sign,trials,correct,accuracy_pct\n';
  keys.forEach(s => {
    const d   = auditData[s];
    const acc = d.trials > 0 ? Math.round((d.correct / d.trials) * 100) : 0;
    csv      += `${s},${d.trials},${d.correct},${acc}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'audit_results.csv' });
  a.click();
  URL.revokeObjectURL(url);
};

// ══════════════════════════════════════════════════════════
// TAB 3 — QUIZ MODE
// ══════════════════════════════════════════════════════════

let quizActive       = false;
let quizSet          = 'all';
let quizRounds       = 10;
let quizQueue        = [];
let quizIdx          = 0;
let quizCorrect      = 0;
let quizTotal        = 0;
let quizWaiting      = false;
let quizHoldTimer    = null;
let quizLastLabel    = null;
const QUIZ_HOLD_MS   = 1200;

window.setQuizSet = function(set) {
  quizSet = set;
  ['all','hard','alpha'].forEach(s => {
    document.getElementById('quiz-set-' + s)?.classList.toggle('active', s === set);
  });
};

window.startQuiz = function() {
  quizRounds = parseInt(document.getElementById('quiz-rounds-slider').value);

  let pool;
  if (quizSet === 'hard')       pool = ALL_SIGNS.filter(s => HARD_SIGNS.includes(s));
  else if (quizSet === 'alpha') pool = ALL_SIGNS.filter(s => s.length === 1);
  else                          pool = [...ALL_SIGNS];

  if (pool.length === 0) { alert('No signs available for this set.'); return; }

  quizQueue = [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  while (quizQueue.length < quizRounds) {
    quizQueue.push(...shuffled.sort(() => Math.random() - 0.5));
  }
  quizQueue   = quizQueue.slice(0, quizRounds);
  quizIdx     = 0;
  quizCorrect = 0;
  quizTotal   = 0;
  quizActive  = true;
  quizWaiting = false;

  document.getElementById('quiz-history-body').innerHTML =
    '<div class="empty-state">Quiz results appear here</div>';

  updateQuizScoreUI();
  showQuizSign();
};

function showQuizSign() {
  if (quizIdx >= quizQueue.length) { endQuiz(); return; }
  const sign = quizQueue[quizIdx];
  document.getElementById('quiz-prompt').textContent = sign;
  document.getElementById('quiz-hint').textContent   =
    HARD_SIGNS.includes(sign) ? '⚠ Tricky sign — take your time' : '';
  document.getElementById('quiz-next-btn').style.display = 'none';
  quizWaiting   = false;
  quizLastLabel = null;
  clearTimeout(quizHoldTimer);
  resetQuizResultCard();
}

function resetQuizResultCard() {
  document.getElementById('quiz-result-card').className    = 'result-card no-hand';
  document.getElementById('quiz-result-label').className   = 'result-label no-match';
  document.getElementById('quiz-result-label').textContent = '–';
  document.getElementById('quiz-result-conf').textContent  = '0%';
  document.getElementById('quiz-result-conf').className    = 'result-conf low';
  document.getElementById('quiz-result-status').textContent = 'Show your hand';
  document.getElementById('quiz-conf-bar').style.width      = '0%';
}

function onQuizResult(label, confidence) {
  if (!quizActive || quizWaiting || !label) {
    if (!label) resetQuizResultCard();
    return;
  }

  const target  = quizQueue[quizIdx];
  const matched = label === target && confidence >= MATCH_THRESHOLD;

  document.getElementById('quiz-result-card').className    = matched ? 'result-card matched' : 'result-card';
  document.getElementById('quiz-result-label').className   = matched ? 'result-label' : 'result-label unmatched';
  document.getElementById('quiz-result-label').textContent = label;
  document.getElementById('quiz-result-conf').textContent  = confidence + '%';
  document.getElementById('quiz-result-conf').className    = 'result-conf ' + confClass(confidence);
  document.getElementById('quiz-result-status').textContent =
    matched ? '✅ Correct! Hold it…' : label !== target ? `Showing ${label}, need ${target}` : 'Hold steady…';
  document.getElementById('quiz-conf-bar').style.width      = confidence + '%';
  document.getElementById('quiz-conf-bar').style.background = confBarColor(confidence);

  if (matched && label !== quizLastLabel) {
    quizLastLabel = label;
    clearTimeout(quizHoldTimer);
    quizHoldTimer = setTimeout(() => {
      if (!quizActive || quizWaiting) return;
      quizWaiting = true;
      quizCorrect++;
      quizTotal++;
      appendQuizHistory(target, label, confidence, true);
      updateQuizScoreUI();
      document.getElementById('quiz-result-status').textContent = '✅ Accepted!';
      document.getElementById('quiz-next-btn').style.display    = 'inline-flex';
      quizIdx++;
      if (quizIdx >= quizQueue.length) setTimeout(endQuiz, 1200);
    }, QUIZ_HOLD_MS);
  } else if (!matched) {
    quizLastLabel = null;
    clearTimeout(quizHoldTimer);
  }
}

window.skipQuizSign = function() {
  if (!quizActive) return;
  const target = quizQueue[quizIdx];
  quizTotal++;
  appendQuizHistory(target, '–', 0, false);
  updateQuizScoreUI();
  quizIdx++;
  clearTimeout(quizHoldTimer);
  quizLastLabel = null;
  if (quizIdx >= quizQueue.length) { endQuiz(); return; }
  showQuizSign();
};

window.nextQuizSign = function() {
  if (!quizActive) return;
  showQuizSign();
};

function endQuiz() {
  quizActive = false;
  const pct  = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  document.getElementById('quiz-prompt').textContent     = '🏁 Done';
  document.getElementById('quiz-hint').textContent       = `Final: ${quizCorrect}/${quizTotal} (${pct}%)`;
  document.getElementById('quiz-next-btn').style.display = 'none';
}

function updateQuizScoreUI() {
  const pct = quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : 0;
  document.getElementById('quiz-score').textContent     = `${quizCorrect} / ${quizTotal}`;
  document.getElementById('quiz-score-pct').textContent = quizTotal > 0 ? pct + '%' : '–';
}

function appendQuizHistory(target, detected, confidence, correct) {
  const body = document.getElementById('quiz-history-body');
  if (body.querySelector('.empty-state')) body.innerHTML = '';

  const icon = correct ? '✅' : '❌';
  const col  = correct ? 'var(--green)' : 'var(--red)';
  const row  = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;align-items:center;padding:7px 14px;border-bottom:1px solid var(--border);font-size:12px;';
  row.innerHTML = `
    <span style="font-size:16px">${icon}</span>
    <span style="font-weight:800;font-size:18px;color:var(--text);min-width:40px">${target}</span>
    <span style="font-family:var(--font-mono);font-size:11px;color:var(--muted)">→ ${detected}</span>
    <span style="font-family:var(--font-mono);font-size:11px;color:${col};margin-left:auto">${confidence}%</span>`;

  body.prepend(row);
  while (body.children.length > 60) body.removeChild(body.lastChild);
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && quizActive && quizWaiting) {
    e.preventDefault();
    nextQuizSign();
  }
  if (e.code === 'KeyF') {
    freezeLandmarks();
  }
});

// ══════════════════════════════════════════════════════════
// TAB 4 — RAW DATA
// ══════════════════════════════════════════════════════════

let frozenLandmarks = null;
let rawFrameCount   = 0;

function onRawResult(landmarks, probs) {
  rawFrameCount++;
  document.getElementById('raw-frame-count').textContent = 'frame ' + rawFrameCount;

  const lmsToShow = frozenLandmarks ?? landmarks;

  const lmTable = document.getElementById('raw-landmark-table');
  if (!lmsToShow) {
    lmTable.innerHTML = '<div class="empty-state">Show your hand to see raw landmark data</div>';
  } else if (!frozenLandmarks) {
    lmTable.innerHTML = lmsToShow.map((pt, i) => {
      const x = pt.x.toFixed(4);
      const y = pt.y.toFixed(4);
      const z = pt.z.toFixed(4);
      return `<div style="display:grid;grid-template-columns:24px 80px 80px 80px;gap:6px;
                           padding:3px 0;border-bottom:1px solid var(--border);color:var(--text-dim)">
                <span style="color:var(--muted)">${i}</span>
                <span>x: <span style="color:var(--blue)">${x}</span></span>
                <span>y: <span style="color:var(--purple)">${y}</span></span>
                <span>z: <span style="color:var(--amber)">${z}</span></span>
              </div>`;
    }).join('');
  }

  const probsBody = document.getElementById('raw-probs-body');
  if (!probs || probs.length === 0) {
    probsBody.innerHTML = '<div class="empty-state">Show your hand</div>';
    return;
  }

  const indexed = probs.map((p, i) => ({ i, p })).sort((a, b) => b.p - a.p);
  probsBody.innerHTML = indexed.map((item, rank) => {
    const sign  = labelsMap[String(item.i)] ?? '?';
    const pct   = (item.p * 100).toFixed(2);
    const isTop = rank === 0;
    const col   = isTop ? 'var(--green)' : 'var(--muted)';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 14px;
                        border-bottom:1px solid var(--border);">
              <span style="font-weight:700;width:36px;color:${col}">${sign}</span>
              <div style="flex:1;background:var(--border);border-radius:2px;height:4px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${col};border-radius:2px"></div>
              </div>
              <span style="width:52px;text-align:right;color:${col}">${pct}%</span>
            </div>`;
  }).join('');
}

window.freezeLandmarks = function() {
  if (!currentLandmarks) return;
  frozenLandmarks = currentLandmarks.map(p => ({ ...p }));

  const info = document.getElementById('freeze-info');
  info.style.color = 'var(--green)';
  info.textContent = `Frozen at frame ${rawFrameCount}. Click Clear to resume live.`;

  const lmTable = document.getElementById('raw-landmark-table');
  lmTable.innerHTML = frozenLandmarks.map((pt, i) => {
    const x = pt.x.toFixed(4);
    const y = pt.y.toFixed(4);
    const z = pt.z.toFixed(4);
    return `<div style="display:grid;grid-template-columns:24px 80px 80px 80px;gap:6px;
                         padding:3px 0;border-bottom:1px solid var(--border);color:var(--text-dim)">
              <span style="color:var(--muted)">${i}</span>
              <span>x: <span style="color:var(--blue)">${x}</span></span>
              <span>y: <span style="color:var(--purple)">${y}</span></span>
              <span>z: <span style="color:var(--amber)">${z}</span></span>
            </div>`;
  }).join('');
};

window.clearFreeze = function() {
  frozenLandmarks = null;
  const info = document.getElementById('freeze-info');
  info.style.color = 'var(--muted)';
  info.textContent = 'Freeze captures the current 63-value landmark array for inspection.';
};

// ══════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════

init();