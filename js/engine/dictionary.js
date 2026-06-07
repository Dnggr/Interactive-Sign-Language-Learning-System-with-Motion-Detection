/*
  dictionary.js — ASL Sign Language Reference Data
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine
  v8.0 — SYSTEMATIC BUG FIXES

  ══ CHANGES vs v7.0 ══

  BUG 1 FIX — G vs L collision resolved:
    Both had [1,1,0,0,0] + thumbBelowPIP:false → identical scoring → G always won.
    FIX: indexVertical:true added to L (index points UP).
         indexVertical:false added to G (index points SIDEWAYS).
    The new indexVertical feature in classifier.js computes:
      (INDEX_MCP.y - INDEX_TIP.y) > 0.08
    L: index tip is well above index MCP → TRUE
    G: index tip is at roughly same height as MCP (pointing sideways) → FALSE

  BUG 2 FIX — A vs N distance overlap resolved:
    Old: A minThumbIdxTip:0.13, N range:0.14–0.16 → overlap at 0.14–0.16.
    FIX: A raised to minThumbIdxTip:0.17 (above N's max of 0.16).
    Also: A tbWeight raised to 0.50 — it's in the fist-adjacent group
    and needs tiebreakers to dominate since its fingerState [1,0,0,0,0]
    only differs from E/M/N/S/T in the thumb slot.

  BUG 3 FIX — H vs U/V separator:
    Old: H maxSpread:0.08 used indexMiddleSpread which was unreliable
    for sideways-pointing fingers.
    FIX: indexVertical:false added to H (pointing sideways).
         indexVertical:true added to U and V (pointing up).
    This is the clean physical separator — no threshold tuning needed.

  OTHER IMPROVEMENTS:
    - tbWeight adjusted per group based on collision risk
    - All entries have explicit comments explaining the physical gesture
    - Disabled signs cleaned up (no spurious tiebreakers needed)

  ── DATA FORMAT ──
  fingerStates: [thumb, index, middle, ring, pinky]
    1 = extended/active (dict uses 1; detector returns 0/1/2)
    0 = curled/inactive
  tbWeight: tiebreaker weight (0.0–1.0). Higher = tiebreakers dominate more.
  disabled: true → classifier.js skips this entry entirely.
*/

export const SIGN_DICTIONARY = {

    // ══════════════════════════════════════════════════════════
    // LEVEL 1 — ASL ALPHABET (A–Z)
    // ══════════════════════════════════════════════════════════

    // ─── FIST GROUP ───────────────────────────────────────────
    // A has [1,0,0,0,0] (thumb beside fist = thumbState:1).
    // E, M, N, S, T all have [0,0,0,0,0] (thumb fully tucked).
    // tbWeight:0.50 for all — tiebreakers must carry 50% of score.

    'A': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'Fist, thumb resting beside the index finger knuckle — thumb is UP beside the fist, not tucked',
        category:     'alphabet',
        imageFile:    'A.png',
        tbWeight:     0.50,
        // BUG 2 FIX: raised from 0.13 to 0.17 to clear above N's max of 0.16.
        // A thumbToIdxTip ≈ 0.171 — thumb sticks out beside fist, far from index tip.
        // thumbWrapped:false and thumbBetweenFingers:false prevent S/T from scoring here.
        tiebreakers:  { minThumbIdxTip: 0.17, thumbWrapped: false, thumbBetweenFingers: false },
    },

    'E': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'All fingers curl down toward palm, fingertips touching thumb which is tucked under',
        category:     'alphabet',
        imageFile:    'E.png',
        tbWeight:     0.50,
        // E: all tips close together (spread≈0.038), thumbToIdxTip very small (≈0.029).
        // thumbBelowPIP:true — thumb is tucked far under, below the index PIP joint.
        tiebreakers:  { tipsClose: true, maxThumbIdxTip: 0.06, thumbBelowPIP: true, thumbWrapped: false },
    },

    'M': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Index, middle, and ring fingers fold down over the tucked thumb',
        category:     'alphabet',
        imageFile:    'M.png',
        tbWeight:     0.50,
        // M: thumbBelowPIP:true (tucked under 3 fingers), thumbToIdxTip≈0.131.
        // maxThumbIdxTip:0.14 keeps it below N (0.14–0.16) and A (above 0.17).
        tiebreakers:  { thumbBelowPIP: true, maxThumbIdxTip: 0.14, thumbWrapped: false, thumbBetweenFingers: false },
    },

    'N': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Index and middle fingers fold down over the tucked thumb',
        category:     'alphabet',
        imageFile:    'N.png',
        tbWeight:     0.50,
        // N: thumbBelowPIP:true (tucked under 2 fingers), thumbToIdxTip≈0.154.
        // Range 0.14–0.16 separates N from M (below 0.14) and A (above 0.17).
        tiebreakers:  { thumbBelowPIP: true, minThumbIdxTip: 0.14, maxThumbIdxTip: 0.16, thumbWrapped: false },
    },

    'S': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist with thumb wrapped across the front of all four curled fingers',
        category:     'alphabet',
        imageFile:    'S.png',
        tbWeight:     0.50,
        // S: thumbWrapped:true (thumb across knuckles), thumbToIdxTip≈0.063.
        // thumbBelowPIP:false — thumb is NOT tucked under, it rests ON TOP of fingers.
        tiebreakers:  { thumbWrapped: true, maxThumbIdxTip: 0.10, thumbBelowPIP: false },
    },

    'T': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist with thumb inserted between index and middle fingers (thumb peeks through)',
        category:     'alphabet',
        imageFile:    'T.png',
        tbWeight:     0.50,
        // T: thumbBetweenFingers:true (thumb pushes between index and middle).
        // thumbToIdxTip≈0.046 (very small — thumb is very close to index tip).
        tiebreakers:  { thumbBetweenFingers: true, maxThumbIdxTip: 0.08, thumbWrapped: false },
    },

    // ─── FOUR-FINGERS-UP GROUP ────────────────────────────────

    'B': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Four fingers extended straight up, thumb tucked flat across the palm',
        category:     'alphabet',
        imageFile:    'B.png',
        tbWeight:     0.28,
        // B [0,1,1,1,1] — unique fingerStates, no collision with C [1,1,1,1,1].
        // thumbBelowPIP:false confirms thumb is tucked (not pointing down like a different pose).
        tiebreakers:  { tipsClose: false, thumbBelowPIP: false },
    },

    // ─── OPEN/CURVED HAND GROUP [1,1,1,1,1] ──────────────────

    'C': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers curved into a C arc — NOT touching, moderate gap between thumb and index',
        category:     'alphabet',
        imageFile:    'C.png',
        tbWeight:     0.55,
        // C: spread≈0.032 (fingers curved in tight arc, NOT splayed).
        // maxRawSpread:0.07 — flat open hand has spread>0.08, C has 0.032. KEY separator.
        // thumbCurvedIn:true — thumb tip close to index tip relative to hand size.
        // tipsClose:false — tips don't actually touch (that's O).
        tiebreakers:  { tipsClose: false, thumbCurvedIn: true, maxRawSpread: 0.07 },
    },

    'O': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers and thumb curve to touch at the tips, forming a closed O shape',
        category:     'alphabet',
        imageFile:    'O.png',
        tbWeight:     0.50,
        // O: tipsClose:true (spread≈0.013 — all tips touch).
        // thumbToIdxTip≈0.049 (thumb tip and index tip are touching).
        tiebreakers:  { tipsClose: true, maxThumbIdxTip: 0.08 },
    },

    // ─── INDEX-ONLY GROUP [0,1,0,0,0] ────────────────────────

    'D': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger points straight up, middle+ring+pinky curl, thumb touches middle fingertip forming a circle',
        category:     'alphabet',
        imageFile:    'D.png',
        tbWeight:     0.30,
        // D: indexHooked:false (index is straight, not bent forward).
        // indexVertical:true — index pointing UP.
        tiebreakers:  { indexHooked: false, indexVertical: true },
    },

    'X': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger extended but hooked/bent at the first joint (like a hook)',
        category:     'alphabet',
        imageFile:    'X.png',
        tbWeight:     0.35,
        // X: indexHooked:true — tip bends forward relative to PIP.
        tiebreakers:  { indexHooked: true },
    },

    'Z': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index extended, draw a Z shape in the air — motion sign, static detection disabled',
        category:     'alphabet',
        imageFile:    'Z.png',
        disabled:     true,
    },

    // ─── INDEX+MIDDLE GROUP [0,1,1,0,0] ──────────────────────

    'H': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended together, pointing SIDEWAYS (horizontal, not up)',
        category:     'alphabet',
        imageFile:    'H.png',
        tbWeight:     0.45,
        // BUG 3 FIX: indexVertical:false is the key separator.
        // H points SIDEWAYS — index tip is at roughly the same height as index MCP.
        // U and V point UP — index tip is well ABOVE index MCP.
        // fingersCrossed:false confirms fingers are side by side, not crossed.
        tiebreakers:  { fingersCrossed: false, indexVertical: false },
    },

    'R': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and crossed over each other',
        category:     'alphabet',
        imageFile:    'R.png',
        tbWeight:     0.45,
        // R: fingersCrossed:true is the unique separator.
        // Index tip and middle tip are very close in X (< 0.03 units apart).
        tiebreakers:  { fingersCrossed: true },
    },

    'U': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended straight UP and held together (touching)',
        category:     'alphabet',
        imageFile:    'U.png',
        tbWeight:     0.45,
        // BUG 3 FIX: indexVertical:true separates U from H (sideways).
        // NOT crossed (distinguishes from R).
        // Fingers held together (maxSpread:0.20 — close, not V-spread).
        tiebreakers:  { fingersCrossed: false, indexVertical: true, maxSpread: 0.20 },
    },

    'V': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended UP and spread apart (peace sign / V shape)',
        category:     'alphabet',
        imageFile:    'V.png',
        tbWeight:     0.45,
        // BUG 3 FIX: indexVertical:true separates V from H (sideways).
        // NOT crossed. WIDE spread (minSpread:0.21 — fingers splayed apart).
        tiebreakers:  { fingersCrossed: false, indexVertical: true, minSpread: 0.21 },
    },

    // ─── THUMB+INDEX GROUP [1,1,0,0,0] ───────────────────────

    'G': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Index and thumb extended and pointing SIDEWAYS/horizontally outward',
        category:     'alphabet',
        imageFile:    'G.png',
        tbWeight:     0.45,
        // BUG 1 FIX: indexVertical:false is the separator from L.
        // G points sideways — index tip at roughly same Y as index MCP.
        // thumbBelowPIP:false — thumb is not pointing down.
        tiebreakers:  { thumbBelowPIP: false, indexVertical: false },
    },

    'L': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Index points straight UP, thumb extends sideways — L shape at 90 degrees',
        category:     'alphabet',
        imageFile:    'L.png',
        tbWeight:     0.45,
        // BUG 1 FIX: indexVertical:true separates L from G.
        // L: index tip is well ABOVE index MCP (pointing up). G has index sideways.
        // thumbBelowPIP:false — thumb extends sideways, not downward.
        tiebreakers:  { thumbBelowPIP: false, indexVertical: true },
    },

    'Q': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Like G but entire hand points DOWNWARD — index and thumb point down',
        category:     'alphabet',
        imageFile:    'Q.png',
        tbWeight:     0.40,
        // Q: thumbBelowPIP:true — both index and thumb point downward.
        // This naturally separates Q from G and L (both have thumbBelowPIP:false).
        tiebreakers:  { thumbBelowPIP: true },
    },

    // ─── THUMB+INDEX+MIDDLE GROUP [1,1,1,0,0] ────────────────

    'K': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Index up, middle up (like V), thumb extended between them pointing upward/forward',
        category:     'alphabet',
        imageFile:    'K.png',
        tbWeight:     0.35,
        // K: thumbBelowPIP:false — thumb extends forward/up, not downward.
        // Separates from P which points the whole hand down.
        tiebreakers:  { thumbBelowPIP: false },
    },

    'P': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Like K but the entire hand is tilted/pointed DOWNWARD',
        category:     'alphabet',
        imageFile:    'P.png',
        tbWeight:     0.35,
        // P: thumbBelowPIP:true — hand points down, thumb tip below index PIP.
        tiebreakers:  { thumbBelowPIP: true },
    },

    // ─── UNIQUE FINGERSTATE LETTERS ──────────────────────────

    'F': {
        fingerStates: [1, 0, 1, 1, 1],
        description:  'Index finger and thumb form a circle/OK shape; middle, ring, pinky extended up',
        category:     'alphabet',
        imageFile:    'F.png',
        // F: unique fingerStates [1,0,1,1,1] — no other letter matches this.
        // No tiebreakers needed.
    },

    'I': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Only the pinky finger extended straight up, all others folded into fist',
        category:     'alphabet',
        imageFile:    'I.png',
        // I: unique [0,0,0,0,1] — only active sign with just pinky up (J disabled).
    },

    'J': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Pinky extended, draw a J shape in the air — motion sign, disabled',
        category:     'alphabet',
        imageFile:    'J.png',
        disabled:     true,
    },

    'W': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'Index, middle, and ring fingers extended and spread apart (W / 3-finger salute)',
        category:     'alphabet',
        imageFile:    'W.png',
        // W: unique [0,1,1,1,0] — no other active letter matches this pattern.
    },

    'Y': {
        fingerStates: [1, 0, 0, 0, 1],
        description:  'Thumb and pinky extended outward (shaka / hang loose), all other fingers folded',
        category:     'alphabet',
        imageFile:    'Y.png',
        tbWeight:     0.35,
        // Y: unique [1,0,0,0,1] — pinkThumbOnly:true confirms only these two extend.
        tiebreakers:  { pinkThumbOnly: true },
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 2 — COMMON WORDS
    // All motion signs are disabled (they collide with alphabet shapes).
    // 'I LOVE YOU' is the only static word sign currently active.
    // ══════════════════════════════════════════════════════════

    'I LOVE YOU': {
        fingerStates: [1, 1, 0, 0, 1],
        description:  'Thumb, index, and pinky all extended simultaneously (ILY handshape)',
        category:     'word',
        imageFile:    'i-love-you.png',
        // Unique fingerStates [1,1,0,0,1] — no alphabet collision.
    },

    'HELLO':        { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'hello.gif',        disabled: true },
    'THANK YOU':    { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'thank-you.gif',    disabled: true },
    'PLEASE':       { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'please.gif',       disabled: true },
    'FOOD':         { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'food.gif',         disabled: true },
    'GOOD MORNING': { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'good-morning.gif', disabled: true },
    'SORRY':        { fingerStates: [0,0,0,0,0], category: 'word', imageFile: 'sorry.gif',        disabled: true },
    'YES':          { fingerStates: [0,0,0,0,0], category: 'word', imageFile: 'yes.png',           disabled: true },
    'NO':           { fingerStates: [0,1,1,0,0], category: 'word', imageFile: 'no.png',            disabled: true },
    'MY NAME IS':   { fingerStates: [0,1,1,0,0], category: 'word', imageFile: 'my-name-is.gif',   disabled: true },
    'HELP':         { fingerStates: [1,1,1,0,0], category: 'word', imageFile: 'help.gif',          disabled: true },
    'WATER':        { fingerStates: [0,1,1,1,0], category: 'word', imageFile: 'water.gif',         disabled: true },
    'GOODBYE':      { fingerStates: [0,1,1,1,1], category: 'word', imageFile: 'goodbye.gif',      disabled: true },
    'MOTHER':       { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'mother.gif',       disabled: true },
    'FATHER':       { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'father.gif',       disabled: true },
    'FRIEND':       { fingerStates: [0,1,0,0,0], category: 'word', imageFile: 'friend.gif',       disabled: true },
    'FAMILY':       { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'family.gif',       disabled: true },
    'SCHOOL':       { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'school.gif',       disabled: true },
    'WORK':         { fingerStates: [0,0,0,0,0], category: 'word', imageFile: 'work.gif',          disabled: true },
    'HOME':         { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'home.gif',          disabled: true },
    'LOVE':         { fingerStates: [0,0,0,0,0], category: 'word', imageFile: 'love.gif',          disabled: true },
    'GOOD':         { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'good.gif',          disabled: true },
    'BAD':          { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'bad.gif',           disabled: true },
    'WANT':         { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'want.gif',          disabled: true },
    'MORE':         { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'more.gif',          disabled: true },
    'STOP':         { fingerStates: [0,1,1,1,1], category: 'word', imageFile: 'stop.gif',          disabled: true },
    'GO':           { fingerStates: [0,1,0,0,0], category: 'word', imageFile: 'go.gif',            disabled: true },
    'COME':         { fingerStates: [0,1,0,0,0], category: 'word', imageFile: 'come.gif',          disabled: true },
    'WHERE':        { fingerStates: [0,1,0,0,0], category: 'word', imageFile: 'where.gif',         disabled: true },
    'WHY':          { fingerStates: [0,1,1,1,0], category: 'word', imageFile: 'why.gif',           disabled: true },
    'WHAT':         { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'what.gif',          disabled: true },
    'RESTROOM':     { fingerStates: [1,1,0,0,0], category: 'word', imageFile: 'restroom.gif',      disabled: true },
    'HUNGRY':       { fingerStates: [1,1,1,1,1], category: 'word', imageFile: 'hungry.gif',        disabled: true },

    // ══════════════════════════════════════════════════════════
    // LEVEL 3 — PHRASES (all motion signs, all disabled)
    // ══════════════════════════════════════════════════════════

    'NICE TO MEET YOU':   { fingerStates: [1,1,1,1,1], category: 'phrase', imageFile: 'nice-to-meet-you.gif',   disabled: true },
    'HOW ARE YOU':        { fingerStates: [0,1,1,0,0], category: 'phrase', imageFile: 'how-are-you.gif',        disabled: true },
    'WHERE IS':           { fingerStates: [0,1,0,0,0], category: 'phrase', imageFile: 'where-is.gif',           disabled: true },
    'I AM LEARNING':      { fingerStates: [0,1,1,1,1], category: 'phrase', imageFile: 'i-am-learning.gif',      disabled: true },
    'WHAT IS YOUR NAME':  { fingerStates: [0,1,1,0,0], category: 'phrase', imageFile: 'what-is-your-name.gif',  disabled: true },

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