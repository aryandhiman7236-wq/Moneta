
import { auth, db } from "./configure.js";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// SIGN UP
export async function signup(name, email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(
            auth,
            email.trim(),
            password
        );

        const user = userCredential.user;

        await updateProfile(user, {
            displayName: name.trim()
        });

        // Save user profile in Firestore
        await setDoc(doc(db, "users", user.uid), {
            name: name.trim(),
            email: user.email,
            createdAt: serverTimestamp()
        });

        return { success: true, user };
    } catch (error) {
        return {
            success: false,
            message: getAuthError(error.code)
        };
    }
}

// LOG IN
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth,
            email.trim(),
            password
        );

        return {
            success: true,
            user: userCredential.user
        };
    } catch (error) {
        return {
            success: false,
            message: getAuthError(error.code)
        };
    }
}

// LOG OUT
export async function logout() {
    try {
        await signOut(auth);
        return { success: true };
    } catch (error) {
        return {
            success: false,
            message: getAuthError(error.code)
        };
    }
}

// CHECK LOGIN STATUS
export function listenToAuth(callback) {
    return onAuthStateChanged(auth, callback);
}

// USER-FRIENDLY ERRORS
function getAuthError(code) {
    const errors = {
        "auth/email-already-in-use": "This email is already registered.",
        "auth/invalid-email": "Please enter a valid email.",
        "auth/weak-password": "Password should be at least 6 characters.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/network-request-failed": "Network error. Please try again.",
        "auth/too-many-requests": "Too many attempts. Try again later."
    };

    return errors[code] || "Something went wrong. Please try again.";
}
