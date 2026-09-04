/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { User } from "firebase/auth";
import { 
  subscribeToAuth, 
  signInWithGoogle, 
  signOutUser, 
  saveJournalEntryToFirestore, 
  deleteJournalEntryFromFirestore, 
  subscribeToUserEntries 
} from "./lib/firebase";
import { JournalEntry } from "./types";
import { Navbar } from "./components/Navbar";
import { LandingHero } from "./components/LandingHero";
import { JournalEditor } from "./components/JournalEditor";
import { EntryHistory } from "./components/EntryHistory";
import { Loader2 } from "lucide-react";

function createEmptyEntry(userId: string): JournalEntry {
  return {
    id: crypto.randomUUID(),
    userId,
    title: "",
    content: "",
    messages: [],
    mode: "reflect",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<"editor" | "history">("editor");
  const [userEntries, setUserEntries] = useState<JournalEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

  // 1. Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuth((authUser) => {
      setUser(authUser);
      setAuthLoading(false);

      if (authUser) {
        // Initialize an empty entry for this user if none active
        setCurrentEntry((prev) => (prev && prev.userId === authUser.uid ? prev : createEmptyEntry(authUser.uid)));
      } else {
        setCurrentEntry(null);
        setUserEntries([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time Firestore subscription to user's isolated documents
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToUserEntries(
      user.uid,
      (entries) => {
        setUserEntries(entries);
      },
      (error) => {
        console.error("Failed to subscribe to entries:", error);
        setSaveError("Cloud Firestore subscription error: " + error.message);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 3. Save entry to Firestore helper
  const performSave = useCallback(
    async (entryToSave: JournalEntry) => {
      if (!user) return;
      // If entry is completely blank and has no messages or summary, skip saving empty ghost documents
      if (!entryToSave.title.trim() && !entryToSave.content.trim() && (!entryToSave.messages || entryToSave.messages.length === 0)) {
        setSaveStatus("idle");
        return;
      }

      setSaveStatus("saving");
      setSaveError(null);

      try {
        await saveJournalEntryToFirestore(user.uid, entryToSave);
        setSaveStatus("saved");
      } catch (err: any) {
        console.error("Firestore persistence error:", err);
        setSaveStatus("error");
        setSaveError(err?.message || "Failed to persist reflection to Cloud Firestore.");
      }
    },
    [user]
  );

  // 4. Update entry state and trigger debounced auto-save
  const handleUpdateEntry = useCallback(
    (updates: Partial<JournalEntry>) => {
      setCurrentEntry((prev) => {
        if (!prev) return prev;
        const updated: JournalEntry = {
          ...prev,
          ...updates,
          updatedAt: Date.now(),
        };

        // Clear existing debounce timer
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
        }

        // Debounce write to Firestore (1.2s)
        saveTimerRef.current = setTimeout(() => {
          performSave(updated);
        }, 1200);

        return updated;
      });
    },
    [performSave]
  );

  // 5. Force immediate manual save
  const handleManualSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    if (currentEntry) {
      await performSave(currentEntry);
    }
  }, [currentEntry, performSave]);

  // 6. User Actions
  const handleSignIn = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setAuthError(err?.message || "Google authentication failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      await signOutUser();
      setUser(null);
      setCurrentEntry(null);
    } catch (err: any) {
      console.error("Sign-out error:", err);
    }
  };

  const handleNewEntry = () => {
    if (!user) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const newEntry = createEmptyEntry(user.uid);
    setCurrentEntry(newEntry);
    setCurrentView("editor");
    setSaveStatus("idle");
    setSaveError(null);
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setCurrentEntry(entry);
    setCurrentView("editor");
    setSaveStatus("saved");
    setSaveError(null);
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteJournalEntryFromFirestore(user.uid, entryId);
      if (currentEntry?.id === entryId) {
        handleNewEntry();
      }
    } catch (err: any) {
      console.error("Delete entry error:", err);
      setSaveError("Failed to delete entry: " + err.message);
    }
  };

  // Auth loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-300 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs font-mono text-stone-400">Verifying secure session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      <Navbar
        user={user}
        saveStatus={saveStatus}
        onNewEntry={handleNewEntry}
        onOpenHistory={() => setCurrentView("history")}
        onSignOut={handleSignOut}
        historyCount={userEntries.length}
        currentView={currentView}
        onSwitchView={setCurrentView}
      />

      <main className="flex-1">
        {!user ? (
          <LandingHero
            onSignIn={handleSignIn}
            isLoading={authLoading}
            error={authError}
          />
        ) : currentView === "history" ? (
          <EntryHistory
            entries={userEntries}
            currentEntryId={currentEntry?.id || null}
            onSelectEntry={handleSelectEntry}
            onDeleteEntry={handleDeleteEntry}
            onNewEntry={handleNewEntry}
          />
        ) : (
          currentEntry && (
            <JournalEditor
              key={currentEntry.id}
              entry={currentEntry}
              onUpdateEntry={handleUpdateEntry}
              onManualSave={handleManualSave}
              onNewEntry={handleNewEntry}
              saveStatus={saveStatus}
              saveError={saveError}
            />
          )
        )}
      </main>
    </div>
  );
}
