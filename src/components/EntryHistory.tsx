import React, { useState, useMemo } from "react";
import { JournalEntry } from "../types";
import { 
  Search, 
  Trash2, 
  Clock, 
  Sparkles, 
  MessageSquare, 
  Tag, 
  Calendar, 
  ArrowRight,
  FileText,
  AlertCircle
} from "lucide-react";

interface EntryHistoryProps {
  entries: JournalEntry[];
  currentEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onNewEntry: () => void;
}

export const EntryHistory: React.FC<EntryHistoryProps> = ({
  entries,
  currentEntryId,
  onSelectEntry,
  onDeleteEntry,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      e.summary?.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().includes(q) ||
        entry.summary?.summary?.toLowerCase().includes(q) ||
        entry.summary?.tags?.some((t) => t.toLowerCase().includes(q)) ||
        entry.messages?.some((m) => m.content.toLowerCase().includes(q));

      const matchesTag = !selectedTag || entry.summary?.tags?.includes(selectedTag);

      return matchesSearch && matchesTag;
    });
  }, [entries, searchQuery, selectedTag]);

  const handleDelete = async (entryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDeletingId(entryId);
      await onDeleteEntry(entryId);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete entry:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-100">
            Past Reflections & Entries
          </h1>
          <p className="text-xs sm:text-sm text-stone-400 mt-1">
            All stored securely in your isolated Cloud Firestore vault ({entries.length} {entries.length === 1 ? "entry" : "entries"})
          </p>
        </div>

        <button
          onClick={onNewEntry}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
        >
          <FileText className="w-4 h-4" />
          <span>Write New Entry</span>
        </button>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries by keywords, topics, or AI insights..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-100 placeholder-stone-500 text-xs sm:text-sm focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-300"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tag Pills */}
        {allTags.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-stone-500 mr-1 flex items-center">
              <Tag className="w-3 h-3 mr-1" /> Filter:
            </span>
            <button
              onClick={() => setSelectedTag(null)}
              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                selectedTag === null
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200"
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  selectedTag === tag
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200"
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Entries List */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-stone-900/40 border border-stone-800/60 space-y-4">
          <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center mx-auto text-stone-400">
            <FileText className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-serif text-stone-200">
              {searchQuery || selectedTag ? "No reflections match your search" : "No journal entries yet"}
            </p>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              {searchQuery || selectedTag
                ? "Try adjusting your search criteria or clearing filters."
                : "Your thoughts and AI conversations will be saved and listed here once created."}
            </p>
          </div>
          {(!searchQuery && !selectedTag) && (
            <button
              onClick={onNewEntry}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium text-xs transition-all shadow-sm"
            >
              <span>Begin First Reflection</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredEntries.map((entry) => {
            const isCurrent = currentEntryId === entry.id;
            const messageCount = entry.messages?.length || 0;
            const words = entry.content ? entry.content.trim().split(/\s+/).filter(Boolean).length : 0;

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className={`group relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer bg-stone-900/80 hover:bg-stone-900 hover:border-amber-500/30 ${
                  isCurrent ? "border-amber-500/50 shadow-md shadow-amber-950/20 ring-1 ring-amber-500/20" : "border-stone-800/80"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Date & Meta Pill */}
                    <div className="flex items-center flex-wrap gap-2 text-xs text-stone-400">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5 text-stone-500" />
                        <span>{formatDate(entry.updatedAt || entry.createdAt)}</span>
                      </span>

                      <span className="text-stone-700">•</span>

                      <span className="text-[11px] px-2 py-0.5 rounded bg-stone-800 border border-stone-700/60 font-mono text-stone-300 uppercase">
                        {entry.mode || "reflect"}
                      </span>

                      {entry.summary?.sentiment && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {entry.summary.sentiment}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2 className="text-lg font-serif font-semibold text-stone-100 group-hover:text-amber-200 transition-colors truncate">
                      {entry.title || "Untitled Reflection"}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-xs sm:text-sm text-stone-300 line-clamp-2 leading-relaxed">
                      {entry.summary?.summary || entry.content || "Empty draft..."}
                    </p>

                    {/* Tags & Message Count */}
                    <div className="flex items-center flex-wrap gap-3 pt-2">
                      {entry.summary?.tags && entry.summary.tags.length > 0 && (
                        <div className="flex items-center flex-wrap gap-1.5">
                          {entry.summary.tags.slice(0, 4).map((tag, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded bg-stone-800/80 text-stone-400 border border-stone-700/40"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center space-x-3 text-xs text-stone-500 font-mono ml-auto">
                        {messageCount > 0 && (
                          <span className="flex items-center space-x-1 text-amber-400/80">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{messageCount} AI {messageCount === 1 ? "turn" : "turns"}</span>
                          </span>
                        )}
                        <span>{words} {words === 1 ? "word" : "words"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center sm:flex-col justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-800">
                    {confirmDeleteId === entry.id ? (
                      <div
                        className="flex items-center space-x-2 bg-stone-950 p-1.5 rounded-lg border border-rose-800/60 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[11px] text-rose-300">Delete?</span>
                        <button
                          onClick={(e) => handleDelete(entry.id, e)}
                          disabled={deletingId === entry.id}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-medium text-[11px]"
                        >
                          {deletingId === entry.id ? "..." : "Confirm"}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(entry.id);
                        }}
                        className="p-2 rounded-lg text-stone-500 hover:text-rose-400 hover:bg-stone-800/60 transition-colors"
                        title="Delete entry from Firestore"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}

                    <div className="sm:mt-auto hidden sm:flex items-center text-xs text-amber-400/80 group-hover:text-amber-300 font-medium">
                      <span>Open</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
