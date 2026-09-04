import { ReflectionPrompt } from "../types";

export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  {
    id: "clarity-decision",
    category: "Decisions & Strategy",
    title: "Navigating a Crossroads",
    prompt: "I am facing an important decision right now. Here are my current options, what's holding me back, and my underlying fears or hopes...",
    mode: "critique",
  },
  {
    id: "brainstorm-breakthrough",
    category: "Creativity & Goals",
    title: "Unlocking a Creative Solution",
    prompt: "I want to brainstorm bold, unconventional ideas for a project I'm working on. Here is what I want to achieve and what hasn't worked so far...",
    mode: "brainstorm",
  },
  {
    id: "gratitude-resilience",
    category: "Mindfulness & Gratitude",
    title: "Gratitude & Growth",
    prompt: "Reflecting on today: one win I experienced, one challenge that tested me, and something I am genuinely thankful for...",
    mode: "reflect",
  },
  {
    id: "emotional-unpack",
    category: "Self-Inquiry",
    title: "Untangling Complex Emotions",
    prompt: "I noticed a strong emotional reaction today when something happened. I want to unpack why it affected me and what lesson lies beneath it...",
    mode: "synthesize",
  },
  {
    id: "evening-review",
    category: "Daily Reflection",
    title: "Daily Sunset Synthesis",
    prompt: "How did I show up today relative to my values? What energy did I bring to others, and what do I want to release before sleep?",
    mode: "reflect",
  },
];
