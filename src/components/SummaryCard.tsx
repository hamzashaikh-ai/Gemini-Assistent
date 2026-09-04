import React from "react";
import { EntrySummary } from "../types";
import { Sparkles, CheckCircle, Tag, Smile, Lightbulb } from "lucide-react";

interface SummaryCardProps {
  summary: EntrySummary;
  onApplyTitle?: (title: string) => void;
  currentTitle?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary, onApplyTitle, currentTitle }) => {
  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case "optimistic":
      case "grateful":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "determined":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "challenged":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "reflective":
      default:
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    }
  };

  return (
    <div className="rounded-2xl bg-stone-900/90 border border-amber-500/20 p-5 space-y-4 shadow-xl shadow-amber-950/10">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-serif font-semibold text-sm text-stone-100">
            Gemini Executive Summary & Insights
          </span>
        </div>

        {summary.sentiment && (
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full border font-medium flex items-center space-x-1 ${getSentimentColor(
              summary.sentiment
            )}`}
          >
            <Smile className="w-3 h-3 mr-1 inline" />
            {summary.sentiment}
          </span>
        )}
      </div>

      {/* Suggested Title */}
      {summary.suggestedTitle && (
        <div className="flex items-center justify-between bg-stone-800/60 p-3 rounded-xl border border-stone-700/50">
          <div>
            <span className="text-[10px] uppercase font-mono text-stone-400 block">Suggested Title</span>
            <p className="text-sm font-serif font-medium text-amber-200">{summary.suggestedTitle}</p>
          </div>
          {onApplyTitle && currentTitle !== summary.suggestedTitle && (
            <button
              onClick={() => onApplyTitle(summary.suggestedTitle!)}
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
            >
              Use this title
            </button>
          )}
        </div>
      )}

      {/* Executive Summary */}
      <div className="space-y-1">
        <span className="text-[10px] uppercase font-mono text-stone-400">Synthesis</span>
        <p className="text-xs sm:text-sm text-stone-300 leading-relaxed bg-stone-950/40 p-3 rounded-xl border border-stone-800/60">
          {summary.summary}
        </p>
      </div>

      {/* Key Takeaways */}
      {summary.keyTakeaways && summary.keyTakeaways.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-mono text-stone-400 flex items-center space-x-1">
            <Lightbulb className="w-3 h-3 text-amber-400 inline" />
            <span>Key Takeaways</span>
          </span>
          <ul className="space-y-1.5">
            {summary.keyTakeaways.map((takeaway, idx) => (
              <li
                key={idx}
                className="flex items-start space-x-2 text-xs text-stone-300 bg-stone-800/40 p-2 rounded-lg border border-stone-800/60"
              >
                <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tags */}
      {summary.tags && summary.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Tag className="w-3 h-3 text-stone-500 mr-1" />
          {summary.tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-[11px] px-2 py-0.5 rounded-md bg-stone-800 text-stone-400 border border-stone-700/60"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
