/*
  dictionary.js — FSL Sign Reference Data

  A static data store containing reference patterns for every sign the system recognizes.
  Used by classifier.js to match detected landmarks against known signs.

  Each sign entry follows this structure:
  {
    id: "A",
    label: "Letter A",
    type: "static",                               // "static" or "dynamic"
    referenceImage: "assets/signs/alphabet/A.png",

    // For static signs — finger state pattern:
    fingerPattern: {
      thumb:  "bent",       // "extended" | "bent" | "curled"
      index:  "curled",
      middle: "curled",
      ring:   "curled",
      pinky:  "curled"
    },

    // For dynamic signs — motion checkpoints:
    checkpoints: [
      { description: "Flat hand near forehead, fingers together" },
      { description: "Hand moving forward and slightly downward" },
      { description: "Hand stops flat, palm facing outward" }
    ]
  }

  Exports:
  - SIGN_DICTIONARY       Array of all sign entries
  - getSignById(id)       Returns a single sign entry by ID string
  - getSignsByType(type)  Returns all "static" or all "dynamic" signs
  - getSignsByLesson(lessonId)  Returns only the signs assigned to a lesson

  Reference image sources (free for educational use):
  - Wikimedia Commons: search "Filipino Sign Language" or "ASL alphabet"
  - Lifeprint.com (with attribution)
  - GitHub: search "asl-alphabet-assets"
  Place images in assets/signs/alphabet/, assets/signs/words/, assets/signs/phrases/
*/
/*
  dictionary.js — ASL Sign Language Reference Data
  Member 2 [Manlangit] | Branch: [Manlangit]cameratracking-engine

  Contains the reference finger-state patterns for every sign in the curriculum.

  ── DATA FORMAT ──
  Each entry uses a fingerStates array: [thumb, index, middle, ring, pinky]
  1 = finger extended/open
  0 = finger folded/closed

  ── SOURCE ──
  Patterns derived from ASL handshape reference:
  Kaggle: https://www.kaggle.com/competitions/asl-signs
  Lifeprint: https://www.lifeprint.com/asl101/pages-signs/signs-abc.htm

  ── CATEGORIES ──
  'alphabet' → Level 1 (Beginner)
  'word'     → Level 2 (Intermediate)
  'phrase'   → Level 3 (Advanced)
  'control'  → Special system commands (SPACE, BACKSPACE)
*/

export const SIGN_DICTIONARY = {

    // ══════════════════════════════════════════════════════════
    // LEVEL 1 — ASL ALPHABET (A–Z)
    // ══════════════════════════════════════════════════════════

    'A': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'Fist with thumb resting beside fingers, not tucked under',
        category:     'alphabet',
        imageFile:    'A.png',
    },
    'B': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Four fingers straight up, thumb tucked flat across palm',
        category:     'alphabet',
        imageFile:    'B.png',
    },
    'C': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers curve into a C shape, thumb mirrors the curve',
        category:     'alphabet',
        imageFile:    'C.png',
    },
    'D': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger points up, other fingers and thumb form a circle',
        category:     'alphabet',
        imageFile:    'D.png',
    },
    'E': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'All fingers curl down toward palm, thumb tucked under curled fingers',
        category:     'alphabet',
        imageFile:    'E.png',
    },
    'F': {
        fingerStates: [1, 0, 1, 1, 1],
        description:  'Index and thumb touch forming a circle, other three fingers extended up',
        category:     'alphabet',
        imageFile:    'F.png',
    },
    'G': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Index and thumb point horizontally outward (sideways pointing)',
        category:     'alphabet',
        imageFile:    'G.png',
    },
    'H': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and held together, pointing sideways',
        category:     'alphabet',
        imageFile:    'H.png',
    },
    'I': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Only pinky finger extended straight up, all others folded',
        category:     'alphabet',
        imageFile:    'I.png',
    },
    'J': {
        fingerStates: [0, 0, 0, 0, 1],
        description:  'Pinky extended, draw a J shape in the air (dynamic — use I shape as static)',
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
        description:  'Thumb and index extended at right angles (L-shape), others folded',
        category:     'alphabet',
        imageFile:    'L.png',
    },
    'M': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Three fingers (index, middle, ring) folded over thumb, pinky tucked',
        category:     'alphabet',
        imageFile:    'M.png',
    },
    'N': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Index and middle fingers folded over thumb, ring and pinky tucked',
        category:     'alphabet',
        imageFile:    'N.png',
    },
    'O': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'All fingers and thumb curve to touch tips — forming an O shape',
        category:     'alphabet',
        imageFile:    'O.png',
    },
    'P': {
        fingerStates: [1, 1, 1, 0, 0],
        description:  'Like K but pointed downward — index, middle, and thumb extended',
        category:     'alphabet',
        imageFile:    'P.png',
    },
    'Q': {
        fingerStates: [1, 1, 0, 0, 0],
        description:  'Like G but pointed downward — index and thumb point down',
        category:     'alphabet',
        imageFile:    'Q.png',
    },
    'R': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and crossed over each other',
        category:     'alphabet',
        imageFile:    'R.png',
    },
    'S': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist with thumb wrapped across front of all four curled fingers',
        category:     'alphabet',
        imageFile:    'S.png',
    },
    'T': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'Fist with thumb inserted between index and middle fingers',
        category:     'alphabet',
        imageFile:    'T.png',
    },
    'U': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended straight up and held together',
        category:     'alphabet',
        imageFile:    'U.png',
    },
    'V': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers extended and spread apart (V shape)',
        category:     'alphabet',
        imageFile:    'V.png',
    },
    'W': {
        fingerStates: [0, 1, 1, 1, 0],
        description:  'Index, middle, and ring fingers extended and spread apart',
        category:     'alphabet',
        imageFile:    'W.png',
    },
    'X': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger extended and hooked (bent at first joint)',
        category:     'alphabet',
        imageFile:    'X.png',
    },
    'Y': {
        fingerStates: [1, 0, 0, 0, 1],
        description:  'Thumb and pinky extended outward, all other fingers folded',
        category:     'alphabet',
        imageFile:    'Y.png',
    },
    'Z': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger extended, draw a Z shape in the air (dynamic)',
        category:     'alphabet',
        imageFile:    'Z.png',
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 2 — COMMON WORDS
    // ══════════════════════════════════════════════════════════

    'HELLO': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open flat hand, fingers together, touch forehead and wave outward',
        category:     'word',
        imageFile:    'hello.gif',
    },
    'THANK YOU': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat open hand touches chin then moves forward and down',
        category:     'word',
        imageFile:    'thank-you.gif',
    },
    'PLEASE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open hand, rub in a circular motion on your chest',
        category:     'word',
        imageFile:    'please.gif',
    },
    'SORRY': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Closed fist, rub in a circular motion on your chest',
        category:     'word',
        imageFile:    'sorry.gif',
    },
    'YES': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Fist nods forward and back (like a head nodding yes)',
        category:     'word',
        imageFile:    'yes.png',
    },
    'NO': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Index and middle fingers snap down to meet thumb twice',
        category:     'word',
        imageFile:    'no.png',
    },
    'HELP': {
        fingerStates: [1, 0, 0, 0, 0],
        description:  'Thumbs-up hand rests on flat other palm, lift both hands upward',
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
    'FOOD': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Pinch all fingertips to thumb, bring to lips twice',
        category:     'word',
        imageFile:    'food.gif',
    },
    'GOOD MORNING': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand at chin moves forward and up in an arc',
        category:     'word',
        imageFile:    'good-morning.gif',
    },
    'GOODBYE': {
        fingerStates: [0, 1, 1, 1, 1],
        description:  'Fingers extended, fold down toward palm repeatedly (waving)',
        category:     'word',
        imageFile:    'goodbye.gif',
    },
    'MY NAME IS': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'H handshape taps on other H handshape twice',
        category:     'word',
        imageFile:    'my-name-is.gif',
    },

    // ══════════════════════════════════════════════════════════
    // LEVEL 3 — PHRASES
    // ══════════════════════════════════════════════════════════

    'NICE TO MEET YOU': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Flat hand sweeps from center outward toward the other person',
        category:     'phrase',
        imageFile:    'nice-to-meet-you.gif',
    },
    'HOW ARE YOU': {
        fingerStates: [0, 1, 1, 0, 0],
        description:  'Bent hands face up, knuckles brush upward from center twice',
        category:     'phrase',
        imageFile:    'how-are-you.gif',
    },
    'WHERE IS': {
        fingerStates: [0, 1, 0, 0, 0],
        description:  'Index finger points and shakes side to side',
        category:     'phrase',
        imageFile:    'where-is.gif',
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
    },

    // ══════════════════════════════════════════════════════════
    // CONTROL GESTURES (system commands)
    // ══════════════════════════════════════════════════════════

    'SPACE': {
        fingerStates: [1, 1, 1, 1, 1],
        description:  'Open flat hand held still — inserts a space in the text box',
        category:     'control',
        imageFile:    null,
    },
    'BACKSPACE': {
        fingerStates: [0, 0, 0, 0, 0],
        description:  'Closed fist held still — deletes the last character',
        category:     'control',
        imageFile:    null,
    },
};

// ─────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────

/**
 * Returns all sign labels in a given category.
 * @param {'alphabet'|'word'|'phrase'|'control'} category
 * @returns {string[]}
 */
export function getSignsByCategory(category) {
    return Object.entries(SIGN_DICTIONARY)
        .filter(([, data]) => data.category === category)
        .map(([label]) => label);
}

/**
 * Returns the full data object for a single sign label.
 * @param {string} label
 * @returns {object|null}
 */
export function getSignData(label) {
    return SIGN_DICTIONARY[label] ?? null;
}

/**
 * Returns all available sign labels.
 * @returns {string[]}
 */
export function getAllSigns() {
    return Object.keys(SIGN_DICTIONARY);
}