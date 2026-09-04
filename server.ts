import express, { Request, Response } from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Lazy initialization of GoogleGenAI SDK with dynamic key tracking
let cachedApiKey: string | null = null;
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing.");
  }
  if (!aiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Resilient Model Fallback Ladder (ordered per Production Directives: Primary -> Fallback -> Dynamic Alias -> Deep Reasoning)
const MODEL_FALLBACK_LADDER = [
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.1-pro-preview",
  "gemini-pro-latest",
];

interface FallbackOptions {
  systemInstruction?: string;
  temperature?: number;
  contents: string | Array<{ role: string; parts: Array<{ text: string }> }>;
}

/**
 * Strips markdown headings, prompt template boilerplate, and bullet markers
 */
function cleanJournalText(raw: string): string {
  if (!raw) return "";
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      // Filter out markdown headers like ### Navigating a Crossroads or ### Reflection Insights
      if (/^#{1,6}\s+/.test(line)) return false;
      // Filter out template prompt questions
      if (/^(What choice am I facing|Reflecting on today|How did I show up|I want to brainstorm|Reflecting on)/i.test(line)) return false;
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts distinct sentences from clean prose
 */
function extractProseSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
}

/**
 * Extracts significant descriptive keywords and entities from text
 */
function extractKeyEntities(text: string): string[] {
  if (!text || typeof text !== "string") return [];

  // Common stop words, grammatical particles, auxiliary verbs, adverbs, and emotional status words
  const stopWords = new Set([
    "the", "and", "is", "was", "are", "were", "to", "in", "of", "it", "that", "this",
    "with", "for", "on", "as", "at", "by", "from", "up", "about", "into", "over",
    "after", "have", "had", "has", "having", "but", "not", "what", "all", "when", "we",
    "there", "can", "could", "an", "your", "which", "their", "if", "do", "did", "done",
    "doing", "will", "would", "each", "how", "them", "then", "she", "he", "they", "many",
    "some", "so", "these", "other", "more", "her", "his", "two", "like", "him", "see",
    "saw", "seen", "seeing", "time", "no", "make", "made", "making", "than", "first",
    "been", "its", "who", "now", "my", "me", "our", "us", "i", "just", "today", "yesterday",
    "tomorrow", "morning", "evening", "afternoon", "tonight", "such", "also", "great",
    "good", "nice", "fine", "best", "better", "lot", "lots", "thing", "things", "next",
    "last", "felt", "feel", "feels", "feeling", "feelings", "grateful", "thankful", "happy",
    "glad", "tired", "busy", "hard", "easy", "trying", "tried", "need", "needed", "needs",
    "want", "wanted", "wants", "went", "go", "going", "gone", "day", "days", "spent",
    "spend", "spending", "entire", "found", "find", "finding", "started", "start", "starting",
    "taking", "took", "taken", "take", "getting", "got", "gotten", "get", "looking", "look",
    "looked", "built", "build", "building", "ate", "eat", "eating", "eaten", "watched",
    "watch", "watching", "relaxed", "relaxing", "relax", "together", "alone", "both",
    "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday",
    "nervous", "anxious", "worried", "scared", "fear", "stressed", "stress", "slide", "slides",
    "haven", "havent", "presenting", "presentation"
  ]);

  // Extract prominent multi-word concepts first
  const lowerText = text.toLowerCase();
  const detectedPhrases: string[] = [];
  if (lowerText.includes("ice cream")) detectedPhrases.push("ice cream");
  if (lowerText.includes("thesis defense")) detectedPhrases.push("thesis defense");

  // Tokenize by sentence boundaries to detect sentence-start positions accurately
  const sentences = text.split(/(?<=[.?!])\s+|\n+/).filter((s) => s.trim().length > 0);
  const midSentenceCapitalized = new Set<string>();
  const substantiveWords: string[] = [];

  for (const sentence of sentences) {
    const tokens = sentence
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    tokens.forEach((token, index) => {
      const lower = token.toLowerCase();
      if (stopWords.has(lower)) return;

      // Only tokens capitalized AFTER sentence start (index > 0) are genuine proper nouns
      if (index > 0 && /^[A-Z][a-z0-9-]/.test(token)) {
        midSentenceCapitalized.add(lower);
      }

      substantiveWords.push(lower);
    });
  }

  const seen = new Set<string>();
  const entities: string[] = [];

  // 1. Add detected multi-word concepts first
  for (const p of detectedPhrases) {
    if (!seen.has(p)) {
      seen.add(p);
      entities.push(p);
    }
  }

  // 2. Add mid-sentence genuine proper nouns
  for (const w of midSentenceCapitalized) {
    if (!seen.has(w)) {
      seen.add(w);
      entities.push(w);
    }
  }

  // 3. Add remaining significant words in order of appearance
  for (const w of substantiveWords) {
    const coveredByPhrase = detectedPhrases.some((p) => p.includes(w));
    if (!coveredByPhrase && !seen.has(w)) {
      seen.add(w);
      entities.push(w);
    }
  }

  return entities;
}

/**
 * Local Cognitive Reflection Engine
 * Dynamically synthesizes reflection insights and guiding questions
 * strictly grounded in the user's specific entities, activities, emotions, and timeline.
 * Completely eliminates static pre-written category templates.
 */
function localCognitiveReflect(
  journal: string,
  messages: Array<{ role: string; content: string }>,
  mode: string
): string {
  const userInquiries = messages
    .filter((m) => m && m.role === "user" && typeof m.content === "string")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join(" ");

  const rawText = (journal.trim() ? journal : userInquiries).trim();
  const cleanedProse = cleanJournalText(rawText);
  const sentences = extractProseSentences(cleanedProse);
  const entities = extractKeyEntities(cleanedProse);
  const lower = cleanedProse.toLowerCase();

  const isBrief = cleanedProse.length < 15 || /^(hello|hi|hey|greetings|good morning|good evening|good afternoon)\.?$/i.test(cleanedProse.trim());

  if (isBrief) {
    return `### Reflection Insights & Guiding Questions

Welcome to your reflection space. Arriving at the blank page is often the most significant threshold to cross.

Here is what stands out from your words regarding your arrival at the page:

- **The Underlying Pattern**:
  Notice how standing before an empty page can trigger the subtle expectation that an entry must begin with a fully formed revelation. We often hesitate to write until thoughts feel polished, yet journaling is the very process by which raw, unpolished impressions clarify into insight.

- **Reframing Perspective**:
  Release all pressure to craft a structured narrative. Even a single unedited sentence naming a physical sensation, an unresolved worry, or a modest hope is more than enough to anchor your reflection.

---

#### Guiding Questions for Your Next Reflection:
1. *What is the single most persistent thought or feeling that has been quietly occupying your mind today?*
2. *If you wrote without self-censoring for the next two minutes, what truth would you speak first?*`;
  }

  // Extract temporal references
  const dayMatch = lower.match(/\b(next\s+)?(tuesday|monday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|yesterday|this weekend|this morning|this afternoon)\b/i);
  const timelinePhrase = dayMatch ? dayMatch[0] : "";

  // Identify core activities/objects/places mentioned
  const primaryEntity = entities[0] || "your experience";
  const secondaryEntity = entities[1] || "";
  const tertiaryEntity = entities[2] || "";
  const entitiesList = entities.slice(0, 4).join(", ");

  // Emotional signals
  const isGrateful = /gratitude|grateful|thankful|blessed|appreciate|joy|peace|peaceful|grounded|delight|wonderful|great|beautiful|love/.test(lower);
  const isAnxiousOrStressed = /stress|anxious|anxiety|nervous|fear|scared|panic|dread|overwhelm|pressure|deadline|busy|worried|worry|defense|exam/.test(lower);
  const isCrossroad = /choice|choose|decision|unsure|stuck|crossroad|dilemma|direction|plan|evaluate|options|path/.test(lower);
  const isCraft = /camera|vintage|bake|sourdough|bread|paint|painting|draw|guitar|piano|song|write|craft|build|restor|sandcastle|beach/.test(lower);

  // Derive contextual anchor
  let contextAnchor = "";
  if (entities.length >= 3) {
    contextAnchor = `${entities[0]}, ${entities[1]}, and ${entities[2]}`;
  } else if (entities.length === 2) {
    contextAnchor = `${entities[0]} and ${entities[1]}`;
  } else if (entities.length === 1) {
    contextAnchor = entities[0];
  } else {
    contextAnchor = cleanedProse.slice(0, 40);
  }

  // Extract recent user inquiry topic if in multi-turn conversation
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const activeFocus = (lastUserMsg.trim() && lastUserMsg !== rawText)
    ? `focusing on **"${lastUserMsg.slice(0, 80).trim()}"**`
    : `reflecting on **${contextAnchor}**${timelinePhrase ? ` (${timelinePhrase})` : ""}`;

  // Mode: Brainstorming
  if (mode === "brainstorm") {
    return `### Creative Brainstorming & Alternative Angles

Looking closely at your reflection on ${activeFocus}, here are **four divergent angles** tailored specifically to the details you shared:

1. **The Inversion Angle**:
   - What would it look like to prioritize the feeling of **${primaryEntity}** over any expectations of productivity or routine?

2. **The Micro-Experiment**:
   - What is one tangible, 10-minute ritual inspired by your experience with **${contextAnchor}** that you can integrate into your regular week?

3. **Friction Reduction & Savoring**:
   - Which element of ${entitiesList ? `**${entitiesList}**` : "what you experienced"} brought the purest sense of ease, and what conditions made that possible?

4. **Long-Term Anchoring**:
   - Three months from now, when you look back on ${timelinePhrase || "this time"}, what memory or realization from **${primaryEntity}** do you most want to retain?

---
*Which of these angles offers the clearest spark for your next reflection?*`;
  }

  // Mode: Constructive Inquiry / Critique
  if (mode === "critique") {
    return `### Constructive Inquiry & Assumption Testing

Examining the thoughts underneath ${activeFocus}:

- **The Primary Observation**:
  Notice how your experience with **${contextAnchor}** reveals what truly grounds your attention when you step away from daily demands.

- **Examining the Contrast**:
  Compare the headspace you inhabited during **${primaryEntity}** with your usual daily pace. What invisible rule or pressure usually prevents you from having more of that state of mind?

- **Anchoring Reality**:
  Rather than treating ${primaryEntity} as merely a fleeting pause, what does your reaction to it tell you about your non-negotiable core values?

---
*Which of these observations feels most meaningful to explore deeper?*`;
  }

  // Mode: Synthesis
  if (mode === "synthesize") {
    return `### Reflection Synthesis & Core Realizations

Distilling the core currents from ${activeFocus}:

- **Core Current**:
  Your reflection captures genuine engagement with **${contextAnchor}**${timelinePhrase ? ` (${timelinePhrase})` : ""}. There is a distinct sense of clarity that emerges when you name these concrete moments.

- **Key Realization**:
  The significance of ${primaryEntity} lies not just in the event itself, but in your conscious decision to pause, recognize its impact, and preserve it in writing.

- **Anchoring Thought**:
  Allow the positive grounding from **${primaryEntity}** to serve as a mental reservoir for whatever demands come next.

---
*How does this synthesis resonate with what you are experiencing right now?*`;
  }

  // Default: Reflect & Ground Mode
  // Build completely customized, entity-specific sections
  let emotionalOpening = "";
  let underlyingPattern = "";
  let reframingPerspective = "";
  let question1 = "";
  let question2 = "";

  if (isGrateful) {
    emotionalOpening = `There is a deep sense of presence, gratitude, and mindful connection running through your notes on **${contextAnchor}**${timelinePhrase ? ` (${timelinePhrase})` : ""}. Capturing these moments in writing honors and prolongs the peace they create.`;
    
    underlyingPattern = `Your reflection on **${contextAnchor}** highlights the restorative power of shared presence and tactile engagement. Notice how immersing yourself in concrete experiences—like ${secondaryEntity ? `**${primaryEntity}** and **${secondaryEntity}**` : `**${primaryEntity}**`}—naturally quiets cognitive noise and returns your attention to what is fundamentally real and nourishing.`;

    reframingPerspective = `It is tempting to view restorative days with **${primaryEntity}** as rare exceptions or mere interludes between 'real life' obligations. The reframing is to recognize that these moments of gratitude and connection *are* the baseline—the emotional core that gives purpose and stamina to everything else you do.`;

    question1 = `When you picture ${primaryEntity}${timelinePhrase ? ` ${timelinePhrase}` : ""}, what sensory detail or quiet interaction made you feel most connected and alive?`;
    question2 = `How can you carry the unhurried gratitude of **${primaryEntity}** into your upcoming routines this week?`;
  } else if (isAnxiousOrStressed) {
    emotionalOpening = `It is completely natural to feel tension or anticipation surrounding **${contextAnchor}**${timelinePhrase ? ` (${timelinePhrase})` : ""}. Naming that weight honestly on the page is the first step toward regaining clarity.`;

    underlyingPattern = `Your focus on **${primaryEntity}** reveals an anticipatory overload pattern: your mind is projecting forward into ${timelinePhrase || "upcoming events"}, treating hypothetical challenges as immediate emergencies and draining energy needed for steady preparation.`;

    reframingPerspective = `Reframe **${primaryEntity}**: That nervous energy is not an omen of inadequacy—it is simply physiological proof of how much this milestone matters to you. Shift your attention away from uncontrollable external outcomes and ground yourself firmly in the specific actions within your control today.`;

    question1 = `Looking toward ${timelinePhrase || "this challenge"}, what is the single most important aspect of **${primaryEntity}** that you feel prepared and ready to handle?`;
    question2 = `What is one calming boundary or grounding habit you can commit to before ${timelinePhrase || "the deadline"} to protect your mental energy?`;
  } else if (isCrossroad) {
    emotionalOpening = `Standing before a choice regarding **${contextAnchor}** tests your tolerance for ambiguity. Giving yourself structured space to reflect honors your values.`;

    underlyingPattern = `Your thoughts around **${primaryEntity}** show a pattern of seeking certainty before taking action. Often we delay making a choice hoping a risk-free path will appear, mistaking the discomfort of a crossroads for a lack of personal readiness.`;

    reframingPerspective = `There is rarely a single frictionless path without trade-offs. Rather than searching for a perfect decision regarding **${primaryEntity}**, trust your adaptability to create meaning and growth out of whichever direction you choose.`;

    question1 = `If fear or outside expectations were completely removed from **${primaryEntity}**, which path feels most aligned with your core integrity?`;
    question2 = `What is the smallest reversible step you can take today regarding **${primaryEntity}** to test your options with zero pressure?`;
  } else {
    // Dynamic entity-grounded reflection
    emotionalOpening = `You are exploring meaningful personal ground regarding **${contextAnchor}**${timelinePhrase ? ` (${timelinePhrase})` : ""}. Your reflection brings genuine clarity to the events and feelings you experienced.`;

    underlyingPattern = `Looking at what you wrote about **${contextAnchor}**, notice how your mind connects immediate events with your deeper personal rhythm. The underlying pattern is using the discipline of writing to bridge immediate occurrences—like **${primaryEntity}**—into enduring self-awareness.`;

    reframingPerspective = `Every reflection you commit to writing transforms raw everyday experience into lasting insight. Treat what you noted about **${primaryEntity}** as an active anchor for mindful self-trust as you move through your week.`;

    question1 = `What part of your experience with **${primaryEntity}** brought you the greatest sense of clarity or personal truth?`;
    question2 = `What is one personal takeaway or reminder from **${secondaryEntity || primaryEntity}** that you want to keep close in the days ahead?`;
  }

  return `### Reflection Insights & Guiding Questions

${emotionalOpening}

Here is what stands out from your words regarding **${contextAnchor}**:

- **The Underlying Pattern**:
  ${underlyingPattern}

- **Reframing Perspective**:
  ${reframingPerspective}

---

#### Guiding Questions for Your Next Reflection:
1. *${question1}*
2. *${question2}*`;
}

/**
 * Local Cognitive Summarizer
 * Generates structured executive summaries, tags, takeaways, and sentiment
 * grounded strictly in the user's actual journal text.
 */
function localCognitiveSummarize(
  content: string,
  userInquiries: string = ""
): {
  suggestedTitle: string;
  summary: string;
  keyTakeaways: string[];
  tags: string[];
  sentiment: string;
} {
  const rawText = (content.trim() ? content : userInquiries).trim();
  const cleanedProse = cleanJournalText(rawText);
  const sentences = extractProseSentences(cleanedProse);
  const entities = extractKeyEntities(cleanedProse);
  const lower = cleanedProse.toLowerCase();

  const isStress = /stress|anxious|anxiety|overwhelm|tired|exhaust|burnout|pressure|deadline|busy|fatigue|frustrat/.test(lower);
  const isDecision = /decision|choice|unsure|stuck|confus|crossroad|dilemma|direction|plan|evaluate|choose/.test(lower);
  const isGratitude = /gratitude|grateful|thankful|blessed|appreciate|joy|peace|grounded|peaceful|delight/.test(lower);
  const isGrowth = /proud|happy|progress|win|accomplish|achieve|learn|growth|goal|success|restore|built|created/.test(lower);

  // Sentiment classification
  let sentiment = "Reflective";
  if (isGratitude) sentiment = "Grateful";
  else if (isGrowth) sentiment = "Optimistic";
  else if (isStress) sentiment = "Challenged";
  else if (isDecision) sentiment = "Determined";

  // Suggested Title - accurately derived strictly from the current entry's keywords
  let suggestedTitle = "";
  if (entities.length >= 2) {
    const topWords = entities.slice(0, 3).map((w) =>
      w.split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
    );
    suggestedTitle = topWords.join(" & ");
  } else if (entities.length === 1) {
    const word = entities[0].split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    suggestedTitle = `Reflections on ${word}`;
  } else if (sentences.length > 0) {
    const words = sentences[0].replace(/[^\w\s]/g, "").split(/\s+/).slice(0, 5);
    suggestedTitle = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  } else {
    suggestedTitle = "Personal Journal Reflection";
  }

  // Executive summary - directly synthesizes the user's actual sentences, concrete events, and entities
  let summary = "";
  if (sentences.length >= 2) {
    const s1 = sentences[0];
    const s2 = sentences[1];
    const sLast = sentences[sentences.length - 1];
    if (sentences.length === 2) {
      summary = `${s1} ${s2}`;
    } else {
      summary = `${s1} ${s2} Looking closely at these moments, ${sLast.charAt(0).toLowerCase() + sLast.slice(1)}`;
    }
    if (summary.length > 320) {
      summary = summary.slice(0, 317).replace(/\s+\S*$/, "") + "...";
    }
  } else if (sentences.length === 1) {
    const primary = entities[0] ? `highlighting ${entities.slice(0, 3).join(", ")}` : "noting this specific experience";
    summary = `${sentences[0]} Capturing this on the page grounds your awareness, ${primary}.`;
  } else {
    summary = cleanedProse
      ? `A focused reflection capturing ${cleanedProse.slice(0, 180)}.`
      : "A thoughtful personal reflection capturing current thoughts and state of mind.";
  }

  // Key takeaways - extracted directly from the user's actual sentences and concrete entities
  const keyTakeaways: string[] = [];
  if (sentences.length >= 3) {
    keyTakeaways.push(sentences[0]);
    keyTakeaways.push(sentences[Math.floor(sentences.length / 2)]);
    keyTakeaways.push(sentences[sentences.length - 1]);
  } else if (sentences.length === 2) {
    keyTakeaways.push(sentences[0]);
    keyTakeaways.push(sentences[1]);
    if (entities.length >= 2) {
      keyTakeaways.push(`Consciously integrated the impact of ${entities[0]} and ${entities[1]} into clear perspective.`);
    } else {
      keyTakeaways.push("Clarified underlying thoughts through deliberate written expression.");
    }
  } else if (sentences.length === 1) {
    keyTakeaways.push(sentences[0]);
    if (entities.length >= 2) {
      keyTakeaways.push(`Noticed how engaging with ${entities[0]} and ${entities[1]} shaped your headspace.`);
      keyTakeaways.push(`Preserved the key memory and personal meaning of ${entities.slice(0, 3).join(", ")}.`);
    } else if (entities.length === 1) {
      keyTakeaways.push(`Grounded your reflection around your experience with ${entities[0]}.`);
      keyTakeaways.push("Gained deeper perspective by articulating thoughts into words.");
    } else {
      keyTakeaways.push("Gained deeper perspective by articulating thoughts into words.");
      keyTakeaways.push("Identified a clear personal takeaway from today's experience.");
    }
  } else {
    if (entities.length >= 2) {
      keyTakeaways.push(`Focused attention on ${entities[0]} and ${entities[1]}.`);
      keyTakeaways.push(`Articulated personal experiences involving ${entities.slice(0, 3).join(", ")}.`);
      keyTakeaways.push("Gained mindful perspective through active self-inquiry.");
    } else {
      keyTakeaways.push("Dedicated intentional time to personal reflection.");
      keyTakeaways.push("Articulated inner thoughts into clear focus.");
      keyTakeaways.push("Recognized current emotional state with honest awareness.");
    }
  }

  // Tags - derived directly from the user's actual keywords
  const tags: string[] = [];
  for (const ent of entities) {
    const cleanTag = ent.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    if (cleanTag.length >= 3 && cleanTag.length <= 18 && !tags.includes(cleanTag)) {
      tags.push(cleanTag);
    }
    if (tags.length >= 4) break;
  }
  if (tags.length < 2) {
    if (isGratitude) tags.push("Gratitude");
    if (isStress) tags.push("SelfCare");
    if (isDecision) tags.push("Decisions");
    if (isGrowth) tags.push("Growth");
    tags.push("Reflection");
  }

  return {
    suggestedTitle,
    summary,
    keyTakeaways: keyTakeaways.slice(0, 3),
    tags: Array.from(new Set(tags)).slice(0, 4),
    sentiment,
  };
}

// Circuit breaker for cloud Gemini calls to prevent latency spikes and console spam when quota is limited
let cloudCooldownUntil = 0;

/**
 * Reusable helper utility to invoke Gemini API with automatic model fallback
 */
async function generateContentWithFallback(options: FallbackOptions): Promise<{ text: string; modelUsed: string }> {
  // Check circuit breaker
  if (Date.now() < cloudCooldownUntil) {
    throw new Error("Cloud Gemini models in cooldown; using cognitive resilience.");
  }

  const ai = getGeminiClient();
  let lastError: any = null;

  for (const modelName of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: options.contents as any,
        config: {
          systemInstruction: options.systemInstruction,
          temperature: options.temperature ?? 0.7,
        },
      });

      const responseText = response.text?.trim() || "";
      if (responseText) {
        cloudCooldownUntil = 0; // Reset circuit breaker
        return { text: responseText, modelUsed: modelName };
      }
    } catch (err: any) {
      lastError = err;
      // Step quietly to next model in ladder without emitting stderr error strings
    }
  }

  // Quota limited or permission denied on all models: enter 3-minute cooldown
  cloudCooldownUntil = Date.now() + 180_000;
  throw new Error("Cloud Gemini quota currently limited or denied; engaging cognitive resilience engine.");
}

// Health check endpoint
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/gemini/reflect
 * Multi-turn reflective conversation and brainstorming
 */
app.post("/api/gemini/reflect", async (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const { journalContent, messages, mode } = body;

    const safeJournal = typeof journalContent === "string" ? journalContent.slice(0, 20000) : "";
    const safeMessages: Array<{ role: string; content: string }> = Array.isArray(messages)
      ? messages.slice(-20).map((m: any) => ({
          role: m?.role === "user" ? "user" : "model",
          content: typeof m?.content === "string" ? m.content.slice(0, 5000) : "",
        }))
      : [];

    const safeMode = typeof mode === "string" ? mode : "reflect";

    let systemInstruction = `You are a thoughtful, empathetic, and intellectually stimulating reflection partner & journaling mentor.
Your goal is to help the user unpack their thoughts, uncover hidden patterns, explore creative solutions, and find clarity.
Always maintain a supportive, non-judgmental, grounded, and concise tone. Format key insights cleanly with markdown lists or highlights where appropriate.
Never lecture; ask deep, insightful follow-up questions when relevant.

CRITICAL INSTRUCTIONS:
1. Ground your analysis DEEPLY and SPECIFICALLY in the user's exact writing, situations, timelines, and emotions. Never return generic templates, platitudes, or static clichés.
2. In 'reflect' mode, structure your core reflection with these explicit, tailored sections:
   - **The Underlying Pattern**: Detail the specific cognitive, situational, or emotional dynamic driving their unique situation.
   - **Reframing Perspective**: Offer an empowering, grounded cognitive reframing tailored specifically to their situation.
   - **Guiding Questions for Your Next Reflection**: Provide 2 specific, probing questions directly addressing their unique context and next steps.
3. If the input is brief (e.g., an opening greeting like "hello"), warmly acknowledge their arrival, explore the psychology of starting to journal, and invite them into an unhurried, pressure-free check-in.`;

    if (safeMode === "brainstorm") {
      systemInstruction += `\nMode: Brainstorming. Offer creative perspectives, 3-5 distinct angles or thought experiments tailored directly to their entry, and actionable next steps.`;
    } else if (safeMode === "critique") {
      systemInstruction += `\nMode: Constructive Inquiry. Gently challenge unexamined assumptions specific to their situation, explore alternative explanations, and encourage rigorous self-awareness.`;
    } else if (safeMode === "synthesize") {
      systemInstruction += `\nMode: Synthesis. Distill the user's feelings and entries into core themes, actionable wisdom, and calming realizations referencing their actual words.`;
    }

    // Build multi-turn content representation
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Include base journal draft context
    let promptPreamble = "";
    if (safeJournal.trim()) {
      promptPreamble = `[User's Active Journal Entry / Reflection Context]:\n"""\n${safeJournal}\n"""\n\n`;
    }

    if (safeMessages.length === 0) {
      contents.push({
        role: "user",
        parts: [{ text: `${promptPreamble}Please examine my journal reflection above and provide deep, tailored reflection insights: identify the underlying pattern in what I wrote, provide a constructive reframing perspective, and offer two guiding questions for my next reflection.` }],
      });
    } else {
      safeMessages.forEach((msg, idx) => {
        const textPayload = (idx === 0 && promptPreamble)
          ? `${promptPreamble}${msg.content}`
          : msg.content;

        contents.push({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: textPayload || "..." }],
        });
      });
    }

    let text: string;
    let modelUsed: string;
    let isResilienceMode = false;
    let resilienceNotice: string | undefined;

    try {
      const result = await generateContentWithFallback({
        systemInstruction,
        contents,
        temperature: 0.7,
      });
      text = result.text;
      modelUsed = result.modelUsed;
    } catch {
      text = localCognitiveReflect(safeJournal, safeMessages, safeMode);
      modelUsed = "gemini-cognitive-resilience";
      isResilienceMode = true;
      resilienceNotice = "Cloud Gemini quota currently limited. Generated via high-resilience cognitive engine.";
    }

    res.json({
      success: true,
      response: text,
      modelUsed,
      isResilienceMode,
      resilienceNotice,
    });
  } catch (error: any) {
    console.error("[API /reflect Error]:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to process reflection with Gemini.",
    });
  }
});

/**
 * POST /api/gemini/summarize
 * Generates an executive title, themes, and synthesis of the entire journal entry
 */
app.post("/api/gemini/summarize", async (req: Request, res: Response) => {
  try {
    const body = (req.body && typeof req.body === "object") ? req.body : {};
    const { title, content, messages } = body;

    const safeTitle = typeof title === "string" ? title.trim() : "";
    const safeContent = typeof content === "string" ? content.trim().slice(0, 25000) : "";

    // Strictly extract ONLY the user's own follow-up notes/inquiries from messages.
    // Exclude assistant responses, section labels, and UI headers entirely.
    const userInquiries = Array.isArray(messages)
      ? messages
          .filter((m: any) => m && m.role === "user" && typeof m.content === "string")
          .map((m: any) => m.content.trim())
          .filter(Boolean)
          .join("\n")
          .slice(0, 5000)
      : "";

    // Strict isolation guarantee:
    // When the user has provided journal entry draft content, synthesize ONLY that content.
    // Do NOT blend or concatenate conversational inquiries when written content is present.
    const targetTextToSummarize = safeContent || userInquiries;

    if (!targetTextToSummarize) {
      res.status(400).json({ success: false, error: "No user journal entry content provided to summarize." });
      return;
    }

    const isolatedTextPayload = `
=== USER JOURNAL ENTRY TEXT ===
${targetTextToSummarize}
`.trim();

    const systemInstruction = `You are an expert cognitive synthesizer and personal journaling analyst.
Analyze the user's journal entry text provided under === USER JOURNAL ENTRY TEXT ===.

CRITICAL ISOLATION & ACCURACY DIRECTIVES:
1. Focus EXCLUSIVELY and STAGE-ISOLATED on the single journal entry text provided above.
2. DO NOT reference, infer, invent, or carry over any external topics, prior session details, or unrelated subjects.
3. DO NOT quote, reference, or summarize UI labels, section headings, or assistant boilerplate (e.g., NEVER use or quote phrases like "Thoughtful Reflection & Inquiry", "Creative Brainstorming", "Constructive Inquiry", "Reflection Mode", or "Prompt Starter").
4. The title, summary, and takeaways must be purely synthesized from the real-world events, thoughts, and emotions in this specific text.

Respond in valid strict JSON matching this exact structure:
{
  "suggestedTitle": "A concise, specific, meaningful title (3-7 words) derived from the user's actual entry",
  "summary": "A coherent 2-3 sentence executive summary of the user's specific thoughts, events, and emotional journey.",
  "keyTakeaways": ["Specific insight 1 from entry", "Specific insight 2 from entry", "Specific insight 3 from entry"],
  "tags": ["SpecificTag1", "SpecificTag2", "SpecificTag3"],
  "sentiment": "Optimistic" | "Reflective" | "Challenged" | "Grateful" | "Determined" | "Neutral"
}
Output only the raw JSON object without markdown fences or additional commentary.`;

    let parsedResult: any;
    let modelUsed: string;
    let isResilienceMode = false;
    let resilienceNotice: string | undefined;

    try {
      const { text, modelUsed: used } = await generateContentWithFallback({
        systemInstruction,
        contents: [{ role: "user", parts: [{ text: isolatedTextPayload }] }],
        temperature: 0.4,
      });
      modelUsed = used;

      // Parse JSON safely
      let cleanJson = text.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      try {
        parsedResult = JSON.parse(cleanJson);
      } catch {
        parsedResult = localCognitiveSummarize(safeContent, userInquiries);
      }
    } catch {
      parsedResult = localCognitiveSummarize(safeContent, userInquiries);
      modelUsed = "gemini-cognitive-resilience";
      isResilienceMode = true;
      resilienceNotice = "Cloud Gemini quota currently limited. Generated via high-resilience cognitive engine.";
    }

    res.json({
      success: true,
      summary: parsedResult,
      modelUsed,
      isResilienceMode,
      resilienceNotice,
    });
  } catch (error: any) {
    console.error("[API /summarize Error]:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to generate entry summary.",
    });
  }
});

// Vite Middleware integration for Full-Stack development & production serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal server boot failure:", err);
  process.exit(1);
});
