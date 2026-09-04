import React from "react";
import { User } from "firebase/auth";
import { 
  BookOpen, 
  Plus, 
  History, 
  LogOut, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  ShieldCheck,
  Sparkles
} from "lucide-react";

interface NavbarProps {
  user: User | null;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onNewEntry: () => void;
  onOpenHistory: () => void;
  onSignOut: () => void;
  historyCount: number;
  currentView: "editor" | "history";
  onSwitchView: (view: "editor" | "history") => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  saveStatus,
  onNewEntry,
  onOpenHistory,
  onSignOut,
  historyCount,
  currentView,
  onSwitchView,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-stone-900/90 backdrop-blur-md border-b border-stone-800 text-stone-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSwitchView("editor")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-950/30 text-stone-950">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-serif font-bold text-lg text-stone-100 tracking-tight">Gemini Journal</span>
              <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Firestore Isolated
              </span>
            </div>
            <p className="text-xs text-stone-400 hidden sm:block">AI-Assisted Personal Reflection & Clarity</p>
          </div>
        </div>

        {/* Center / Action Controls */}
        {user && (
          <div className="flex items-center space-x-3">
            {/* Save Status Indicator */}
            <div className="hidden md:flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-stone-800/80 border border-stone-700/60">
              {saveStatus === "saving" && (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span className="text-stone-300">Syncing to Firestore...</span>
                </>
              )}
              {saveStatus === "saved" && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-stone-300">Saved</span>
                </>
              )}
              {saveStatus === "error" && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-rose-300">Sync Failed</span>
                </>
              )}
              {saveStatus === "idle" && (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-stone-400">Encrypted in Cloud</span>
                </>
              )}
            </div>

            {/* New Entry Button */}
            <button
              onClick={onNewEntry}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium text-xs sm:text-sm transition-all shadow-sm hover:shadow-amber-500/20 active:scale-95"
              title="Start a new reflection entry"
            >
              <Plus className="w-4 h-4" />
              <span>New Reflection</span>
            </button>

            {/* View Switch / History Tab */}
            <button
              onClick={() => onSwitchView(currentView === "editor" ? "history" : "editor")}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm transition-all border ${
                currentView === "history"
                  ? "bg-stone-800 text-amber-300 border-amber-500/30"
                  : "bg-stone-900/60 hover:bg-stone-800 text-stone-300 border-stone-700 hover:text-stone-100"
              }`}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Past Reflections</span>
              <span className="px-1.5 py-0.2 rounded-full bg-stone-700 text-stone-300 text-[11px] font-mono">
                {historyCount}
              </span>
            </button>
          </div>
        )}

        {/* User Auth Profile */}
        {user ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 pl-2 border-l border-stone-800">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-8 h-8 rounded-full border border-stone-700 object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stone-700 flex items-center justify-center text-xs font-bold text-stone-200">
                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || "U"}
                </div>
              )}
              <div className="hidden lg:block text-left">
                <p className="text-xs font-medium text-stone-200 truncate max-w-[120px]">
                  {user.displayName || "Authenticated"}
                </p>
                <p className="text-[10px] text-stone-400 truncate max-w-[120px] font-mono">
                  {user.email || user.uid.slice(0, 8)}
                </p>
              </div>
            </div>

            <button
              onClick={onSignOut}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-stone-400 hidden sm:inline">Secure Google Auth</span>
          </div>
        )}
      </div>
    </header>
  );
};
