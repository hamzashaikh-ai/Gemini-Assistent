import React from "react";
import { BookOpen, ShieldCheck, Sparkles, Lock, ArrowRight, CheckCircle, Database } from "lucide-react";

interface LandingHeroProps {
  onSignIn: () => void;
  isLoading: boolean;
  error: string | null;
}

export const LandingHero: React.FC<LandingHeroProps> = ({ onSignIn, isLoading, error }) => {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-stone-700/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl w-full text-center relative z-10 space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-stone-800/80 border border-stone-700/80 text-amber-300 text-xs font-medium tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Powered by Gemini 3.6 Flash & Cloud Firestore</span>
        </div>

        {/* Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-stone-100 tracking-tight leading-tight">
            Your Private Space for Deep Thoughts & AI Reflection
          </h1>
          <p className="text-base sm:text-lg text-stone-400 max-w-2xl mx-auto leading-relaxed font-sans">
            Write uninhibited journal entries, explore multi-turn reflections with Gemini, and unlock concise executive summaries. All entries are encrypted and strictly partitioned to your identity.
          </p>
        </div>

        {/* Auth CTA Card */}
        <div className="max-w-md mx-auto bg-stone-900/90 border border-stone-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-stone-950/50 backdrop-blur-xl">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
            
            <div className="text-center">
              <h2 className="text-lg font-serif font-semibold text-stone-100">Sign in to your private vault</h2>
              <p className="text-xs text-stone-400 mt-1">Federated authentication — no passwords stored</p>
            </div>

            {error && (
              <div className="w-full p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs text-left">
                {error}
              </div>
            )}

            <button
              onClick={onSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 px-6 py-3 rounded-xl bg-stone-100 hover:bg-white text-stone-900 font-medium text-sm transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                  <ArrowRight className="w-4 h-4 text-stone-600 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Security & Architecture Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 max-w-2xl mx-auto text-left">
          <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800/80 space-y-2">
            <div className="flex items-center space-x-2 text-amber-400">
              <Database className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-200">User-Isolated DB</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Every journal entry is saved exclusively to your isolated Firestore subcollection (<code className="text-stone-300">/users/$uid/entries</code>).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800/80 space-y-2">
            <div className="flex items-center space-x-2 text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-200">Gemini 3.6 Flash</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Multi-turn reflection, thoughtful inquiry, and executive summaries with high-speed automated fallback ladders.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800/80 space-y-2">
            <div className="flex items-center space-x-2 text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider text-stone-200">Zero-Leak Keys</span>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Gemini API keys and sensitive tokens remain strictly on the backend proxy and Secret Manager.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
