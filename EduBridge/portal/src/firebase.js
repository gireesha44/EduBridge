import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyA2oZHJnolNIsP3eDT5_DGMkOL74Qpxz_k",
    authDomain: "edubridge-2f2b0.firebaseapp.com",
    projectId: "edubridge-2f2b0",
    storageBucket: "edubridge-2f2b0.firebasestorage.app",
    messagingSenderId: "241708248925",
    appId: "1:241708248925:web:c3f511f335f786d2af02b4"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
