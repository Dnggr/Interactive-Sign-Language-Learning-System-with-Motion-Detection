import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
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

const auth = getAuth();
const db = getFirestore();

onAuthStateChanged(auth, (user) => {
    const logginInUserId = localStorage.getItem('loggedInUserId');
    if(logginInUserId){
        const docRef = doc(db, "users", logginInUserId);
        getDoc(docRef)
        .then((docSnap) => {
            if(docSnap.exists()){
                const userData = docSnap.data();
                document.getElementById("loggedInUserFirstName").textContent = userData.firstname;
                document.getElementById("loggedInUserLastName").textContent = userData.lastname;
                document.getElementById("loggedInUserEmail").textContent = userData.email;
            } else {
                console.log("No document found matching the logged in user ID.");
            }
        })// then end bracket
        .catch((error) => {
            console.error("Error fetching user data:", error);
        });// catch end bracket

    } else {
        console.log("User Id not found.");
    }//if(loggedInUserId) end bracket

});// onAuthStateChanged end bracket

const logoutBtn = document.getElementById("logOutBtn");

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('loggedInUserId');
    signOut(auth)
    .then(() => {
        window.location.href = "index.html";
    })
    .catch((error) => {
        console.error("Error signing out:", error);
    });
});
