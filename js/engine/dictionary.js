/*
  dictionary.js — ASL Sign Language Reference Data
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  v2.0 — UPGRADED: Added tiebreaker rules to fix duplicate-pattern signs

  ── WHY SIGNS WERE NOT BEING DETECTED (OLD BUG) ──
  The old dictionary had many signs with IDENTICAL fingerStates patterns:
    A, S, E, M, N, T, YES, SORRY, BACKSPACE → all [0,0,0,0,0]
    C, O, HELLO, THANK YOU, PLEASE, FOOD, SPACE → all [1,1,1,1,1]
    D, X, Z, WHERE IS → all [0,1,0,0,0]
    U, V, R, H, NO, HOW ARE YOU, MY NAME IS → all [0,1,1,0,0]

  The classifier picked alphabetically-first match every time.

  ── FIX ──
  Added `tiebreakers` field to signs that share a fingerStates pattern.
  The new classifier uses these to break ties via geometric checks.
  Signs with truly unique fingerStates don't need tiebreakers.

  ── DATA FORMAT ──
  fingerStates: [thumb, index, middle, ring, pinky]
    1 = finger extended, 0 = finger folded

  tiebreakers (optional): extra geometric rules used when fingerStates alone
    can't distinguish this sign from others with the same pattern.

    indexHooked:    boolean  — is index finger bent/hooked?
    fingersCrossed: boolean  — are index+middle crossing?
    tipsClose:      boolean  — are all fingertips close together?
    thumbBelowPIP:  boolean  — is thumb tip below index PIP joint?
    pinkThumbOnly:  boolean  — only pinky and thumb extended?
    minSpread:      number   — minimum index-middle tip distance
    maxSpread:      number   — maximum index-middle tip distance
*/

export const SIGN_DICTIONARY = {

    // ══════════════════════════════════════════════════════════
    // LEVEL 1 — ASL ALPHABET (A–Z)
    // ══════════════════════════════════════════════════════════

    // ── All-folded group: A, E, M, N, S, T ──
    // These all look like fists. Tiebreakers needed.

    'A': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'Fist with thumb resting beside index finger (not tucked)',
        category:     'alphabet',
        imageFile:    'A.png',
        // A: thumb is OUT beside the fist, not tucked under
        tiebreakers:  { thumbBelowPIP: false },
    },
    'E': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'All fingers curl down toward palm, thumb tucked under curled fingers',
        category:     'alphabet',
        imageFile:    'E.png',
        // E: tips are all close/touching — they curl in toward the thumb
        tiebreakers:  { tipsClose: true, thumbBelowPIP: false },
    },
    'M': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Three fingers (index, middle, ring) folded down over tucked thumb',
        category:     'alphabet',
        imageFile:    'M.png',
        // M: thumb is tucked under 3 fingers — tip goes below PIP line
        tiebreakers:  { thumbBelowPIP: true, tipsClose: false },
    },
    'N': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Index and middle fingers folded down over tucked thumb',
        category:     'alphabet',
        imageFile:    'N.png',
        // N: similar to M but only 2 fingers cover thumb
        // Best distinguisher from M: N uses fewer fingers over thumb
        // (In practice M and N are very similar — we use thumbBelowPIP for both)
        tiebreakers:  { thumbBelowPIP: true, tipsClose: true },
    },
    'S': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist with thumb wrapped ACROSS the front of all four curled fingers',
        category:     'alphabet',
        imageFile:    'S.png',
        // S: thumb crosses in front — tip is at the side, not below PIP
        tiebreakers:  { thumbBelowPIP: false, tipsClose: false },
    },
    'T': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist with thumb inserted BETWEEN index and middle fingers',
        category:     'alphabet',
        imageFile:    'T.png',
        // T: thumb pushed up between index+middle — tip is clearly above PIP
        tiebreakers:  { thumbBelowPIP: false, indexHooked: false },
    },

    // ── All-extended group: B, C, O ──

    'B': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Four fingers straight up, thumb tucked flat across palm',
        category:     'alphabet',
        imageFile:    'B.png',
        // B: thumb tucked, all 4 fingers up together tight
        tiebreakers:  { tipsClose: false },
    },
    'C': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers curve into a C shape, thumb mirrors the curve',
        category:     'alphabet',
        imageFile:    'C.png',
        // C: tips NOT close — they curve but are spread in a C arc
        tiebreakers:  { tipsClose: false },
    },
    'O': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers and thumb curve to touch tips — forming an O',
        category:     'alphabet',
        imageFile:    'O.png',
        // O: all tips close together touching thumb
        tiebreakers:  { tipsClose: true },
    },

    // ── Index-only group: D, X, Z ──

    'D': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger points up, other fingers and thumb form a circle',
        category:     'alphabet',
        imageFile:    'D.png',
        // D: index straight, not hooked
        tiebreakers:  { indexHooked: false },
    },
    'X': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger extended and hooked (bent at first joint)',
        category:     'alphabet',
        imageFile:    'X.png',
        // X: index is bent/hooked — PIP bent, tip curling back
        tiebreakers:  { indexHooked: true },
    },
    'Z': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger extended, draw a Z shape in the air',
        category:     'alphabet',
        imageFile:    'Z.png',
        // Z: same static pose as D — motion makes it Z, static looks like D
        // No reliable tiebreaker for Z vs D as static sign
        tiebreakers:  { indexHooked: false },
    },

    // ── Index+middle group: H, R, U, V ──

    'H': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and held together, pointing sideways',
        category:     'alphabet',
        imageFile:    'H.png',
        // H: fingers close together, not spread, not crossed
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.08 },
    },
    'R': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and crossed over each other',
        category:     'alphabet',
        imageFile:    'R.png',
        // R: index and middle cross — tips are very close
        tiebreakers:  { fingersCrossed: true },
    },
    'U': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended straight up and held together',
        category:     'alphabet',
        imageFile:    'U.png',
        // U: two fingers up, close together
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.08 },
    },
    'V': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and spread apart (V shape)',
        category:     'alphabet',
        imageFile:    'V.png',
        // V: two fingers up but SPREAD apart
        tiebreakers:  { fingersCrossed: false, minSpread: 0.09 },
    },

    // ── Unique fingerState signs — no tiebreakers needed ──

    'F': {
        fingerStates: [1, 0, 1, 1, 1],
        description:  'Index and thumb form a circle, other three fingers extended up',
        category:     'alphabet',
        imageFile:    'F.png',
    },
    'G': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Index and thumb point horizontally outward (sideways)',
        category:     'alphabet',
        imageFile:    'G.png',
    },
    'I': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Only pinky finger extended straight up, all others folded',
        category:     'alphabet',
        imageFile:    'I.png',
    },
    'J': {
        // J is a motion sign — same static pose as I
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Pinky extended, draw a J shape in the air',
        category:     'alphabet',
        imageFile:    'J.png',
    },
    'K': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Index up, middle up, thumb extended outward between them',
        category:     'alphabet',
        imageFile:    'K.png',
    },
    'L': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Thumb and index extended at right angles (L-shape)',
        category:     'alphabet',
        imageFile:    'L.png',
    },
    'P': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Like K but pointed downward — index, middle, thumb extended',
        category:     'alphabet',
        imageFile:    'P.png',
    },
    'Q': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Like G but pointed downward — index and thumb point down',
        category:     'alphabet',
        imageFile:    'Q.png',
    },
    'W': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'Index, middle, and ring fingers extended and spread apart',
        category:     'alphabet',
        imageFile:    'W.png',
    },
    'Y': {
        fingerStates: [1, 0, 0, 0, 1],
        description:  'Thumb and pinky extended outward, all other fingers folded',
        category:     'alphabet',
        imageFile:    'Y.png',
        tiebreakers:  { pinkThumbOnly: true },
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 2 — COMMON WORDS (20 words)
    // ══════════════════════════════════════════════════════════

    // ── Open-hand group (all extended): HELLO, THANK YOU, PLEASE, FOOD ──
    // These are motion signs — static pose is all-open hand
    // We keep them but note the tester will show whichever is first unless motion is added

    'HELLO': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open flat hand, touch forehead, wave outward',
        category:     'word',
        imageFile:    'hello.gif',
        tiebreakers:  { tipsClose: false },
    },
    'THANK YOU': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat open hand from chin, move forward and down',
        category:     'word',
        imageFile:    'thank-you.gif',
        tiebreakers:  { tipsClose: false },
    },
    'PLEASE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open hand, rub in circular motion on chest',
        category:     'word',
        imageFile:    'please.gif',
        tiebreakers:  { tipsClose: false },
    },
    'FOOD': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Pinch all fingertips to thumb, bring to lips twice',
        category:     'word',
        imageFile:    'food.gif',
        tiebreakers:  { tipsClose: true },
    },
    'GOOD MORNING': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand at chin moves forward and up in an arc',
        category:     'word',
        imageFile:    'good-morning.gif',
        tiebreakers:  { tipsClose: false },
    },

    // ── Fist group: SORRY, YES ──

    'SORRY': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Closed fist, rub in circular motion on chest',
        category:     'word',
        imageFile:    'sorry.gif',
        tiebreakers:  { thumbBelowPIP: false, tipsClose: false },
    },
    'YES': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist nods forward and back (like a head nodding yes)',
        category:     'word',
        imageFile:    'yes.png',
        tiebreakers:  { thumbBelowPIP: false, tipsClose: false },
    },

    // ── Index+middle group: NO, MY NAME IS ──

    'NO': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers snap down to meet thumb twice',
        category:     'word',
        imageFile:    'no.png',
        tiebreakers:  { fingersCrossed: false },
    },
    'MY NAME IS': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'H handshape taps on other H handshape twice',
        category:     'word',
        imageFile:    'my-name-is.gif',
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.08 },
    },

    // ── Unique word signs ──

    'HELP': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'Thumbs-up hand rests on flat other palm, lift both upward',
        category:     'word',
        imageFile:    'help.gif',
    },
    'I LOVE YOU': {
        fingerStates: [1, 1, 0, 0, 1],
        description:  'Extend thumb, index, and pinky simultaneously (ILY handshape)',
        category:     'word',
        imageFile:    'i-love-you.png',
    },
    'WATER': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'W handshape (three middle fingers), tap on chin twice',
        category:     'word',
        imageFile:    'water.gif',
    },
    'GOODBYE': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Fingers extended, fold down toward palm repeatedly (waving)',
        category:     'word',
        imageFile:    'goodbye.gif',
    },

    // ── NEW WORDS (20 additions) ──

    'MOTHER': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open hand, thumb touches chin (5-handshape at chin)',
        category:     'word',
        imageFile:    'mother.gif',
        tiebreakers:  { tipsClose: false },
    },
    'FATHER': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open hand, thumb touches forehead (5-handshape at forehead)',
        category:     'word',
        imageFile:    'father.gif',
        tiebreakers:  { tipsClose: false },
    },
    'FRIEND': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Hook index fingers together, then swap positions',
        category:     'word',
        imageFile:    'friend.gif',
        tiebreakers:  { indexHooked: true },
    },
    'FAMILY': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'F handshape both hands, draw a circle outward',
        category:     'word',
        imageFile:    'family.gif',
        tiebreakers:  { tipsClose: true },
    },
    'SCHOOL': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Clap flat hand on flat hand twice',
        category:     'word',
        imageFile:    'school.gif',
        tiebreakers:  { tipsClose: false },
    },
    'WORK': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'S-handshape, wrist taps on back of other S-handshape twice',
        category:     'word',
        imageFile:    'work.gif',
        tiebreakers:  { thumbBelowPIP: false, tipsClose: false },
    },
    'HOME': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Pinched hand touches cheek then moves to cheek again',
        category:     'word',
        imageFile:    'home.gif',
        tiebreakers:  { tipsClose: true },
    },
    'LOVE': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Cross arms over chest (hugging self gesture)',
        category:     'word',
        imageFile:    'love.gif',
        tiebreakers:  { thumbBelowPIP: false, tipsClose: false },
    },
    'GOOD': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand touches chin, moves forward and places in other palm',
        category:     'word',
        imageFile:    'good.gif',
        tiebreakers:  { tipsClose: false },
    },
    'BAD': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand touches mouth, flips down away from face',
        category:     'word',
        imageFile:    'bad.gif',
        tiebreakers:  { tipsClose: false },
    },
    'WANT': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Both bent hands pull toward chest (as if grabbing something wanted)',
        category:     'word',
        imageFile:    'want.gif',
        tiebreakers:  { tipsClose: false },
    },
    'MORE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Pinched fingers tap together twice (both hands, fingertips meeting)',
        category:     'word',
        imageFile:    'more.gif',
        tiebreakers:  { tipsClose: true },
    },
    'STOP': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Flat hand chops down onto palm of other flat hand',
        category:     'word',
        imageFile:    'stop.gif',
    },
    'GO': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Both index fingers point forward and arc away from body',
        category:     'word',
        imageFile:    'go.gif',
        tiebreakers:  { indexHooked: false },
    },
    'COME': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Both index fingers arc toward the body (reverse of GO)',
        category:     'word',
        imageFile:    'come.gif',
        tiebreakers:  { indexHooked: false },
    },
    'WHERE': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger waggles side to side',
        category:     'word',
        imageFile:    'where.gif',
        tiebreakers:  { indexHooked: false },
    },
    'WHY': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'Middle three fingers touch forehead, twist forward',
        category:     'word',
        imageFile:    'why.gif',
    },
    'WHAT': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand brushes down across open other palm',
        category:     'word',
        imageFile:    'what.gif',
        tiebreakers:  { tipsClose: false },
    },
    'RESTROOM': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'R handshape shakes side to side (T-handshape in some dialects)',
        category:     'word',
        imageFile:    'restroom.gif',
    },
    'HUNGRY': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'C-handshape moves down the chest (as if feeling a hollow feeling)',
        category:     'word',
        imageFile:    'hungry.gif',
        tiebreakers:  { tipsClose: true },
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 3 — PHRASES
    // ══════════════════════════════════════════════════════════

    'NICE TO MEET YOU': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand sweeps from center outward toward the other person',
        category:     'phrase',
        imageFile:    'nice-to-meet-you.gif',
        tiebreakers:  { tipsClose: false },
    },
    'HOW ARE YOU': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Bent hands face up, knuckles brush upward from center twice',
        category:     'phrase',
        imageFile:    'how-are-you.gif',
        tiebreakers:  { fingersCrossed: false },
    },
    'WHERE IS': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger points and shakes side to side',
        category:     'phrase',
        imageFile:    'where-is.gif',
        tiebreakers:  { indexHooked: false },
    },
    'I AM LEARNING': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Open hand at forehead, bring down to closed hand at chest',
        category:     'phrase',
        imageFile:    'i-am-learning.gif',
    },
    'WHAT IS YOUR NAME': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'H hands tap twice, then point to the other person',
        category:     'phrase',
        imageFile:    'what-is-your-name.gif',
        tiebreakers:  { fingersCrossed: false, maxSpread: 0.08 },
    },

    // ══════════════════════════════════════════════════════════
    // CONTROL GESTURES
    // ══════════════════════════════════════════════════════════

    'SPACE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open flat hand held still — inserts a space',
        category:     'control',
        imageFile:    null,
        tiebreakers:  { tipsClose: false },
    },
    'BACKSPACE': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Closed fist held still — deletes the last character',
        category:     'control',
        imageFile:    null,
        tiebreakers:  { thumbBelowPIP: false, tipsClose: false },
    },
};

// ─────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────

export function getSignsByCategory(category) {
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