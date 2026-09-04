import React from "react";
import { REFLECTION_PROMPTS } from "../data/prompts";
import { ReflectionPrompt } from "../types";
import { Sparkles, Lightbulb, Compass, Heart, Moon } from "lucide-react";

interface PromptPickerProps {
  onSelectPrompt: (prompt: ReflectionPrompt) => void;
}

export const PromptPicker: React.FC<PromptPickerProps> = ({ onSelectPrompt }) => {
  const getIcon = (id: string) => {
    switch (id) {
      case "clarity-decision":
        return <Compass className="w-3.5 h-3.5 text-blue-400" />;
      case "brainstorm-breakthrough":
        return <Lightbulb className="w-3.5 h-3.5 text-amber-400" />;
      case "gratitude-resilience":
        return <Heart className="w-3.5 h-3.5 text-rose-400" />;
      case "emotional-unpack":
        return <Sparkles className="w-3.5 h-3.5 text-purple-400" />;
      case "evening-review":
        return <Moon className="w-3.5 h-3.5 text-indigo-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-stone-400 px-1">
        <span className="font-medium">Thought Starters & Reflection Templates</span>
        <span>Click to insert</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {REFLECTION_PROMPTS.map((prompt) => (
          <button
            key={prompt.id}
            onClick={() => onSelectPrompt(prompt)}
            className="flex items-start space-x-2.5 p-2.5 rounded-xl bg-stone-900/70 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-left transition-all duration-150 group"
          >
            <div className="p-1.5 rounded-lg bg-stone-800 group-hover:bg-stone-700/80 transition-colors">
              {getIcon(prompt.id)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-stone-200 group-hover:text-amber-300 truncate">
                  {prompt.title}
                </p>
                <span className="text-[10px] text-stone-500 uppercase font-mono">
                  {prompt.mode}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 truncate mt-0.5">
                {prompt.category}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
