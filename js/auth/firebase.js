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
 // Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDK5li_O9msniLbS7OU2rAFab9gHqOCOVM",
  authDomain: "test-signlanguage.firebaseapp.com",
  projectId: "test-signlanguage",
  storageBucket: "test-signlanguage.firebasestorage.app",
  messagingSenderId: "873720715606",
  appId: "1:873720715606:web:7da600331b9d8c5a851ef7",
  measurementId: "G-TNZZCZMYL9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


const btn = document.getElementById("signUpBtn");
btn.addEventListener('click', (e) => {
      e.preventDefault();

      const email = document.getElementById("signUpEmail").value;
      const password = document.getElementById("signUpPassword").value;
      const fname = document.getElementById("signUpFirstName").value;
      const lname = document.getElementById("signUpLastName").value;

      const auth = getAuth();
      const db = getFirestore();

      createUserWithEmailAndPassword(auth,email,password)
      .then((userCredential) => {
          const user = userCredential.user;
          const userData = {
              email: email,
              firstname: fname,
              lastname: lname
          };

      const docRef = doc(db, "users", user.uid);

      setDoc(docRef, userData)
      .then(() => {
        /*dto mo ilalagay yung mga kailangan gawin kapag tapos na
        o successful na ang pag save ng user data sa firestore, at sa auth 
        */
        const greet = document.getElementById("greet");
        greet.textContent = `Welcome, ${userData.firstname} ${userData.lastname}! Your account has been created.`;
      })//setDoc end bracket

      .catch((error) => {
        const errorcode = error.code;
        if(errorcode === "auth/email-already-in-use"){
          alert("Email already in use. Please use a different email.");
        } else {
          alert("Error saving user data: " + error.message);
        }
      })//catch end bracket

    });//createUserWithEmailAndPassword end bracket

});//btn event listener end bracket

const btn2 = document.getElementById("signInBtn");
btn2.addEventListener('click', (e) => {
  e.preventDefault();

  const email = document.getElementById("signInEmail").value;
  const password = document.getElementById("signInPassword").value;
  
  const auth = getAuth();
  signInWithEmailAndPassword(auth,email,password)
  .then((userCredential) => {
    const user = userCredential.user;
    
    localStorage.setItem("loggedInUserId", user.uid);
    window.location.href = "dashboard.html";
  })
  .catch((error) => {
    const errorcode = error.code;
    if(errorcode === "auth/invalid-credential"){
      alert("Incorrect email or password. Please try again.");
    } else {
      alert("Error signing in: " + error.message);
    }
  });
});