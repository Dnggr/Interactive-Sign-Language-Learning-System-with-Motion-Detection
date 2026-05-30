/*
  firebase.js — Firebase Initialization and Authentication Module

  Handles all communication with Firebase Authentication and Firestore.

  Responsibilities:
  - Initialize the Firebase app using the project config object
    (get apiKey, authDomain, projectId, etc. from Firebase Console)
  - Export the auth and db (Firestore) instances for use in other modules

  Authentication functions to export:
  - registerUser(email, password, displayName)
      Creates a new account via Firebase Auth.
      Also saves an initial user profile document to Firestore at users/{uid}
      with { email, displayName, createdAt }.

  - loginUser(email, password)
      Signs in an existing user via Firebase Auth.
      Redirects to dashboard.html on success.
      Returns the error message on failure.

  - logoutUser()
      Signs out the current user.
      Clears local session and redirects to index.html.

  - getCurrentUser()
      Returns the currently signed-in Firebase user object, or null.

  - onAuthChange(callback)
      Listens for auth state changes.
      Used by dashboard.html and lesson.html to redirect to login
      if the session expires or the user is not authenticated.

  Firestore functions to export:
  - getUserProgress(uid)
      Reads the entire progress subcollection for a user.
      Returns a map: { lessonId: { status, highScore, attempts, lastAttempt } }

  - saveLessonProgress(uid, lessonId, scoreData)
      Writes or updates the progress document for one lesson.
      Only updates highScore if the new score is higher than the stored one.

  NOTE: Never commit real API keys. In production, load the Firebase config
  from a separate config file (e.g. js/auth/firebaseConfig.js) that is
  listed in .gitignore, or use environment variables with a bundler.
*/
