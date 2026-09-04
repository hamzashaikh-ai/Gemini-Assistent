import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { JournalEntry } from "../types";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Authentication setup
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Firestore setup with named database support
const dbId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
export const db = getFirestore(app, dbId);

/**
 * Strips all undefined fields recursively from objects before submitting to Firestore.
 * Prevents "Function DocumentReference.set() called with invalid data. Unsupported field value: undefined" errors.
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === "object") {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizeForFirestore(value);
      }
    }
    return cleanObj as T;
  }
  return data;
}

/**
 * Authenticate via Google Sign-In popup
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.error("Firebase Google Auth Error:", error);
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Subscribes to Auth State Changes
 */
export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * User-isolated document path helper: /users/{userId}/entries/{entryId}
 */
export function getUserEntryRef(userId: string, entryId: string) {
  return doc(db, "users", userId, "entries", entryId);
}

/**
 * Persist or update a journal entry to Firestore under the isolated user collection
 */
export async function saveJournalEntryToFirestore(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId) {
    throw new Error("Cannot save entry without authenticated user identity.");
  }
  const cleanPayload = sanitizeForFirestore({
    ...entry,
    userId,
    updatedAt: Date.now(),
  });
  const entryDocRef = getUserEntryRef(userId, entry.id);
  await setDoc(entryDocRef, cleanPayload, { merge: true });
}

/**
 * Delete a journal entry from Firestore
 */
export async function deleteJournalEntryFromFirestore(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) {
    throw new Error("Missing user ID or entry ID for deletion.");
  }
  const entryDocRef = getUserEntryRef(userId, entryId);
  await deleteDoc(entryDocRef);
}

/**
 * Real-time subscription to all entries belonging to the authenticated user
 */
export function subscribeToUserEntries(
  userId: string,
  onData: (entries: JournalEntry[]) => void,
  onError?: (err: Error) => void
) {
  if (!userId) {
    onData([]);
    return () => {};
  }

  const entriesCollection = collection(db, "users", userId, "entries");
  const entriesQuery = query(entriesCollection, orderBy("updatedAt", "desc"));

  return onSnapshot(
    entriesQuery,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as JournalEntry;
        entries.push({
          ...data,
          id: docSnap.id,
        });
      });
      onData(entries);
    },
    (error) => {
      console.error("Firestore user entries subscription error:", error);
      if (onError) onError(error);
    }
  );
}

/**
 * Fetch a single entry by ID
 */
export async function fetchUserEntryById(userId: string, entryId: string): Promise<JournalEntry | null> {
  if (!userId || !entryId) return null;
  const entryDocRef = getUserEntryRef(userId, entryId);
  const snap = await getDoc(entryDocRef);
  if (snap.exists()) {
    return { ...(snap.data() as JournalEntry), id: snap.id };
  }
  return null;
}
