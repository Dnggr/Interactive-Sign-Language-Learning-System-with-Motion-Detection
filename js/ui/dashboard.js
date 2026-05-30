/*
  dashboard.js — Dashboard Page UI Controller

  Handles all DOM rendering on dashboard.html after the user's data is loaded.
  Invoked by dashboard.html once Firebase confirms the user is authenticated.

  Responsibilities:
  - Read auth state via firebase.js → redirect to index.html if not logged in
  - Display the user's display name in the greeting header
  - Call getUserProgress(uid) from firebase.js to load Firestore progress data
  - For each lesson defined in curriculum.js:
      Determine unlock status via isLessonUnlocked()
      Render the appropriate lesson card:
        Locked      → grey card with padlock icon, shows prerequisite label
        Not started → white card with "Start" button
        In progress → card with partial score and "Continue" button
        Completed   → green card with checkmark, high score, and "Retake" option
  - Render level progress bars (e.g. "3 of 5 lessons completed")
  - Attach "Start" / "Continue" button click handlers → navigate to lesson.html?lessonId=...
  - Attach Logout button click handler → call logoutUser() from firebase.js

  Functions to export:

  - initDashboard()
      Entry point called by dashboard.html on DOMContentLoaded.
      Checks auth state, loads progress, calls render functions.

  Internal helpers (not exported):
  - renderLessonCard(lesson, progress, isUnlocked)
  - renderLevelProgressBar(levelId, userProgressMap)
  - buildLessonURL(lessonId)  → "lesson.html?lessonId=lesson-1a"
*/
