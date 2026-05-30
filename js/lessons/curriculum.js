/*
  curriculum.js — Lesson Plan Structure and Progression Logic

  Defines the full 3-level curriculum and controls which lessons are accessible
  based on the user's Firestore progress data.

  Exported CURRICULUM array structure:
  [
    {
      levelId: "level-1",
      levelName: "Beginner",
      description: "Learn the Filipino Sign Language alphabet (A–Z)",
      lessons: [
        {
          lessonId:   "lesson-1a",
          title:      "Letters A–G",
          type:       "static",
          signs:      ["A","B","C","D","E","F","G"],  // sign IDs from dictionary.js
          passingScore: 80,                            // minimum % to unlock next lesson
          unlockedBy: null                             // null = always accessible (first lesson)
        },
        {
          lessonId:   "lesson-1b",
          title:      "Letters H–N",
          signs:      ["H","I","J","K","L","M","N"],
          passingScore: 80,
          unlockedBy: "lesson-1a"                      // locked until lesson-1a is passed
        },
        // lesson-1c: Letters O–U
        // lesson-1d: Letters V–Z
        // lesson-1e: Level 1 Quiz (full alphabet)
      ]
    },
    {
      levelId: "level-2",
      levelName: "Intermediate",
      description: "Common FSL words and greetings",
      lessons: [
        // lesson-2a: Greetings (Hello, Good morning, Goodbye)
        // lesson-2b: Responses (Yes, No, Please, Thank you)
        // lesson-2c: Needs (Help, Water, Food, Restroom)
        // lesson-2d: Level 2 Quiz
      ]
    },
    {
      levelId: "level-3",
      levelName: "Advanced",
      description: "Basic FSL phrases and fingerspelling names",
      lessons: [
        // lesson-3a: Introductions (My name is, Nice to meet you)
        // lesson-3b: Questions (What is your name, How are you)
        // lesson-3c: Fingerspelling names using alphabet
        // lesson-3d: Level 3 Final Quiz
      ]
    }
  ]

  Functions to export:

  - getLessonById(lessonId)
      Returns the full lesson object from the CURRICULUM array.

  - isLessonUnlocked(lessonId, userProgressMap)
      Checks if the prerequisite lesson (unlockedBy) has status "completed"
      and highScore >= passingScore in the user's Firestore progress data.
      Returns: true | false

  - getNextLesson(lessonId)
      Returns the next lesson object in sequence, or null if it is the last lesson.

  - getLevelProgress(levelId, userProgressMap)
      Returns { completed: 3, total: 5 } for rendering dashboard progress bars.
*/
