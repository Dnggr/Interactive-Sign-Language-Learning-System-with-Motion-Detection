/*
  lessonData.js — Lesson Content, Instructions, and Quiz Data

  Contains the text and content displayed to the user during each lesson.
  Separate from curriculum.js, which handles structure and unlock logic.

  Exported LESSON_CONTENT is a map keyed by lessonId:
  {
    "lesson-1a": {
      lessonId:     "lesson-1a",
      title:        "Letters A–G",
      introduction: "In this lesson you will learn the first 7 letters of the FSL alphabet.",
      instructions: "Hold each sign steady for 1.5 seconds to register it.",

      practiceItems: [
        {
          signId:         "A",
          prompt:         "Make the sign for letter A",
          hint:           "Make a fist with your thumb resting against the side of your index finger",
          referenceImage: "assets/signs/alphabet/A.png"
        },
        // ... B, C, D, E, F, G
      ],

      quizItems: [
        // A subset of signs shown in random order during Quiz Mode
        // The system will pick signs randomly from this list each attempt
        { signId: "A", prompt: "Show us letter A" },
        { signId: "D", prompt: "Show us letter D" },
        { signId: "G", prompt: "Show us letter G" }
      ],

      completionMessage: "Great job! You have learned letters A through G."
    },

    "lesson-2a": {
      // Same structure for word lessons
      // practiceItems will reference dynamic signs (Hello, Good Morning, etc.)
      // referenceImage should point to a .gif in assets/signs/words/
    }
  }

  Functions to export:

  - getLessonContent(lessonId)
      Returns the full content object for a given lesson ID.

  - getRandomQuizItems(lessonId, count)
      Returns `count` randomly shuffled quiz items from the lesson's quizItems array.
      Used by feedback.js when starting Quiz Mode.
*/
