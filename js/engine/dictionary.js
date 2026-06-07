/*
  dictionary.js
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine
  v11.0 — BUG-2 (A tiebreaker) + BUG-3 (Q tiebreaker) FIXED

  ══ CHANGES vs v9.0 ══

  BUG-2 FIX — A's minThumbNorm tiebreaker replaced with thumbSideOfFist (CRITICAL)
    v9: tiebreakers: { minThumbNorm: 1.10, thumbWrapped: false, thumbBetweenFingers: false }
    v11: tiebreakers: { thumbSideOfFist: true, thumbWrapped: false, thumbBetweenFingers: false }

    Why minThumbNorm was wrong:
      thumbToIdxTip measures THUMB_TIP → INDEX_TIP. For letter A, INDEX_TIP is
      CURLED under the fist — its position is unstable depending on curl tightness
      and hand rotation. This distance is geometrically unreliable for A.

    Why thumbSideOfFist is better:
      It checks: THUMB_TIP.y < THUMB_CMC.y AND THUMB_TIP.y < INDEX_MCP.y
      These are relative Y comparisons — no scale needed, no normalization issues.
      TRUE when the thumb tip is HIGHER (lower Y value) than both the thumb base
      and the index knuckle. This is exactly the A pose.
      FALSE for S (thumb wraps across front at knuckle level).
      FALSE for T (thumb tucked between fingers, lower than knuckles).
      Already computed in classifier.js as extras.thumbSideOfFist.

  BUG-3 FIX — Q's tiebreaker strengthened with indexVertical:false (MEDIUM)
    v9: tiebreakers: { thumbBelowPIP: true }
    v11: tiebreakers: { thumbBelowPIP: true, indexVertical: false }

    Why thumbBelowPIP alone was insufficient:
      For A pose, the index finger is curled — INDEX_PIP drops down (higher Y value).
      THUMB_TIP for A is at knuckle level. These can easily satisfy thumbBelowPIP.
      Q was stealing score from A because its single tiebreaker passed for A pose.

    Why indexVertical:false fixes it:
      Q (pointing down) requires the index to point DOWNWARD or sideways.
      For A (fist), the index is curled — not pointing upward.
      indexVertical:false = index is NOT pointing straight up.
      This is correct for Q and correctly excludes it from matching A.
      (For A, indexVertical can go either way since the finger is curled, but
       adding this tiebreaker reduces Q's chance of beating A significantly.)

  ══ v9.0 FIXES PRESERVED (DO NOT REVERT) ══
  BUG-SCALE FIX: all distance tiebreakers use *Norm variants (handScale-normalized)
  CALIBRATED VALUES: A, E, M, N, S, T, C, O, U, V all tuned vs real hand data

  ══ CALIBRATED *Norm VALUES (using WRIST→MIDDLE_TIP handScale) ══
  A:  thumbToIdxTip/handScale ≈ 1.15–1.40  (thumb out beside fist — but we use thumbSideOfFist now)
  M:  thumbToIdxTip/handScale ≈ 0.85–1.10  (3 fingers over thumb)
  N:  thumbToIdxTip/handScale ≈ 0.90–1.15  (2 fingers over thumb)
  S:  thumbToIdxTip/handScale ≈ 0.40–0.65  (thumb across front)
  T:  thumbToIdxTip/handScale ≈ 0.28–0.48  (thumb between fingers)
  E:  thumbToIdxTip/handScale ≈ 0.18–0.35  (all tips close, thumb tucked)
  C:  spreadNorm              ≈ 0.16–0.28  (curved but not closed)
  O:  spreadNorm              ≈ 0.05–0.14  (all tips touching)
  U:  iMSpreadNorm            ≈ 0.10–0.22  (two fingers together up)
  V:  iMSpreadNorm            ≈ 0.23–0.42  (two fingers spread up)
*/

export const SIGN_DICTIONARY = {

    // ══════════════════════════════════════════════════════════
    // LEVEL 1 — ALPHABET
    // ══════════════════════════════════════════════════════════

    // ─── FIST GROUP ────────────────────────────────────────────
    // E,M,N,S,T all have fingerStates [0,0,0,0,0].
    // A has [1,0,0,0,0] (thumbState=1, beside fist).
    // All tbWeight:0.50 — tiebreakers carry 50% of the score.

    'A': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'Fist, thumb resting BESIDE index knuckle (not tucked under)',
        category:     'alphabet', imageFile: 'A.png', tbWeight: 0.50,
        // BUG-2 FIX: replaced minThumbNorm:1.10 with thumbSideOfFist:true.
        // thumbSideOfFist = THUMB_TIP.y < THUMB_CMC.y AND THUMB_TIP.y < INDEX_MCP.y
        // This is a pure relative comparison — scale-independent, robust at any distance.
        // thumbWrapped:false prevents S (wrapped thumb) from scoring here.
        // thumbBetweenFingers:false prevents T (thumb inserted) from scoring here.
        tiebreakers:  { thumbSideOfFist: true, thumbWrapped: false, thumbBetweenFingers: false },
    },

    'E': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'All fingers curl in toward palm, tips touching thumb which is tucked under',
        category:     'alphabet', imageFile: 'E.png', tbWeight: 0.50,
        // E: all tips very close (tipsClose:true), thumb deeply tucked (maxThumbNorm ≈ 0.38).
        tiebreakers:  { tipsClose: true, maxThumbNorm: 0.38, thumbBelowPIP: true, thumbWrapped: false },
    },

    'M': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Index, middle, ring fold over tucked thumb (3 fingers over thumb)',
        category:     'alphabet', imageFile: 'M.png', tbWeight: 0.50,
        // M: thumbBelowPIP:true (tucked under), moderate thumbNorm ≈ 0.85–1.10.
        tiebreakers:  { thumbBelowPIP: true, maxThumbNorm: 1.12, minThumbNorm: 0.82, thumbWrapped: false, thumbBetweenFingers: false },
    },

    'N': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Index and middle fold over tucked thumb (2 fingers over thumb)',
        category:     'alphabet', imageFile: 'N.png', tbWeight: 0.50,
        // N: thumbBelowPIP:true (tucked under), thumbNorm slightly above M ≈ 0.90–1.15.
        tiebreakers:  { thumbBelowPIP: true, minThumbNorm: 0.86, maxThumbNorm: 1.18, thumbWrapped: false },
    },

    'S': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist, thumb wraps ACROSS front of all curled fingers',
        category:     'alphabet', imageFile: 'S.png', tbWeight: 0.50,
        // S: thumbWrapped:true, thumbNorm ≈ 0.40–0.65 (thumb close to knuckles).
        tiebreakers:  { thumbWrapped: true, maxThumbNorm: 0.68, thumbBelowPIP: false },
    },

    'T': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist, thumb inserted BETWEEN index and middle fingers',
        category:     'alphabet', imageFile: 'T.png', tbWeight: 0.50,
        // T: thumbBetweenFingers:true, thumbNorm ≈ 0.28–0.48 (very close to index tip).
        tiebreakers:  { thumbBetweenFingers: true, maxThumbNorm: 0.52, thumbWrapped: false },
    },

    // ─── FOUR-FINGERS-UP ──────────────────────────────────────

    'B': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Four fingers straight up, thumb tucked flat across palm',
        category:     'alphabet', imageFile: 'B.png', tbWeight: 0.28,
        tiebreakers:  { tipsClose: false, thumbBelowPIP: false },
    },

    // ─── OPEN/CURVED HAND [1,1,1,1,1] ────────────────────────

    'C': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers curved into C arc — not touching, not fully open',
        category:     'alphabet', imageFile: 'C.png', tbWeight: 0.55,
        // C: spreadNorm ≈ 0.16–0.28 (curved, moderate spread).
        // thumbCurvedIn:true — thumb close to index tip relative to hand size.
        tiebreakers:  { tipsClose: false, thumbCurvedIn: true, maxRawSpreadNorm: 0.30 },
    },

    'O': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All finger tips and thumb curve to TOUCH, forming a closed O',
        category:     'alphabet', imageFile: 'O.png', tbWeight: 0.50,
        // O: tipsClose:true (spreadNorm < 0.38), thumbNorm very small ≈ < 0.40.
        tiebreakers:  { tipsClose: true, maxThumbNorm: 0.40 },
    },

    // ─── INDEX-ONLY [0,1,0,0,0] ───────────────────────────────

    'D': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index points straight UP, other fingers and thumb form a circle',
        category:     'alphabet', imageFile: 'D.png', tbWeight: 0.30,
        tiebreakers:  { indexHooked: false, indexVertical: true },
    },

    'X': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index extended but HOOKED/bent at first joint like a hook',
        category:     'alphabet', imageFile: 'X.png', tbWeight: 0.35,
        tiebreakers:  { indexHooked: true },
    },

    'Z': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index extended, draw Z in air — motion sign, DISABLED',
        category:     'alphabet', imageFile: 'Z.png', disabled: true,
    },

    // ─── INDEX+MIDDLE [0,1,1,0,0] ─────────────────────────────

    'H': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle extended together, pointing SIDEWAYS (horizontal)',
        category:     'alphabet', imageFile: 'H.png', tbWeight: 0.45,
        // indexVertical:false separates H (sideways) from U/V (upward).
        tiebreakers:  { fingersCrossed: false, indexVertical: false },
    },

    'R': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle extended and CROSSED over each other',
        category:     'alphabet', imageFile: 'R.png', tbWeight: 0.45,
        // R: fingersCrossed:true (tips very close in X).
        tiebreakers:  { fingersCrossed: true },
    },

    'U': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle extended straight UP, held TOGETHER',
        category:     'alphabet', imageFile: 'U.png', tbWeight: 0.45,
        // indexVertical:true + NOT crossed + narrow spread.
        tiebreakers:  { fingersCrossed: false, indexVertical: true, maxSpreadNorm: 0.23 },
    },

    'V': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle extended UP and SPREAD apart (peace sign)',
        category:     'alphabet', imageFile: 'V.png', tbWeight: 0.45,
        // indexVertical:true + NOT crossed + wide spread.
        tiebreakers:  { fingersCrossed: false, indexVertical: true, minSpreadNorm: 0.24 },
    },

    // ─── THUMB+INDEX [1,1,0,0,0] ──────────────────────────────

    'G': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Index and thumb point SIDEWAYS/horizontally outward',
        category:     'alphabet', imageFile: 'G.png', tbWeight: 0.45,
        // indexVertical:false separates G from L.
        tiebreakers:  { thumbBelowPIP: false, indexVertical: false },
    },

    'L': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Index points straight UP, thumb extends sideways — L shape',
        category:     'alphabet', imageFile: 'L.png', tbWeight: 0.45,
        // indexVertical:true separates L from G.
        tiebreakers:  { thumbBelowPIP: false, indexVertical: true },
    },

    'Q': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Like G but hand points DOWNWARD — index and thumb point down',
        category:     'alphabet', imageFile: 'Q.png', tbWeight: 0.40,
        // BUG-3 FIX: added indexVertical:false to Q's tiebreakers.
        // Q (pointing down) requires index is NOT pointing upward.
        // For A (fist with curled index), the index is curled — not vertical.
        // This extra check prevents Q from winning over A when A's former
        // minThumbNorm tiebreaker was failing (now fixed by BUG-2 fix anyway,
        // but keeping this makes Q's entry geometrically correct and more robust).
        tiebreakers:  { thumbBelowPIP: true, indexVertical: false },
    },

    // ─── THUMB+INDEX+MIDDLE [1,1,1,0,0] ──────────────────────

    'K': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Index up, middle up, thumb extended between them pointing forward/up',
        category:     'alphabet', imageFile: 'K.png', tbWeight: 0.35,
        tiebreakers:  { thumbBelowPIP: false },
    },

    'P': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Like K but entire hand tilted/pointed DOWNWARD',
        category:     'alphabet', imageFile: 'P.png', tbWeight: 0.35,
        tiebreakers:  { thumbBelowPIP: true },
    },

    // ─── UNIQUE PATTERNS ──────────────────────────────────────

    'F': {
        fingerStates: [1, 0, 1, 1, 1],
        description:  'Index and thumb form circle/OK, middle+ring+pinky extend up',
        category:     'alphabet', imageFile: 'F.png',
    },

    'I': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Only pinky extended straight up, all others in fist',
        category:     'alphabet', imageFile: 'I.png',
    },

    'J': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Pinky extended, draw J — motion sign, DISABLED',
        category:     'alphabet', imageFile: 'J.png', disabled: true,
    },

    'W': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'Index, middle, ring extended and spread (W / 3 fingers)',
        category:     'alphabet', imageFile: 'W.png',
    },

    'Y': {
        fingerStates: [1, 0, 0, 0, 1],
        description:  'Thumb and pinky extended outward (shaka), others folded',
        category:     'alphabet', imageFile: 'Y.png', tbWeight: 0.35,
        tiebreakers:  { pinkThumbOnly: true },
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 2 — WORDS
    // Active: I LOVE YOU only (unique fingerStates).
    // All others disabled — they collide with alphabet shapes.
    // They will be re-enabled via motion detection in a future sprint.
    // ══════════════════════════════════════════════════════════

    'I LOVE YOU': {
        fingerStates: [1, 1, 0, 0, 1],
        description:  'Thumb, index, and pinky extended simultaneously (ILY handshape)',
        category:     'word', imageFile: 'i-love-you.png',
    },

    'HELLO':        { fingerStates:[1,1,1,1,1], category:'word', imageFile:'hello.gif',        disabled:true },
    'THANK YOU':    { fingerStates:[1,1,1,1,1], category:'word', imageFile:'thank-you.gif',    disabled:true },
    'PLEASE':       { fingerStates:[1,1,1,1,1], category:'word', imageFile:'please.gif',       disabled:true },
    'FOOD':         { fingerStates:[1,1,1,1,1], category:'word', imageFile:'food.gif',         disabled:true },
    'GOOD MORNING': { fingerStates:[1,1,1,1,1], category:'word', imageFile:'good-morning.gif', disabled:true },
    'SORRY':        { fingerStates:[0,0,0,0,0], category:'word', imageFile:'sorry.gif',        disabled:true },
    'YES':          { fingerStates:[0,0,0,0,0], category:'word', imageFile:'yes.png',          disabled:true },
    'NO':           { fingerStates:[0,1,1,0,0], category:'word', imageFile:'no.png',           disabled:true },
    'MY NAME IS':   { fingerStates:[0,1,1,0,0], category:'word', imageFile:'my-name-is.gif',   disabled:true },
    'HELP':         { fingerStates:[1,1,1,0,0], category:'word', imageFile:'help.gif',         disabled:true },
    'WATER':        { fingerStates:[0,1,1,1,0], category:'word', imageFile:'water.gif',        disabled:true },
    'GOODBYE':      { fingerStates:[0,1,1,1,1], category:'word', imageFile:'goodbye.gif',      disabled:true },
    'MOTHER':       { fingerStates:[1,1,1,1,1], category:'word', imageFile:'mother.gif',       disabled:true },
    'FATHER':       { fingerStates:[1,1,1,1,1], category:'word', imageFile:'father.gif',       disabled:true },
    'FRIEND':       { fingerStates:[0,1,0,0,0], category:'word', imageFile:'friend.gif',       disabled:true },
    'FAMILY':       { fingerStates:[1,1,1,1,1], category:'word', imageFile:'family.gif',       disabled:true },
    'SCHOOL':       { fingerStates:[1,1,1,1,1], category:'word', imageFile:'school.gif',       disabled:true },
    'WORK':         { fingerStates:[0,0,0,0,0], category:'word', imageFile:'work.gif',         disabled:true },
    'HOME':         { fingerStates:[1,1,1,1,1], category:'word', imageFile:'home.gif',         disabled:true },
    'LOVE':         { fingerStates:[0,0,0,0,0], category:'word', imageFile:'love.gif',         disabled:true },
    'GOOD':         { fingerStates:[1,1,1,1,1], category:'word', imageFile:'good.gif',         disabled:true },
    'BAD':          { fingerStates:[1,1,1,1,1], category:'word', imageFile:'bad.gif',          disabled:true },
    'WANT':         { fingerStates:[1,1,1,1,1], category:'word', imageFile:'want.gif',         disabled:true },
    'MORE':         { fingerStates:[1,1,1,1,1], category:'word', imageFile:'more.gif',         disabled:true },
    'STOP':         { fingerStates:[0,1,1,1,1], category:'word', imageFile:'stop.gif',         disabled:true },
    'GO':           { fingerStates:[0,1,0,0,0], category:'word', imageFile:'go.gif',           disabled:true },
    'COME':         { fingerStates:[0,1,0,0,0], category:'word', imageFile:'come.gif',         disabled:true },
    'WHERE':        { fingerStates:[0,1,0,0,0], category:'word', imageFile:'where.gif',        disabled:true },
    'WHY':          { fingerStates:[0,1,1,1,0], category:'word', imageFile:'why.gif',          disabled:true },
    'WHAT':         { fingerStates:[1,1,1,1,1], category:'word', imageFile:'what.gif',         disabled:true },
    'RESTROOM':     { fingerStates:[1,1,0,0,0], category:'word', imageFile:'restroom.gif',     disabled:true },
    'HUNGRY':       { fingerStates:[1,1,1,1,1], category:'word', imageFile:'hungry.gif',       disabled:true },

    // ══════════════════════════════════════════════════════════
    // LEVEL 3 — PHRASES (all motion signs, all disabled)
    // ══════════════════════════════════════════════════════════
    'NICE TO MEET YOU':   { fingerStates:[1,1,1,1,1], category:'phrase', imageFile:'nice-to-meet-you.gif',  disabled:true },
    'HOW ARE YOU':        { fingerStates:[0,1,1,0,0], category:'phrase', imageFile:'how-are-you.gif',       disabled:true },
    'WHERE IS':           { fingerStates:[0,1,0,0,0], category:'phrase', imageFile:'where-is.gif',          disabled:true },
    'I AM LEARNING':      { fingerStates:[0,1,1,1,1], category:'phrase', imageFile:'i-am-learning.gif',     disabled:true },
    'WHAT IS YOUR NAME':  { fingerStates:[0,1,1,0,0], category:'phrase', imageFile:'what-is-your-name.gif', disabled:true },
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

export function getSignsByCategory(category) {
    return Object.entries(SIGN_DICTIONARY)
        .filter(([,d]) => d.category === category && !d.disabled)
        .map(([label]) => label);
}
export function getActiveSigns() {
    return Object.keys(SIGN_DICTIONARY).filter(k => !SIGN_DICTIONARY[k].disabled);
}
export function getSignData(label) { return SIGN_DICTIONARY[label] ?? null; }
export function getAllSigns()       { return Object.keys(SIGN_DICTIONARY); }