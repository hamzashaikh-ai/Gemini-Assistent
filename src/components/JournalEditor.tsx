import React, { useState, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import { 
  JournalEntry, 
  ChatMessage, 
  ReflectionMode, 
  ReflectionPrompt,
  EntrySummary 
} from "../types";
import { PromptPicker } from "./PromptPicker";
import { SummaryCard } from "./SummaryCard";
import { 
  Sparkles, 
  Send, 
  Save, 
  RefreshCw, 
  Bot, 
  User as UserIcon, 
  Compass, 
  Lightbulb, 
  HelpCircle, 
  Layers, 
  AlertCircle,
  Copy,
  Check,
  Eye,
  Edit3,
  PlusCircle,
  RotateCcw
} from "lucide-react";

interface JournalEditorProps {
  entry: JournalEntry;
  onUpdateEntry: (updated: Partial<JournalEntry>) => void;
  onManualSave: () => Promise<void>;
  onNewEntry?: () => void;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: string | null;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onUpdateEntry,
  onManualSave,
  onNewEntry,
  saveStatus,
  saveError,
}) => {
  const [chatInput, setChatInput] = useState("");
  const [isReflecting, setIsReflecting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isResilienceActive, setIsResilienceActive] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastFailedAction, setLastFailedAction] = useState<"reflect" | "summary" | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"write" | "preview">("write");

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Scroll chat into view on message addition
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entry.messages, isReflecting]);

  const wordCount = entry.content ? entry.content.trim().split(/\s+/).filter(Boolean).length : 0;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  const handleModeChange = (mode: ReflectionMode) => {
    onUpdateEntry({ mode });
  };

  const handleSelectPrompt = (prompt: ReflectionPrompt) => {
    const existingContent = entry.content.trim();
    const newContent = existingContent
      ? `${existingContent}\n\n### ${prompt.title}\n${prompt.prompt}`
      : `### ${prompt.title}\n${prompt.prompt}`;

    onUpdateEntry({
      content: newContent,
      mode: prompt.mode,
      title: entry.title || prompt.title,
    });
  };

  /**
   * Multi-turn reflection exchange with Gemini
   */
  const handleSendReflection = async (customPrompt?: string) => {
    const messageText = customPrompt || chatInput.trim();
    if (!messageText && !entry.content.trim()) return;

    setApiError(null);
    setLastFailedAction(null);
    setIsReflecting(true);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText || "Reflect on my writing and highlight interesting connections.",
      timestamp: Date.now(),
    };

    const updatedMessages = [...(entry.messages || []), userMessage];
    onUpdateEntry({ messages: updatedMessages });
    const originalInput = chatInput;
    setChatInput("");

    try {
      const response = await fetch("/api/gemini/reflect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalContent: entry.content,
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          mode: entry.mode || "reflect",
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to receive reflection from Gemini.");
      }

      if (data.isResilienceMode) {
        setIsResilienceActive(true);
      }
      setApiError(null);
      setLastFailedAction(null);

      const modelMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "model",
        content: data.response,
        timestamp: Date.now(),
      };

      onUpdateEntry({ messages: [...updatedMessages, modelMessage] });
      setLastFailedPrompt("");
    } catch (err: any) {
      console.error("Gemini reflection error:", err);
      setApiError(err.message || "Could not connect to Gemini API.");
      setLastFailedAction("reflect");
      setLastFailedPrompt(messageText);
      // Restore input if it was a manual user chat input so work is not lost
      if (originalInput) {
        setChatInput(originalInput);
      }
    } finally {
      setIsReflecting(false);
    }
  };

  /**
   * Generates AI Executive Summary & Takeaways
   */
  const handleGenerateSummary = async () => {
    const hasContent = Boolean(entry.content && entry.content.trim());
    const hasUserMessages = Boolean(entry.messages && entry.messages.some((m) => m.role === "user" && m.content.trim()));

    if (!hasContent && !hasUserMessages) {
      setApiError("Please write your journal entry or share a reflection before generating insights.");
      return;
    }

    setApiError(null);
    setLastFailedAction(null);
    setIsSummarizing(true);

    try {
      const response = await fetch("/api/gemini/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: entry.id,
          content: entry.content?.trim() || "",
          // Strictly isolate: do not pass chat inquiries if written entry content exists
          messages: entry.content?.trim() ? [] : (entry.messages || []),
        }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to synthesize summary.");
      }

      if (data.isResilienceMode) {
        setIsResilienceActive(true);
      }
      setApiError(null);
      setLastFailedAction(null);

      const summaryObj: EntrySummary = data.summary;
      const updates: Partial<JournalEntry> = {
        summary: summaryObj,
      };

      // Automatically apply suggested title to reflect current analysis
      if (summaryObj.suggestedTitle) {
        updates.title = summaryObj.suggestedTitle;
      }

      onUpdateEntry(updates);
    } catch (err: any) {
      console.error("Summary generation error:", err);
      setApiError(err.message || "Failed to generate AI summary.");
      setLastFailedAction("summary");
    } finally {
      setIsSummarizing(false);
    }
  };

  const copyToClipboard = () => {
    const formatted = `# ${entry.title || "Untitled Reflection"}\n\n${entry.content}\n\n---\n` +
      (entry.summary ? `### AI Summary\n${entry.summary.summary}\n\n` : "") +
      (entry.messages?.length
        ? `### Reflection Dialogue\n` +
          entry.messages.map((m) => `**${m.role === "user" ? "Me" : "Gemini"}**: ${m.content}`).join("\n\n")
        : "");

    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Sync Failure or API Error Alert with Actionable Retry */}
      {(saveError || apiError) && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex flex-wrap items-start justify-between gap-3 text-rose-200 text-xs sm:text-sm">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{saveError ? "Firestore Persistence Warning" : "Gemini API Notice"}</p>
              <p className="text-rose-300/90 text-xs mt-0.5">{saveError || apiError}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            {saveError && (
              <button
                onClick={onManualSave}
                className="px-3 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-medium text-xs transition-colors"
              >
                Retry Save
              </button>
            )}
            {apiError && lastFailedAction === "reflect" && (
              <button
                onClick={() => handleSendReflection(lastFailedPrompt)}
                disabled={isReflecting}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition-colors disabled:opacity-50"
              >
                Retry Reflection
              </button>
            )}
            {apiError && lastFailedAction === "summary" && (
              <button
                onClick={handleGenerateSummary}
                disabled={isSummarizing}
                className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition-colors disabled:opacity-50"
              >
                Retry Summary
              </button>
            )}
            <button
              onClick={() => {
                setApiError(null);
                setLastFailedAction(null);
              }}
              className="p-1 rounded text-rose-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Top Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Writing Canvas (8 cols on lg) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Header Controls & Mode Selector */}
          <div className="bg-stone-900/90 border border-stone-800 rounded-2xl p-5 space-y-4 shadow-xl shadow-stone-950/20">
            {/* Title & Metadata */}
            <div className="space-y-2">
              <input
                type="text"
                value={entry.title || ""}
                onChange={(e) => onUpdateEntry({ title: e.target.value })}
                placeholder="Give your reflection a title (or leave blank for AI to name)..."
                className="w-full bg-transparent font-serif text-xl sm:text-2xl font-bold text-stone-100 placeholder-stone-600 focus:outline-none focus:ring-0 border-b border-transparent focus:border-stone-700 transition-colors pb-1"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-stone-400 border-t border-stone-800/80">
                <div className="flex items-center space-x-3 font-mono">
                  <span>{wordCount} words</span>
                  <span className="text-stone-700">•</span>
                  <span>~{readTimeMinutes} min read</span>
                </div>

                <div className="flex items-center space-x-1.5">
                  {onNewEntry && (
                    <button
                      onClick={onNewEntry}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-800/40 transition-colors"
                      title="Start fresh blank reflection"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>New Entry</span>
                    </button>
                  )}

                  <button
                    onClick={() => setViewMode("write")}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewMode === "write"
                        ? "bg-stone-800 text-stone-100"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editor</span>
                  </button>

                  <button
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                      viewMode === "preview"
                        ? "bg-stone-800 text-stone-100"
                        : "text-stone-400 hover:text-stone-200"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-md text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors"
                    title="Copy full entry & dialogue"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Reflection Modes */}
            <div className="space-y-1.5 pt-2 border-t border-stone-800/60">
              <span className="text-[10px] uppercase font-mono tracking-wider text-stone-500 block">
                AI Companion Stance
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleModeChange("reflect")}
                  className={`flex items-center space-x-1.5 p-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    entry.mode === "reflect"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-stone-900/60 text-stone-400 border-stone-800 hover:border-stone-700"
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Reflect & Ground</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("brainstorm")}
                  className={`flex items-center space-x-1.5 p-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    entry.mode === "brainstorm"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-stone-900/60 text-stone-400 border-stone-800 hover:border-stone-700"
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Brainstorm</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("critique")}
                  className={`flex items-center space-x-1.5 p-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    entry.mode === "critique"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-stone-900/60 text-stone-400 border-stone-800 hover:border-stone-700"
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Constructive Inquiry</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("synthesize")}
                  className={`flex items-center space-x-1.5 p-2 rounded-xl text-xs font-medium border transition-all text-left ${
                    entry.mode === "synthesize"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-stone-900/60 text-stone-400 border-stone-800 hover:border-stone-700"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Synthesize</span>
                </button>
              </div>
            </div>

            {/* Writing Area */}
            {viewMode === "write" ? (
              <textarea
                value={entry.content || ""}
                onChange={(e) => onUpdateEntry({ content: e.target.value })}
                placeholder="Write your thoughts freely... What happened today? What challenges are you wrestling with? What do you feel deeply about?"
                rows={14}
                className="w-full bg-stone-950/60 rounded-xl p-4 text-stone-200 placeholder-stone-600 text-sm sm:text-base leading-relaxed focus:outline-none focus:ring-1 focus:ring-amber-500/30 border border-stone-800/80 resize-y font-sans transition-all"
              />
            ) : (
              <div className="min-h-[350px] bg-stone-950/60 rounded-xl p-5 border border-stone-800/80 text-stone-200 text-sm sm:text-base leading-relaxed overflow-y-auto">
                {entry.content ? (
                  <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-serif prose-headings:text-amber-200">
                    <Markdown>{entry.content}</Markdown>
                  </div>
                ) : (
                  <p className="text-stone-600 italic">No content written yet. Switch to Editor tab to begin.</p>
                )}
              </div>
            )}

            {/* Prompt Starter Picker */}
            <PromptPicker onSelectPrompt={handleSelectPrompt} />

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-800">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isSummarizing || (!entry.content && !entry.messages?.length)}
                  className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-100 font-medium text-xs sm:text-sm border border-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm group"
                >
                  <Sparkles className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                  <span>{isSummarizing ? "Synthesizing..." : "Generate AI Insights & Summary"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSendReflection("Please examine my writing and ask 2 thoughtful questions to help me go deeper.")}
                  disabled={isReflecting || !entry.content}
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 text-xs border border-stone-800 transition-colors disabled:opacity-40"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Ask Reflection Questions</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onManualSave}
                disabled={saveStatus === "saving"}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saveStatus === "saving" ? "Saving..." : "Save to Vault"}</span>
              </button>
            </div>
          </div>

          {/* AI Summary Card (if generated) */}
          {entry.summary && (
            <SummaryCard
              summary={entry.summary}
              currentTitle={entry.title}
              onApplyTitle={(suggestedTitle) => onUpdateEntry({ title: suggestedTitle })}
            />
          )}
        </div>

        {/* Right / Multi-turn Gemini Reflection Dialogue (5 cols on lg) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-stone-900/90 border border-stone-800 rounded-2xl flex flex-col h-[650px] shadow-xl shadow-stone-950/20 overflow-hidden">
          {/* Dialogue Header */}
          <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/90">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-serif font-semibold text-sm text-stone-100">Gemini Companion</h3>
                <p className="text-[11px] text-stone-400 font-mono">Gemini 3.6 Flash Active</p>
              </div>
            </div>

            {entry.messages && entry.messages.length > 0 && (
              <button
                onClick={() => onUpdateEntry({ messages: [] })}
                className="text-[11px] text-stone-500 hover:text-stone-300 font-mono transition-colors"
                title="Clear dialogue history for this entry"
              >
                Clear Chat
              </button>
            )}
          </div>

          {/* Dialogue Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs sm:text-sm">
            {(!entry.messages || entry.messages.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-500 space-y-3">
                <div className="w-10 h-10 rounded-full bg-stone-800/80 flex items-center justify-center text-stone-400">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-serif text-stone-300 text-sm">Dialogue & Inquiry</p>
                  <p className="text-xs text-stone-400 leading-relaxed max-w-xs">
                    Ask Gemini to brainstorm angles, challenge your assumptions, or provide thoughtful advice regarding what you wrote.
                  </p>
                </div>
                <button
                  onClick={() => handleSendReflection()}
                  disabled={isReflecting || !entry.content}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs border border-stone-700 transition-colors disabled:opacity-40"
                >
                  Start Reflection on Current Draft
                </button>
              </div>
            ) : (
              entry.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col space-y-1 ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center space-x-1.5 text-[10px] text-stone-500 font-mono px-1">
                    {msg.role === "user" ? (
                      <>
                        <span>You</span>
                        <UserIcon className="w-3 h-3" />
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>{isResilienceActive ? "Gemini AI (Resilience)" : "Gemini AI"}</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl max-w-[90%] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-amber-500/15 border border-amber-500/30 text-stone-100 rounded-tr-none"
                        : "bg-stone-800/80 border border-stone-700/60 text-stone-200 rounded-tl-none"
                    }`}
                  >
                    <div className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  </div>
                </div>
              ))
            )}

            {isReflecting && (
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 rounded-full bg-stone-800 flex items-center justify-center text-amber-400 shrink-0">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                </div>
                <div className="p-3 rounded-2xl rounded-tl-none bg-stone-800/50 border border-stone-700/40 text-stone-400 text-xs flex items-center space-x-2">
                  <span className="animate-pulse">Gemini is reflecting on your thoughts...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Dialogue Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendReflection();
            }}
            className="p-3 border-t border-stone-800 bg-stone-900/90 flex items-center space-x-2"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask a question or explore a thought..."
              disabled={isReflecting}
              className="flex-1 bg-stone-950/80 border border-stone-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={isReflecting || (!chatInput.trim() && !entry.content.trim())}
              className="p-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm active:scale-95"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
