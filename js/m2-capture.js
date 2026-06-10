/**
 * m2-capture.js — Static & Motion Training Data Collection
 * Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine
 *
 * Used exclusively by m2-capture.html
 * Handles: webcam init, MediaPipe, static captures, motion sequence recording
 * Does NOT load the classifier model (not needed for data collection)
 */

import { HandLandmarker, FilesetResolver }
  from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/+esm';

// ══════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════

const STATIC_SIGNS = [
  'A','B','C','D','E','F','G','H','I','K',
  'L','M','N','O','P','Q','R','S','T','U',
  'V','W','X','Y','ILY'
];
const STATIC_TARGET = 150;

const MOTION_SIGNS = [
  'J','Z',
  'HELLO','THANK YOU','PLEASE','SORRY','YES','NO',
  'HELP','WATER','FOOD','MORE','STOP',
  'GOOD','BAD','MY NAME IS','HOW ARE YOU'
];
const MOTION_TARGET = 150;
let SEQ_FRAMES = 30;

// Max consecutive frames with no hand before auto-cancel
const DROPOUT_CANCEL_THRESHOLD = 10;

// ══════════════════════════════════════════════════════════
// MEDIAPIPE STATE
// ══════════════════════════════════════════════════════════

let handLandmarker   = null;
let lastVideoTime    = -1;
let currentLandmarks = null;

// ══════════════════════════════════════════════════════════
// STATIC CAPTURE STATE
// ══════════════════════════════════════════════════════════

let activeStaticSign = 'A';
let staticCaptures   = [];   // [{ label, landmarks:[63] }]
let staticRecentLog  = [];

// ══════════════════════════════════════════════════════════
// MOTION CAPTURE STATE
// ══════════════════════════════════════════════════════════

let activeMotionSign = 'HELLO';
let motionCaptures   = [];   // [{ label, sequence:[[63],...] }]
let motionRecentLog  = [];
let isRecording      = false;
let recordBuffer     = [];
let dropoutCount     = 0;    // consecutive no-hand frames while recording

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════

async function init() {
  try {
    setStatus('Requesting webcam…', '');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });

    const vStatic = document.getElementById('webcam-static');
    const vMotion = document.getElementById('webcam-motion');
    [vStatic, vMotion].forEach(v => { v.srcObject = stream; });

    await new Promise(r => { vStatic.onloadedmetadata = () => vStatic.play().then(r); });
    vMotion.play();

    const cStatic = document.getElementById('canvas-static');
    const cMotion = document.getElementById('canvas-motion');
    [cStatic, cMotion].forEach(c => {
      c.width  = vStatic.videoWidth;
      c.height = vStatic.videoHeight;
    });

    setStatus('Loading MediaPipe HandLandmarker model…', '');
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

    setStatus('✅ Ready — show your hand', 'ok');

    buildStaticProgressGrid();
    buildMotionProgressGrid();

    requestAnimationFrame(loop);

  } catch(e) {
    setStatus('❌ ' + e.message, 'err');
    console.error(e);
  }
}

function setStatus(msg, cls) {
  const el = document.getElementById('status-bar');
  el.textContent = msg;
  el.className = 'status-bar' + (cls ? ' ' + cls : '');
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

    const lms  = result.landmarks  ?? [];
    const hdns = result.handedness ?? [];

    const cStatic = document.getElementById('canvas-static');
    const cMotion = document.getElementById('canvas-motion');

    if (lms.length > 0) {
      // Draw skeleton on both canvases
      [cStatic, cMotion].forEach(c => {
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, c.width, c.height);
        lms.forEach(lm => drawSkeleton(ctx, lm, c.width, c.height));
      });

      currentLandmarks = pickDominantHand(lms, hdns);
      document.getElementById('hand-status').textContent =
        lms.length + ' hand' + (lms.length > 1 ? 's' : '') + ' detected';

      // ── MOTION RECORDING: good frame ──
      if (isRecording && currentLandmarks) {
        dropoutCount = 0; // reset dropout counter on a good frame
        const flat = currentLandmarks.flatMap(p => [p.x, p.y, p.z]);
        recordBuffer.push(flat);
        updateRecordingProgressUI();
        if (recordBuffer.length >= SEQ_FRAMES) {
          finishRecording();
        }
      }

    } else {
      // No hands detected
      currentLandmarks = null;
      [cStatic, cMotion].forEach(c => {
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
      });
      document.getElementById('hand-status').textContent = 'No hand detected';

      // ── MOTION RECORDING: dropout frame ──
      // Pause the buffer (don't push a bad zero-frame).
      // If hand is gone for too long, auto-cancel so bad data isn't saved.
      if (isRecording) {
        dropoutCount++;
        // Still update the UI so the bar doesn't freeze confusingly
        updateRecordingProgressUI();
        if (dropoutCount > DROPOUT_CANCEL_THRESHOLD) {
          cancelRecording('❌ Hand lost — try again');
        }
      }
    }
  }

  requestAnimationFrame(loop);
}

function pickDominantHand(landmarks, handedness) {
  if (!landmarks || landmarks.length === 0) return null;
  if (landmarks.length === 1) return landmarks[0];
  for (let i = 0; i < (handedness || []).length; i++) {
    const cat = (handedness[i]?.[0]?.categoryName) || '';
    if (cat === 'Left') return landmarks[i]; // mirrored: "Left" = user's right hand
  }
  return landmarks[0];
}

// ══════════════════════════════════════════════════════════
// TAB SWITCHING
// ══════════════════════════════════════════════════════════

window.switchTab = function(name) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'panel-' + name);
  });
};

// ══════════════════════════════════════════════════════════
// STATIC CAPTURE — TAB 1
// ══════════════════════════════════════════════════════════

function buildStaticProgressGrid() {
  const grid = document.getElementById('static-progress-grid');
  grid.innerHTML = '';
  STATIC_SIGNS.forEach(sign => {
    const cell = document.createElement('div');
    cell.className = 'sp-cell' + (sign === activeStaticSign ? ' active-sign' : '');
    cell.id = 'sp-cell-' + sign;
    cell.onclick = e => {
      if (e.target.classList.contains('sp-del')) return;
      setActiveStaticSign(sign);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'sp-del';
    delBtn.title = 'Delete captures for ' + sign;
    delBtn.textContent = '✕';
    delBtn.onclick = e => { e.stopPropagation(); deleteStaticCapture(sign); };

    cell.innerHTML = `
      <div class="sp-letter">${sign}</div>
      <div class="sp-count" id="sp-count-${sign}">0 / ${STATIC_TARGET}</div>
      <div class="sp-bar"><div class="sp-fill" id="sp-fill-${sign}" style="width:0%"></div></div>`;
    cell.appendChild(delBtn);
    grid.appendChild(cell);
  });
  updateStaticCountTable();
}

function setActiveStaticSign(sign) {
  activeStaticSign = sign;
  document.querySelectorAll('#static-progress-grid .sp-cell').forEach(c => c.classList.remove('active-sign'));
  const cell = document.getElementById('sp-cell-' + sign);
  if (cell) cell.classList.add('active-sign');
  document.getElementById('active-sign-display').textContent = sign;
  updateActiveStaticStrip();
}

function countStatic(sign) {
  return staticCaptures.filter(c => c.label === sign).length;
}

function updateActiveStaticStrip() {
  const n = countStatic(activeStaticSign);
  document.getElementById('active-sign-strip').textContent = `${activeStaticSign}: ${n} / ${STATIC_TARGET}`;
}

function updateStaticCell(sign) {
  const n       = countStatic(sign);
  const countEl = document.getElementById('sp-count-' + sign);
  const fillEl  = document.getElementById('sp-fill-'  + sign);
  const cell    = document.getElementById('sp-cell-'  + sign);
  if (countEl) countEl.textContent = `${n} / ${STATIC_TARGET}`;
  if (fillEl)  fillEl.style.width  = Math.min(100, Math.round((n / STATIC_TARGET) * 100)) + '%';
  if (cell)    cell.classList.toggle('done', n >= STATIC_TARGET);
}

function updateStaticCountTable() {
  const tbl = document.getElementById('static-count-table');
  tbl.innerHTML = STATIC_SIGNS.map(sign => {
    const n     = countStatic(sign);
    const done  = n >= STATIC_TARGET;
    const color = done ? 'var(--green)' : n > 0 ? 'var(--amber)' : 'var(--muted)';
    return `<div class="ct-row">
      <span style="color:${done ? 'var(--green)' : 'var(--muted)'}">${sign}</span>
      <span style="color:${color};font-weight:700">${n}</span>
    </div>`;
  }).join('');
}

function flashScreen(color) {
  const el = document.getElementById('capture-flash');
  el.style.background = color || 'var(--green)';
  el.className = 'capture-flash';
  void el.offsetWidth;
  el.classList.add('flash');
  setTimeout(() => el.className = 'capture-flash', 120);
}

function flashCell(id) {
  const cell = document.getElementById(id);
  if (!cell) return;
  cell.classList.remove('flash');
  void cell.offsetWidth;
  cell.classList.add('flash');
  setTimeout(() => cell.classList.remove('flash'), 280);
}

function addStaticMiniLog(sign, total) {
  const t  = new Date();
  const ts = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`;
  staticRecentLog.unshift({ sign, ts, total });
  if (staticRecentLog.length > 40) staticRecentLog.pop();
  document.getElementById('static-mini-log').innerHTML = staticRecentLog.map(e =>
    `<div class="ml-entry">
      <span class="ml-sign-badge">${e.sign}</span>
      <span style="color:var(--muted)">#${e.total}</span>
      <span class="ml-ts">${e.ts}</span>
    </div>`
  ).join('');
}

window.captureStatic = function() {
  const lm = currentLandmarks;
  if (!lm || lm.length !== 21) {
    const btn  = document.getElementById('btn-static-capture');
    const orig = btn.innerHTML;
    btn.innerHTML = '⚠️ &nbsp;No hand detected!';
    btn.style.borderColor = 'var(--red)';
    btn.style.color       = 'var(--red)';
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.style.borderColor = '';
      btn.style.color       = '';
    }, 900);
    return;
  }

  const flat = lm.flatMap(p => [p.x, p.y, p.z]);
  staticCaptures.push({ label: activeStaticSign, landmarks: flat });

  const total = staticCaptures.length;
  document.getElementById('static-total-count').textContent = total;
  updateStaticCell(activeStaticSign);
  updateActiveStaticStrip();
  updateStaticCountTable();
  flashScreen('var(--green)');
  flashCell('sp-cell-' + activeStaticSign);
  addStaticMiniLog(activeStaticSign, total);

  // Auto-advance when target reached
  const n = countStatic(activeStaticSign);
  if (n === STATIC_TARGET) {
    const idx = STATIC_SIGNS.indexOf(activeStaticSign);
    if (idx < STATIC_SIGNS.length - 1) {
      setTimeout(() => setActiveStaticSign(STATIC_SIGNS[idx + 1]), 400);
    }
  }
};

function deleteStaticCapture(sign) {
  const current = countStatic(sign);
  if (current === 0) { alert(`No captures for "${sign}" to delete.`); return; }
  const input = prompt(
    `Delete captures for "${sign}".\nCurrently: ${current}\nHow many to delete? (1–${current})`, '1'
  );
  if (input === null) return;
  const n = parseInt(input);
  if (isNaN(n) || n < 1 || n > current) { alert(`Enter a number between 1 and ${current}.`); return; }

  let removed = 0;
  for (let i = staticCaptures.length - 1; i >= 0 && removed < n; i--) {
    if (staticCaptures[i].label === sign) { staticCaptures.splice(i, 1); removed++; }
  }

  document.getElementById('static-total-count').textContent = staticCaptures.length;
  updateStaticCell(sign);
  updateActiveStaticStrip();
  updateStaticCountTable();

  staticRecentLog.unshift({ sign: `−${n}×${sign}`, ts: 'deleted', total: staticCaptures.length });
  if (staticRecentLog.length > 40) staticRecentLog.pop();
  document.getElementById('static-mini-log').innerHTML = staticRecentLog.map(e =>
    `<div class="ml-entry">
      <span class="ml-sign-badge" style="color:var(--red)">${e.sign}</span>
      <span style="color:var(--muted)">${e.total}</span>
      <span class="ml-ts">${e.ts}</span>
    </div>`
  ).join('');
}

window.exportStaticJSON = function() {
  if (staticCaptures.length === 0) { alert('No captures yet.'); return; }
  const blob = new Blob([JSON.stringify(staticCaptures, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'static_data.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

window.clearStaticData = function() {
  if (!confirm(`Clear all ${staticCaptures.length} captures? This cannot be undone.`)) return;
  staticCaptures  = [];
  staticRecentLog = [];
  document.getElementById('static-total-count').textContent = '0';
  document.getElementById('static-mini-log').innerHTML = 'No captures yet — show your hand and press Space…';
  STATIC_SIGNS.forEach(s => updateStaticCell(s));
  updateActiveStaticStrip();
  updateStaticCountTable();
};

// ══════════════════════════════════════════════════════════
// MOTION CAPTURE — TAB 2
// ══════════════════════════════════════════════════════════

function buildMotionProgressGrid() {
  const grid = document.getElementById('motion-progress-grid');
  grid.innerHTML = '';
  MOTION_SIGNS.forEach(sign => {
    const cell = document.createElement('div');
    cell.className = 'sp-cell' + (sign === activeMotionSign ? ' active-sign' : '');
    cell.id = 'mp-cell-' + sign;
    if (sign === activeMotionSign) cell.style.borderColor = 'var(--purple)';
    cell.onclick = e => {
      if (e.target.classList.contains('sp-del')) return;
      setActiveMotionSign(sign);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'sp-del';
    delBtn.title = 'Delete sequences for ' + sign;
    delBtn.textContent = '✕';
    delBtn.onclick = e => { e.stopPropagation(); deleteMotionCapture(sign); };

    cell.innerHTML = `
      <div class="sp-letter" style="font-size:10px;word-break:break-word;line-height:1.2">${sign}</div>
      <div class="sp-count" id="mp-count-${sign}">0 / ${MOTION_TARGET}</div>
      <div class="sp-bar"><div class="sp-fill" id="mp-fill-${sign}" style="width:0%;background:var(--purple)"></div></div>`;
    cell.appendChild(delBtn);
    grid.appendChild(cell);
  });
  updateMotionCountTable();
}

function setActiveMotionSign(sign) {
  activeMotionSign = sign;
  document.querySelectorAll('#motion-progress-grid .sp-cell').forEach(c => {
    c.classList.remove('active-sign');
    c.style.borderColor = '';
  });
  const cell = document.getElementById('mp-cell-' + sign);
  if (cell) { cell.classList.add('active-sign'); cell.style.borderColor = 'var(--purple)'; }
  document.getElementById('active-motion-display').textContent = sign;
  updateActiveMotionStrip();
}

function countMotion(sign) {
  return motionCaptures.filter(c => c.label === sign).length;
}

function updateActiveMotionStrip() {
  const n = countMotion(activeMotionSign);
  document.getElementById('active-motion-strip').textContent = `${activeMotionSign}: ${n} / ${MOTION_TARGET}`;
}

function updateMotionCell(sign) {
  const n       = countMotion(sign);
  const countEl = document.getElementById('mp-count-' + sign);
  const fillEl  = document.getElementById('mp-fill-'  + sign);
  const cell    = document.getElementById('mp-cell-'  + sign);
  if (countEl) countEl.textContent = `${n} / ${MOTION_TARGET}`;
  if (fillEl)  fillEl.style.width  = Math.min(100, Math.round((n / MOTION_TARGET) * 100)) + '%';
  if (cell)    cell.classList.toggle('done', n >= MOTION_TARGET);
}

function updateMotionCountTable() {
  const tbl = document.getElementById('motion-count-table');
  tbl.innerHTML = MOTION_SIGNS.map(sign => {
    const n     = countMotion(sign);
    const done  = n >= MOTION_TARGET;
    const color = done ? 'var(--purple)' : n > 0 ? 'var(--amber)' : 'var(--muted)';
    return `<div class="ct-row">
      <span style="color:${done ? 'var(--purple)' : 'var(--muted)'}">${sign}</span>
      <span style="color:${color};font-weight:700">${n}</span>
    </div>`;
  }).join('');
}

function updateRecordingProgressUI() {
  const n   = recordBuffer.length;
  const pct = Math.min(100, Math.round((n / SEQ_FRAMES) * 100));
  document.getElementById('rec-frame-count').textContent = n;
  document.getElementById('seq-bar').style.width = pct + '%';
  document.getElementById('rec-progress-wrap').style.display = 'block';
}

function resetRecordingUI() {
  const btn = document.getElementById('btn-motion-record');
  btn.classList.remove('recording');
  btn.innerHTML = '🎬 &nbsp;RECORD &nbsp;<span class="kbd">R</span>';
  document.getElementById('rec-progress-wrap').style.display = 'none';
  document.getElementById('seq-bar').style.width = '0%';
  document.getElementById('rec-frame-count').textContent = '0';
}

// ── Called when hand disappears for too long during recording ──
function cancelRecording(msg) {
  isRecording  = false;
  recordBuffer = [];
  dropoutCount = 0;

  resetRecordingUI();

  // Red screen flash
  flashScreen('var(--red)');

  // Show cancel message in the active-motion-display temporarily
  const disp = document.getElementById('active-motion-display');
  const orig  = disp.textContent;
  const origColor = disp.style.color;
  const origSize  = disp.style.fontSize;
  disp.textContent  = msg;
  disp.style.color  = 'var(--red)';
  disp.style.fontSize = '14px';
  setTimeout(() => {
    disp.textContent  = orig;
    disp.style.color  = origColor;
    disp.style.fontSize = origSize;
  }, 1600);
}

function finishRecording() {
  isRecording = false;
  dropoutCount = 0;
  const sequence = [...recordBuffer];
  recordBuffer = [];

  motionCaptures.push({ label: activeMotionSign, sequence });

  const total = motionCaptures.length;
  document.getElementById('motion-total-count').textContent = total;
  updateMotionCell(activeMotionSign);
  updateActiveMotionStrip();
  updateMotionCountTable();

  resetRecordingUI();
  flashScreen('var(--purple)');

  const t  = new Date();
  const ts = `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}:${t.getSeconds().toString().padStart(2,'0')}`;
  motionRecentLog.unshift({ sign: activeMotionSign, ts, total });
  if (motionRecentLog.length > 40) motionRecentLog.pop();
  document.getElementById('motion-mini-log').innerHTML = motionRecentLog.map(e =>
    `<div class="ml-entry">
      <span class="ml-sign-badge" style="color:var(--purple)">${e.sign}</span>
      <span style="color:var(--muted)">#${e.total}</span>
      <span class="ml-ts">${e.ts}</span>
    </div>`
  ).join('');

  // Auto-advance
  const n = countMotion(activeMotionSign);
  if (n === MOTION_TARGET) {
    const idx = MOTION_SIGNS.indexOf(activeMotionSign);
    if (idx < MOTION_SIGNS.length - 1) {
      setTimeout(() => setActiveMotionSign(MOTION_SIGNS[idx + 1]), 500);
    }
  }
}

window.recordMotion = function() {
  if (isRecording) {
    // Manual cancel by pressing R again
    cancelRecording('Recording cancelled');
    return;
  }

  isRecording  = true;
  recordBuffer = [];
  dropoutCount = 0;

  const btn = document.getElementById('btn-motion-record');
  btn.classList.add('recording');
  btn.innerHTML = '⏹ &nbsp;STOP RECORDING &nbsp;<span class="kbd">R</span>';
  document.getElementById('rec-target-frames').textContent = SEQ_FRAMES;
  document.getElementById('rec-frame-count').textContent   = '0';
  document.getElementById('seq-bar').style.width = '0%';
  document.getElementById('rec-progress-wrap').style.display = 'block';
};

function deleteMotionCapture(sign) {
  const current = countMotion(sign);
  if (current === 0) { alert(`No sequences for "${sign}" to delete.`); return; }
  const input = prompt(
    `Delete sequences for "${sign}".\nCurrently: ${current}\nHow many to delete? (1–${current})`, '1'
  );
  if (input === null) return;
  const n = parseInt(input);
  if (isNaN(n) || n < 1 || n > current) { alert(`Enter a number between 1 and ${current}.`); return; }

  let removed = 0;
  for (let i = motionCaptures.length - 1; i >= 0 && removed < n; i--) {
    if (motionCaptures[i].label === sign) { motionCaptures.splice(i, 1); removed++; }
  }

  document.getElementById('motion-total-count').textContent = motionCaptures.length;
  updateMotionCell(sign);
  updateActiveMotionStrip();
  updateMotionCountTable();

  motionRecentLog.unshift({ sign: `−${n}×${sign}`, ts: 'deleted', total: motionCaptures.length });
  if (motionRecentLog.length > 40) motionRecentLog.pop();
  document.getElementById('motion-mini-log').innerHTML = motionRecentLog.map(e =>
    `<div class="ml-entry">
      <span class="ml-sign-badge" style="color:var(--red)">${e.sign}</span>
      <span style="color:var(--muted)">${e.total}</span>
      <span class="ml-ts">${e.ts}</span>
    </div>`
  ).join('');
}

window.exportMotionJSON = function() {
  if (motionCaptures.length === 0) { alert('No sequences yet.'); return; }
  const blob = new Blob([JSON.stringify(motionCaptures, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sequence_data.json';
  a.click();
  URL.revokeObjectURL(a.href);
};

window.clearMotionData = function() {
  if (!confirm(`Clear all ${motionCaptures.length} sequences? This cannot be undone.`)) return;
  motionCaptures  = [];
  motionRecentLog = [];
  document.getElementById('motion-total-count').textContent = '0';
  document.getElementById('motion-mini-log').innerHTML = 'No sequences yet — press R to record…';
  MOTION_SIGNS.forEach(s => updateMotionCell(s));
  updateActiveMotionStrip();
  updateMotionCountTable();
};

window.updateFrameTarget = function(v) {
  SEQ_FRAMES = parseInt(v);
  document.getElementById('frames-val').textContent = v;
  document.getElementById('rec-target-frames').textContent = v;
};

// ══════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════

window.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const staticActive = document.getElementById('panel-static').classList.contains('active');
  const motionActive = document.getElementById('panel-motion').classList.contains('active');

  if (e.code === 'Space' && staticActive) {
    e.preventDefault();
    window.captureStatic();
  }

  if (e.code === 'KeyR' && motionActive) {
    e.preventDefault();
    window.recordMotion();
  }

  if (staticActive) {
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
      const idx = STATIC_SIGNS.indexOf(activeStaticSign);
      if (idx < STATIC_SIGNS.length - 1) setActiveStaticSign(STATIC_SIGNS[idx + 1]);
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
      const idx = STATIC_SIGNS.indexOf(activeStaticSign);
      if (idx > 0) setActiveStaticSign(STATIC_SIGNS[idx - 1]);
    }
  }

  if (motionActive) {
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
      const idx = MOTION_SIGNS.indexOf(activeMotionSign);
      if (idx < MOTION_SIGNS.length - 1) setActiveMotionSign(MOTION_SIGNS[idx + 1]);
    }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
      const idx = MOTION_SIGNS.indexOf(activeMotionSign);
      if (idx > 0) setActiveMotionSign(MOTION_SIGNS[idx - 1]);
    }
  }
});

// ══════════════════════════════════════════════════════════
// SKELETON DRAWING
// ══════════════════════════════════════════════════════════

const CONN = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17]
];

function drawSkeleton(ctx, lm, w, h) {
  ctx.strokeStyle = '#FFFFFF55';
  ctx.lineWidth   = 1.5;
  for (const [a, b] of CONN) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }
  for (let i = 0; i < 21; i++) {
    const tip = [4, 8, 12, 16, 20].includes(i);
    ctx.beginPath();
    ctx.arc(lm[i].x * w, lm[i].y * h, tip ? 6 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = tip ? '#FFFFFF' : '#00e5a0';
    ctx.fill();
  }
}

// ══════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════

init();