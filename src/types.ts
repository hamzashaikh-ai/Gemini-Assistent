export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface EntrySummary {
  suggestedTitle?: string;
  summary: string;
  keyTakeaways: string[];
  tags: string[];
  sentiment?: 'Optimistic' | 'Reflective' | 'Challenged' | 'Grateful' | 'Determined' | 'Neutral' | string;
}

export type ReflectionMode = 'reflect' | 'brainstorm' | 'critique' | 'synthesize';

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  messages: ChatMessage[];
  mode: ReflectionMode;
  summary?: EntrySummary;
  createdAt: number;
  updatedAt: number;
  wordCount?: number;
}

export interface ReflectionPrompt {
  id: string;
  category: string;
  title: string;
  prompt: string;
  mode: ReflectionMode;
}
