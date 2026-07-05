import type { AgeBand } from "./parents";

/**
 * Curated, evidence-informed static content for Parents Mode (W2–W8). Kept as
 * data (not AI) where the guidance is well-established — more reliable, no
 * latency, no cost. AI is reserved for the generative flows (plans, reframes,
 * homework, CPS phrasings, school drafts).
 */

/* ---- W2: situation-first flashpoints -------------------------------- */
export type FlashpointAction =
  "plan" | "meltdown" | "reframe" | "parent" | "school";

export interface Flashpoint {
  id: string;
  label: string;
  emoji: string;
  bands: AgeBand[];
  action: FlashpointAction;
}

export const FLASHPOINTS: Flashpoint[] = [
  {
    id: "morning",
    label: "Morning",
    emoji: "🌅",
    bands: ["4-7", "8-12", "13-17"],
    action: "plan",
  },
  {
    id: "homework",
    label: "Homework",
    emoji: "📚",
    bands: ["4-7", "8-12", "13-17"],
    action: "plan",
  },
  {
    id: "meltdown",
    label: "Meltdown",
    emoji: "🌊",
    bands: ["4-7", "8-12", "13-17"],
    action: "meltdown",
  },
  {
    id: "bedtime",
    label: "Bedtime",
    emoji: "🌙",
    bands: ["4-7", "8-12", "13-17"],
    action: "plan",
  },
  {
    id: "screens",
    label: "Screens off",
    emoji: "📵",
    bands: ["4-7", "8-12", "13-17"],
    action: "plan",
  },
  {
    id: "leaving",
    label: "Leaving the house",
    emoji: "🚪",
    bands: ["4-7", "8-12", "13-17"],
    action: "plan",
  },
  {
    id: "behaviour",
    label: "A specific behaviour",
    emoji: "🧩",
    bands: ["4-7", "8-12", "13-17"],
    action: "reframe",
  },
  {
    id: "school",
    label: "School",
    emoji: "🏫",
    bands: ["4-7", "8-12", "13-17"],
    action: "school",
  },
  {
    id: "parent",
    label: "Just me (parent)",
    emoji: "🫖",
    bands: ["4-7", "8-12", "13-17"],
    action: "parent",
  },
];

/* ---- W3: bite-size Behavioral Parent Training micro-lessons ---------- */
export interface MicroLesson {
  id: string;
  title: string;
  bands: AgeBand[];
  body: string;
  tryIt: string;
}

export const MICRO_LESSONS: MicroLesson[] = [
  {
    id: "labeled-praise",
    title: "Labeled praise",
    bands: ["4-7", "8-12", "13-17"],
    body: "Praise that names the exact thing lands far harder than “good job”. It tells the brain precisely what to do again — and it's a direct counter to all the corrections ADHD kids absorb.",
    tryIt:
      "Catch one specific thing today: “You put your shoes on the first time I asked — that helped so much.”",
  },
  {
    id: "special-time",
    title: "Special time",
    bands: ["4-7", "8-12"],
    body: "Ten minutes a day of child-led play, no correcting, no teaching — just following their lead. It refills the relationship so everything else gets easier.",
    tryIt:
      "Today: 10 minutes where they choose the activity and you narrate, not direct.",
  },
  {
    id: "effective-instructions",
    title: "Effective instructions",
    bands: ["4-7", "8-12"],
    body: "One instruction, close up, calm, specific — then wait. Not “tidy up” across the room, but “please put the blocks in the box” with eye contact.",
    tryIt:
      "Give one instruction, get to their level, and count to five silently before repeating.",
  },
  {
    id: "when-then",
    title: "When–then",
    bands: ["4-7", "8-12", "13-17"],
    body: "“When X is done, then Y” beats “if you don't, no Y”. Same boundary, but it points at the reward, not the threat — less power struggle.",
    tryIt:
      "Swap one “if you don't…” for “when your teeth are brushed, then we read”.",
  },
  {
    id: "transitions",
    title: "Transition warnings",
    bands: ["4-7", "8-12"],
    body: "ADHD brains hyperfocus and get yanked out painfully. A warning (“2 minutes, then we switch”) plus a visible timer turns a battle into a heads-up.",
    tryIt: "Before the next switch, give a 2-minute warning and show a timer.",
  },
  {
    id: "active-ignoring",
    title: "Planned ignoring",
    bands: ["4-7", "8-12"],
    body: "For attention-seeking (not unsafe) behaviour, calmly withdrawing attention and then praising the moment it stops teaches faster than reacting to every bid.",
    tryIt:
      "Pick one minor behaviour to stay neutral on — then warmly notice the second it stops.",
  },
  {
    id: "token-economy",
    title: "Token economies",
    bands: ["8-12"],
    body: "Points earned toward a menu the child helped design. The magic is immediacy and earning-only — never take points away as punishment.",
    tryIt: "Agree 2–3 behaviours and a small rewards menu together this week.",
  },
  {
    id: "teen-autonomy",
    title: "For teens: autonomy over charts",
    bands: ["13-17"],
    body: "Reward charts backfire with teens. They need ownership and a real “why”. Offer choices, ask what would help, and let them track themselves.",
    tryIt:
      "Ask: “What would actually make mornings less stressful for you?” — then build it together.",
  },
  {
    id: "home-school",
    title: "Home–school communication",
    bands: ["4-7", "8-12", "13-17"],
    body: "A short, warm, specific note to the teacher builds a team around your child. Observations and asks, not labels.",
    tryIt: "See the School tools to draft a message in your own words.",
  },
];

/* ---- W4: feelings thermometer (Zones-style, age-adaptive) ----------- */
export interface EmotionLevel {
  id: string;
  color: string; // token-independent, kid-facing
  emoji: string;
  wordYoung: string;
  wordOlder: string;
  coreg: string;
}

export const EMOTION_LEVELS: EmotionLevel[] = [
  {
    id: "blue",
    color: "#5b8def",
    emoji: "😔",
    wordYoung: "Slow / sad",
    wordOlder: "Low or flat",
    coreg:
      "Gentle and slow. A snack, a cuddle, a quiet win, or the Boost menu for a lift.",
  },
  {
    id: "green",
    color: "#3fbf7f",
    emoji: "🙂",
    wordYoung: "Just right",
    wordOlder: "Okay / focused",
    coreg: "You're good to go. Great moment for something that needs focus.",
  },
  {
    id: "yellow",
    color: "#f2c14e",
    emoji: "😣",
    wordYoung: "Wobbly",
    wordOlder: "Frustrated / worried",
    coreg:
      "Catch it early. Try 5 breaths, a movement break, or name the feeling out loud.",
  },
  {
    id: "red",
    color: "#e5654b",
    emoji: "😡",
    wordYoung: "Big feelings",
    wordOlder: "Overwhelmed / angry",
    coreg:
      "Safety and calm first. Fewer words. Head to the Calm Corner together — solve nothing yet.",
  },
];

/* ---- W4: Calm Corner activities ------------------------------------- */
export const CALM_ACTIVITIES = [
  "Take 5 slow balloon breaths",
  "Squeeze and release your fists 5 times",
  "Name 5 things you can see",
  "Push your palms together, hard, and count to 10",
  "Wrap up in something soft",
  "Have a sip of cold water",
];

/* ---- W4: Boost menu (dopamenu for kids) ----------------------------- */
export const BOOST_DEFAULTS = [
  { emoji: "🤸", label: "10 star jumps" },
  { emoji: "🧊", label: "Cold water on your face" },
  { emoji: "🎵", label: "One favourite song, full volume" },
  { emoji: "💃", label: "Dance for one song" },
  { emoji: "🏃", label: "Run to the end of the garden and back" },
  { emoji: "🐶", label: "Say hello to the pet" },
];

/* ---- W5: Meltdown Mode — one instruction at a time ------------------ */
export const MELTDOWN_STEPS = [
  "Lower your voice. Slow everything down. Your calm is the tool — they borrow it from you.",
  "Get to their level. Soften your face and shoulders.",
  "Fewer words. Now is not the time to teach or reason.",
  "Keep everyone safe. Move anything that could get broken or hurt.",
  "Be a steady presence. Stay near, breathe slowly, let the wave pass.",
  "Offer, don't demand: “I'm here.” A hand, a hug, or quiet space — their choice.",
];

export const MELTDOWN_REPAIR =
  "Once they're calm, repair — don't lecture. “That was a big one. I'm glad we got through it together.” The lesson can wait for a calm moment (try Problem-Solving Together).";

/* ---- W6: labeled-praise phrasings ----------------------------------- */
export const PRAISE_PHRASES = [
  "You started your homework without a reminder — that took real effort.",
  "You used your words when you were frustrated. That's hard to do.",
  "You got your shoes on the first time I asked — thank you.",
  "You waited so patiently. I noticed.",
  "You tried again after it went wrong. That's brave.",
  "You were so gentle with your sister just then.",
];

/* ---- W8: school support explainer (UK; region-aware later) ---------- */
export interface SchoolSection {
  title: string;
  body: string;
}
export const SCHOOL_EXPLAINER_UK: SchoolSection[] = [
  {
    title: "SEN Support",
    body: "The first stage in England. The school puts extra help in place and reviews it with you (“assess–plan–do–review”). You can ask the class teacher or the SENCO (the school's special-needs coordinator) to start this — no diagnosis required.",
  },
  {
    title: "EHCP (Education, Health and Care Plan)",
    body: "A legal document for children who need more than SEN Support. You or the school can request an assessment from the local authority. It sets out needs and the support that must be provided.",
  },
  {
    title: "Asking for a meeting",
    body: "Email the SENCO, say you'd like to talk about how your child is doing and what support might help. Ask what's already in place. You're allowed to bring notes and someone with you.",
  },
  {
    title: "What to bring",
    body: "Specific examples (what happens, when, how often), what helps at home, and the one or two things you most want to change. Observations, not labels.",
  },
];
