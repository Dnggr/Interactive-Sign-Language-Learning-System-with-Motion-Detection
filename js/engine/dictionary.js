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
