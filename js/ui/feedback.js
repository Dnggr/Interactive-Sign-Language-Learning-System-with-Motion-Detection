/*
  feedback.js — Real-Time Gesture Feedback and Score Display Module

  Updates the lesson.html UI based on gesture detection results from classifier.js.
  Contains only DOM manipulation — no detection logic.

  DOM elements managed by this module:
    #translation-output   Textarea showing the accumulated detected gesture text
    #confidence-display   Shows "Confidence: 87%" in real time
    #feedback-message     Context hints: "Hold still...", "Letter A detected!"
    #score-display        Quiz score counter: "3 / 5 correct"
    #completion-overlay   Full-screen overlay shown when the lesson is passed

  ── DEBOUNCE / LOCK MECHANISM ──
  The system must NOT register a sign on every single video frame.
  Implementation:
  - A sign is only registered after the same sign is detected continuously for 1.5 seconds
  - After registering a sign, start a 1-second cooldown before the next sign can register
  - This prevents flooding the textarea with repeated characters during a single held gesture

  ── PRACTICE MODE behavior ──
  - Append the detected character or word to the #translation-output textarea
  - Recognize a "space" gesture (flat open hand held still) to insert a space
  - Recognize a "backspace" gesture (thumbs down held) to delete the last character

  ── QUIZ MODE behavior ──
  - Display the current target sign prompt to the user
  - If the detected sign matches the prompt → show green "Correct!" for 1 second, advance
  - If the user does not sign within a timeout → show "Try again" and move on
  - Update #score-display after each prompt

  ── LESSON COMPLETION ──
  - When quiz score reaches the passing threshold (80% or more):
      Show #completion-overlay with the final score and a congratulations message
  - "Save & Continue" button on the overlay:
      Calls saveLessonProgress() from firebase.js
      Redirects to dashboard.html

  Functions to export:

  - initFeedback(mode)
      Sets up feedback for "practice" or "quiz" mode.
      Resets all timers, score, and text output to a clean state.

  - onGestureResult(result, currentQuizSign)
      Called every frame by app.js with the classifier output.
      Handles debounce logic, UI updates, and quiz scoring.

  - resetFeedback()
      Clears the textarea and resets all state.
      Called when advancing to the next quiz prompt.
*/
