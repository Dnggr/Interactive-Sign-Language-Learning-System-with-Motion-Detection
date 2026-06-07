/*
  dictionary.js — ASL Sign Language Reference Data
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  v7.0 — DATA-DRIVEN THRESHOLDS (from real m2-debug.html capture log)

  ══ KEY FIXES vs v5.1/v6.0 ══

  FIST GROUP [0,0,0,0,0]: A, E, M, N, S, T
  ──────────────────────────────────────────
  Old fix: thumbSideOfFist (Y comparison) — FAILED because A's thumb tip
  barely misses the threshold (tipΔIdxPIP = +0.004, not cleanly above).

  New fix: minThumbIdxTip / maxThumbIdxTip distance gates.
  From your real captures:
    A = 0.171  ← highest (thumb beside fist, away from index)
    N = 0.154
    M = 0.131
    T = 0.046  ← thumbBetweenFingers confirmed ✅
    S = 0.063  ← wrapped across front
    E = 0.029  ← all tips close

  Thresholds set with ~15% safety margin from your data:
    A → minThumbIdxTip:0.15  (A=0.171 ✅, N=0.154 borderline — see note)
    N → thumbBelowPIP:true + maxThumbIdxTip:0.16 + thumbWrapped:false
    M → thumbBelowPIP:true + maxThumbIdxTip:0.14 + thumbWrapped:false
    S → maxThumbIdxTip:0.09 + thumbWrapped:true
    T → thumbBetweenFingers:true (already confirmed working)
    E → maxThumbIdxTip:0.05 + tipsClose:true

  NOTE on A vs N: A=0.171 and N=0.154 are only 0.017 apart.
  If you still get confusion, slightly tuck your A thumb more clearly
  OR capture more samples and adjust minThumbIdxTip to 0.16.

  C vs OPEN HAND [1,1,1,1,1]:
  ────────────────────────────
  Old fix: thumbCurvedIn (tip-to-index distance) — partially worked but
  flat open hand could also pass because thumbCurvedIn threshold was loose.

  New fix: maxRawSpread gate.
  From your data: C spread = 0.0323 (fingers tightly arced in C shape).
  A flat open hand: spread > 0.08 (fingers splayed wide).
  maxRawSpread:0.07 for C — any spread above 0.07 fails C immediately.
  thumbCurvedIn kept as additional gate (confirmed C=0.143 < 0.387*0.65=0.251 ✅).

  ── DATA FORMAT ──
  fingerStates: [thumb, index, middle, ring, pinky]
    1 = extended/active, 0 = curled/inactive

  tbWeight: overrides default 0.28 tiebreaker weight.
    Use 0.50 for fist group — tiebreakers MUST dominate when fingerStates identical.

  disabled: true → classifier.js skips this entry entirely.
*/

export const SIGN_DICTIONARY = {

    // ══════════════════════════════════════════════════════════
    // LEVEL 1 — ASL ALPHABET (A–Z)
    // ══════════════════════════════════════════════════════════

    // ── Fist group [0,0,0,0,0]: A, E, M, N, S, T ──
    // tbWeight:0.50 — tiebreakers carry 50% of final score.
    // fingerStates are ALL identical so tiebreakers MUST win.

    'A': {
        fingerStates: [1, 0, 0, 0, 0],
        // Note: thumbState returns 1 (beside fist) for A using Y-chain logic.
        // This gives A a DIFFERENT fingerState from E/M/N/S/T [0,0,0,0,0].
        // Primary match already separates A. Tiebreaker adds safety.
        description:  'Fist with thumb resting beside the index finger knuckle',
        category:     'alphabet',
        imageFile:    'A.png',
        tbWeight:     0.45,
        // minThumbIdxTip:0.15 — A has 0.171 (thumb far from index tip = beside fist).
        // thumbSideOfFist kept as secondary check.
        tiebreakers:  { minThumbIdxTip: 0.13, thumbWrapped: false, thumbBelowPIP: false },
    },

    'E': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'All fingers curl down toward palm, thumb tucked under',
        category:     'alphabet',
        imageFile:    'E.png',
        tbWeight:     0.50,
        // E: all tips close (spread=0.038), thumbToIdxTip=0.029 (very small).
        tiebreakers:  { tipsClose: true, maxThumbIdxTip: 0.05, thumbWrapped: false },
    },

    'M': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Three fingers (index+middle+ring) folded down over tucked thumb',
        category:     'alphabet',
        imageFile:    'M.png',
        tbWeight:     0.50,
        // M: thumbBelowPIP=T, thumbToIdxTip=0.131, NOT wrapped, spread=0.0415.
        tiebreakers:  { thumbBelowPIP: true, maxThumbIdxTip: 0.14, thumbWrapped: false },
    },

    'N': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Index and middle fingers folded down over tucked thumb',
        category:     'alphabet',
        imageFile:    'N.png',
        tbWeight:     0.50,
        // N: thumbBelowPIP=T, thumbToIdxTip=0.154, NOT wrapped.
        // Range 0.14–0.16 separates N from M (below 0.14) and A (above 0.16).
        tiebreakers:  { thumbBelowPIP: true, minThumbIdxTip: 0.14, maxThumbIdxTip: 0.16, thumbWrapped: false },
    },

    'S': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist with thumb wrapped across front of all four curled fingers',
        category:     'alphabet',
        imageFile:    'S.png',
        tbWeight:     0.50,
        // S: thumbWrapped=T confirmed, thumbToIdxTip=0.063.
        tiebreakers:  { thumbWrapped: true, maxThumbIdxTip: 0.09, thumbBelowPIP: false },
    },

    'T': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist with thumb inserted between index and middle fingers',
        category:     'alphabet',
        imageFile:    'T.png',
        tbWeight:     0.50,
        // T: thumbBetweenFingers=T confirmed from data (between=T, thumbToIdxTip=0.046).
        tiebreakers:  { thumbBetweenFingers: true, maxThumbIdxTip: 0.07, thumbWrapped: false },
    },

    // ── B: four fingers up, thumb tucked [0,1,1,1,1] ──

    'B': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Four fingers straight up, thumb tucked flat across palm',
        category:     'alphabet',
        imageFile:    'B.png',
        // B data: thumbToIdxTip=0.311, spread=0.0885. No collision with C ([1,1,1,1,1]).
        tiebreakers:  { tipsClose: false },
    },

    // ── C and O: curved/open hand [1,1,1,1,1] ──

    'C': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers curve into a C shape — tips in arc, NOT touching',
        category:     'alphabet',
        imageFile:    'C.png',
        tbWeight:     0.50,
        // C data: spread=0.0323, thumbToIdxTip=0.143, handScale=0.387.
        // thumbCurvedIn = 0.143 < 0.387*0.65 = 0.251 ✅
        // maxRawSpread:0.07 — C has 0.032, flat open hand has >0.08. KEY SEPARATOR.
        tiebreakers:  { tipsClose: false, thumbCurvedIn: true, maxRawSpread: 0.07 },
    },

    'O': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers and thumb curve to touch tips, forming a closed O',
        category:     'alphabet',
        imageFile:    'O.png',
        tbWeight:     0.40,
        // O data: tipsClose=T (spread=0.013), thumbToIdxTip=0.049.
        tiebreakers:  { tipsClose: true, maxThumbIdxTip: 0.07 },
    },

    // ── Index-only group: D and X (Z disabled — motion sign) ──

    'D': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger points up, other fingers and thumb form a circle',
        category:     'alphabet',
        imageFile:    'D.png',
        // D data: thumbToIdxTip=0.378, curvedV6=F, spread=0.1338.
        tiebreakers:  { indexHooked: false },
    },

    'X': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger extended and hooked (bent at first joint)',
        category:     'alphabet',
        imageFile:    'X.png',
        // X data: thumbToIdxTip=0.222, indexHooked — curvedV6=F matches D but
        // indexHooked separates them.
        tiebreakers:  { indexHooked: true },
    },

    'Z': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger extended, draw a Z shape in the air (motion sign)',
        category:     'alphabet',
        imageFile:    'Z.png',
        disabled:     true,
        tiebreakers:  { indexHooked: false },
    },

    // ── Index+middle group: H, R, U, V ──
    // From data: R spread=0.2368, U spread=0.2439, V spread=0.2561, H should be <0.15.
    // fingersCrossed separates R. minSpread separates V from U/H.

    'H': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and held together, pointing sideways',
        category:     'alphabet',
        imageFile:    'H.png',
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.08 },
    },

    'R': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and crossed over each other',
        category:     'alphabet',
        imageFile:    'R.png',
        // R data: between=T, spread=0.2368 — fingersCrossed is the key separator.
        tiebreakers:  { fingersCrossed: true },
    },

    'U': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended straight up and held together',
        category:     'alphabet',
        imageFile:    'U.png',
        // U data: spread=0.2439 — similar to R/V but NOT crossed, NOT as wide as V.
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.23 },
    },

    'V': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and spread apart (V shape)',
        category:     'alphabet',
        imageFile:    'V.png',
        // V data: spread=0.2561, NOT crossed.
        tiebreakers:  { fingersCrossed: false, minSpread: 0.24 },
    },

    // ── Unique: F, G, I, J, K, L, P, Q, W, Y ──

    'F': {
        fingerStates: [1, 0, 1, 1, 1],
        description:  'Index and thumb form a circle, other three fingers extended up',
        category:     'alphabet',
        imageFile:    'F.png',
        // F data: unique fingerStates [1,0,1,1,1] — no collision.
    },

    'G': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Index and thumb point horizontally outward (sideways)',
        category:     'alphabet',
        imageFile:    'G.png',
        // G data: thumbBelowPIP=F. Q has thumbBelowPIP=T. Key separator.
        tiebreakers:  { thumbBelowPIP: false },
    },

    'I': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Only pinky finger extended straight up, all others folded',
        category:     'alphabet',
        imageFile:    'I.png',
        // I data: unique [0,0,0,0,1] among active signs (J disabled).
    },

    'J': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Pinky extended, draw a J shape in the air (motion sign)',
        category:     'alphabet',
        imageFile:    'J.png',
        disabled:     true,
    },

    'K': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Index up, middle up, thumb extended outward between them',
        category:     'alphabet',
        imageFile:    'K.png',
        // K data: thumbBelowPIP=F. P has thumbBelowPIP=T.
        tiebreakers:  { thumbBelowPIP: false },
    },

    'L': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Thumb and index extended at right angles (L-shape)',
        category:     'alphabet',
        imageFile:    'L.png',
        // L data: thumbBelowPIP=F, thumbToIdxTip=0.394.
        tiebreakers:  { thumbBelowPIP: false },
    },

    'P': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Like K but the whole hand is pointed downward',
        category:     'alphabet',
        imageFile:    'P.png',
        // P data: thumbBelowPIP=T (hand pointed down).
        tiebreakers:  { thumbBelowPIP: true },
    },

    'Q': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Like G but pointed downward — index and thumb point down',
        category:     'alphabet',
        imageFile:    'Q.png',
        // Q data: thumbBelowPIP=T, thumbToIdxMCP=0.267 (large — pointing down).
        tiebreakers:  { thumbBelowPIP: true },
    },

    'W': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'Index, middle, and ring fingers extended and spread apart',
        category:     'alphabet',
        imageFile:    'W.png',
        // W data: unique [0,1,1,1,0] — no active collision.
    },

    'Y': {
        fingerStates: [1, 0, 0, 0, 1],
        description:  'Thumb and pinky extended outward, all other fingers folded',
        category:     'alphabet',
        imageFile:    'Y.png',
        // Y data: sideY=T (unique — thumb clearly extended UP), pinkThumbOnly=T.
        tiebreakers:  { pinkThumbOnly: true },
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 2 — COMMON WORDS
    // Most are MOTION signs — disabled to prevent alphabet collisions.
    // ══════════════════════════════════════════════════════════

    'I LOVE YOU': {
        fingerStates: [1, 1, 0, 0, 1],
        description:  'Extend thumb, index, and pinky simultaneously (ILY handshape)',
        category:     'word',
        imageFile:    'i-love-you.png',
        // Unique fingerStates [1,1,0,0,1] — works statically, NOT disabled.
    },

    'HELLO': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open flat hand, touch forehead, wave outward (motion sign)',
        category:     'word',
        imageFile:    'hello.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'THANK YOU': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat open hand from chin, move forward and down (motion sign)',
        category:     'word',
        imageFile:    'thank-you.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'PLEASE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open hand, rub in circular motion on chest (motion sign)',
        category:     'word',
        imageFile:    'please.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'FOOD': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Pinch all fingertips to thumb, bring to lips twice (motion sign)',
        category:     'word',
        imageFile:    'food.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: true },
    },

    'GOOD MORNING': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand at chin moves forward and up in an arc (motion sign)',
        category:     'word',
        imageFile:    'good-morning.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'SORRY': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Closed fist, rub in circular motion on chest (motion sign)',
        category:     'word',
        imageFile:    'sorry.gif',
        disabled:     true,
    },

    'YES': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist nods forward and back (motion sign)',
        category:     'word',
        imageFile:    'yes.png',
        disabled:     true,
    },

    'NO': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers snap down to meet thumb twice (motion sign)',
        category:     'word',
        imageFile:    'no.png',
        disabled:     true,
        tiebreakers:  { fingersCrossed: false },
    },

    'MY NAME IS': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'H handshape taps on other H handshape twice (motion sign)',
        category:     'word',
        imageFile:    'my-name-is.gif',
        disabled:     true,
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.08 },
    },

    'HELP': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Thumbs-up hand rests on flat other palm, lift both upward (motion sign)',
        category:     'word',
        imageFile:    'help.gif',
        disabled:     true,
    },

    'WATER': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'W handshape (three middle fingers), tap on chin twice (motion sign)',
        category:     'word',
        imageFile:    'water.gif',
        disabled:     true,
    },

    'GOODBYE': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Fingers extended, fold down toward palm repeatedly (waving)',
        category:     'word',
        imageFile:    'goodbye.gif',
        disabled:     true,
    },

    'MOTHER': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open hand, thumb touches chin (motion sign)',
        category:     'word',
        imageFile:    'mother.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'FATHER': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open hand, thumb touches forehead (motion sign)',
        category:     'word',
        imageFile:    'father.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'FRIEND': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Hook index fingers together, then swap positions (motion sign)',
        category:     'word',
        imageFile:    'friend.gif',
        disabled:     true,
        tiebreakers:  { indexHooked: true },
    },

    'FAMILY': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'F handshape both hands, draw a circle outward (motion sign)',
        category:     'word',
        imageFile:    'family.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: true },
    },

    'SCHOOL': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Clap flat hand on flat hand twice (motion/two-hand sign)',
        category:     'word',
        imageFile:    'school.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'WORK': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'S-handshape, wrist taps on back of other S-handshape twice (motion sign)',
        category:     'word',
        imageFile:    'work.gif',
        disabled:     true,
    },

    'HOME': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Pinched hand touches cheek then moves to cheek again (motion sign)',
        category:     'word',
        imageFile:    'home.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: true },
    },

    'LOVE': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Cross arms over chest (hugging self gesture, motion sign)',
        category:     'word',
        imageFile:    'love.gif',
        disabled:     true,
    },

    'GOOD': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand touches chin, moves forward and places in other palm (motion sign)',
        category:     'word',
        imageFile:    'good.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'BAD': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand touches mouth, flips down away from face (motion sign)',
        category:     'word',
        imageFile:    'bad.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'WANT': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Both bent hands pull toward chest (motion sign)',
        category:     'word',
        imageFile:    'want.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'MORE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Pinched fingers tap together twice (motion sign)',
        category:     'word',
        imageFile:    'more.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: true },
    },

    'STOP': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Flat hand chops down onto palm of other flat hand (motion sign)',
        category:     'word',
        imageFile:    'stop.gif',
        disabled:     true,
    },

    'GO': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Both index fingers point forward and arc away from body (motion sign)',
        category:     'word',
        imageFile:    'go.gif',
        disabled:     true,
        tiebreakers:  { indexHooked: false },
    },

    'COME': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Both index fingers arc toward the body (motion sign)',
        category:     'word',
        imageFile:    'come.gif',
        disabled:     true,
        tiebreakers:  { indexHooked: false },
    },

    'WHERE': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger waggles side to side (motion sign)',
        category:     'word',
        imageFile:    'where.gif',
        disabled:     true,
        tiebreakers:  { indexHooked: false },
    },

    'WHY': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'Middle three fingers touch forehead, twist forward (motion sign)',
        category:     'word',
        imageFile:    'why.gif',
        disabled:     true,
    },

    'WHAT': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand brushes down across open other palm (motion sign)',
        category:     'word',
        imageFile:    'what.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'RESTROOM': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'R handshape shakes side to side (motion sign)',
        category:     'word',
        imageFile:    'restroom.gif',
        disabled:     true,
    },

    'HUNGRY': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'C-handshape moves down the chest (motion sign)',
        category:     'word',
        imageFile:    'hungry.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: true },
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 3 — PHRASES (all motion signs, all disabled)
    // ══════════════════════════════════════════════════════════

    'NICE TO MEET YOU': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand sweeps from center outward toward the other person (motion sign)',
        category:     'phrase',
        imageFile:    'nice-to-meet-you.gif',
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'HOW ARE YOU': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Bent hands face up, knuckles brush upward from center twice (motion sign)',
        category:     'phrase',
        imageFile:    'how-are-you.gif',
        disabled:     true,
        tiebreakers:  { fingersCrossed: false },
    },

    'WHERE IS': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger points and shakes side to side (motion sign)',
        category:     'phrase',
        imageFile:    'where-is.gif',
        disabled:     true,
        tiebreakers:  { indexHooked: false },
    },

    'I AM LEARNING': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Open hand at forehead, bring down to closed hand at chest (motion sign)',
        category:     'phrase',
        imageFile:    'i-am-learning.gif',
        disabled:     true,
    },

    'WHAT IS YOUR NAME': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'H hands tap twice, then point to the other person (motion sign)',
        category:     'phrase',
        imageFile:    'what-is-your-name.gif',
        disabled:     true,
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.08 },
    },

    // ══════════════════════════════════════════════════════════
    // CONTROL GESTURES (disabled — collide with alphabet)
    // ══════════════════════════════════════════════════════════

    'SPACE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open flat hand held still — inserts a space',
        category:     'control',
        imageFile:    null,
        disabled:     true,
        tiebreakers:  { tipsClose: false, pinkThumbOnly: false },
    },

    'BACKSPACE': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Closed fist held still — deletes the last character',
        category:     'control',
        imageFile:    null,
        disabled:     true,
    },
};

// ─────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────

export function getSignsByCategory(category) {
    return Object.entries(SIGN_DICTIONARY)
        .filter(([, data]) => data.category === category && !data.disabled)
        .map(([label]) => label);
}

export function getSignsByCategory_all(category) {
    return Object.entries(SIGN_DICTIONARY)
        .filter(([, data]) => data.category === category)
        .map(([label]) => label);
}

export function getSignData(label) {
    return SIGN_DICTIONARY[label] ?? null;
}

export function getAllSigns() {
    return Object.keys(SIGN_DICTIONARY);
}

export function getActiveSigns() {
    return Object.keys(SIGN_DICTIONARY).filter(k => !SIGN_DICTIONARY[k].disabled);
}