import {
  parseStreamingBreakdown,
  parseStreamingMessage,
  parseItemsArray,
  parseStringsArray,
} from "../src/lib/parseBreakdown.ts";
import {
  buildTimeline,
  hhmmToMinutes,
  minutesToHhmm,
  type TimelineItem,
} from "../src/lib/timeline.ts";

const full = `{"crisis": false, "total_minutes": 14, "steps": [{"title": "Put your shoes by the door.", "minutes": 2, "tip": "That's the whole step."}, {"title": "Fill a glass of water.", "minutes": 2}, {"title": "Open the laundry basket.", "minutes": 3, "tip": "Just open it."}]}`;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
}

// 1. Full parse
const done = parseStreamingBreakdown(full);
check("full: 3 steps", done.steps.length === 3);
check("full: total 14", done.totalMinutes === 14);
check(
  "full: first step text",
  done.steps[0]?.title === "Put your shoes by the door.",
);
check("full: tip present", done.steps[0]?.tip === "That's the whole step.");
check("full: step w/o tip", done.steps[1]?.tip === undefined);
check("full: not crisis", done.crisis === false);

// 2. Progressive streaming — feed 1 char at a time, watch steps grow monotonically
let maxSteps = 0;
let sawOne = false;
let sawTwo = false;
for (let i = 1; i <= full.length; i++) {
  const partial = parseStreamingBreakdown(full.slice(0, i));
  if (partial.steps.length >= 1) sawOne = true;
  if (partial.steps.length >= 2) sawTwo = true;
  // steps should never exceed the final count while streaming
  if (partial.steps.length > 3) maxSteps = 99;
  maxSteps = Math.max(maxSteps, partial.steps.length);
}
check("stream: saw 1 step mid-stream", sawOne);
check("stream: saw 2 steps mid-stream", sawTwo);
check("stream: never over-counts", maxSteps === 3);

// 3. Partial trailing object is ignored until complete
const cut = `{"crisis": false, "total_minutes": 14, "steps": [{"title": "One.", "minutes": 2}, {"title": "Two, still typ`;
const partial = parseStreamingBreakdown(cut);
check("partial: only complete steps counted (1)", partial.steps.length === 1);
check("partial: total already known", partial.totalMinutes === 14);

// 4. Crisis path
const crisis = `{"crisis": true, "message": "It sounds really heavy right now. Please reach out — in the UK you can call Samaritans free any time on 116 123."}`;
const c = parseStreamingBreakdown(crisis);
check("crisis: flagged", c.crisis === true);
check("crisis: message parsed", (c.crisisMessage ?? "").includes("116 123"));
check("crisis: no steps", c.steps.length === 0);

// 5. Escaped quotes inside a title don't break the scanner
const escaped = `{"crisis": false, "total_minutes": 4, "steps": [{"title": "Find the \\"good\\" pen.", "minutes": 2}, {"title": "Sit down.", "minutes": 2}]}`;
const e = parseStreamingBreakdown(escaped);
check("escaped: 2 steps", e.steps.length === 2);
check("escaped: quote in title", e.steps[0]?.title === 'Find the "good" pen.');

// 6. Streaming message (focus check-ins / reentry) — types out live
const msgFull = `{"crisis": false, "message": "What's the first move? I'll be right here."}`;
check(
  "message: complete parsed",
  parseStreamingMessage(msgFull).message ===
    "What's the first move? I'll be right here.",
);
check(
  "message: complete flagged",
  parseStreamingMessage(msgFull).complete === true,
);
const msgPartial = `{"crisis": false, "message": "What's the fir`;
check(
  "message: partial mid-string",
  parseStreamingMessage(msgPartial).message === "What's the fir",
);
check(
  "message: partial not complete",
  parseStreamingMessage(msgPartial).complete === false,
);
const msgCrisis = `{"crisis": true, "message": "Please reach out — Samaritans 116 123."}`;
check(
  "message: crisis flagged",
  parseStreamingMessage(msgCrisis).crisis === true,
);

// 7. Items array (triage / plan)
const triage = `{"crisis": false, "message": "ok", "must": [{"id":"a","title":"Call the dentist","minutes":10},{"id":"b","title":"Pay rent","minutes":5}], "later": [{"id":"c","title":"Tidy desk","minutes":15}]}`;
const must = parseItemsArray(triage, "must");
check("items: must has 2", must.length === 2);
check("items: must first title", must[0]?.title === "Call the dentist");
check("items: must keeps id", must[0]?.id === "a");
check("items: later separate", parseItemsArray(triage, "later").length === 1);

// 8. Strings array (captured list)
const dump = `{"crisis": false, "today": [{"title":"X","minutes":5}], "captured": ["worry about email", "buy milk", "that phone call"]}`;
const captured = parseStringsArray(dump, "captured");
check("strings: 3 captured", captured.length === 3);
check("strings: content", captured[1] === "buy milk");
// streaming: incomplete last string is not emitted until closed
const dumpPartial = `{"captured": ["done one", "still typ`;
check(
  "strings: partial excludes open item",
  parseStringsArray(dumpPartial, "captured").length === 1,
);

// 9. Timeline engine
check("time: parse 09:30", hhmmToMinutes("09:30") === 570);
check("time: reject 25:00", hhmmToMinutes("25:00") === null);
check("time: format 570", minutesToHhmm(570) === "09:30");

const tlItems: TimelineItem[] = [
  { id: "a", title: "Email the landlord", minutes: 20 },
  { id: "b", title: "Water the plants", minutes: 5 },
  { id: "c", title: "Leave for the dentist", minutes: 30, deadline: "14:00" },
  { id: "d", title: "Long admin block", minutes: 90 },
];
const built = buildTimeline(tlItems, { startAt: 9 * 60, ratio: 1 });
const taskEntries = built.entries.filter((e) => e.kind === "task");
const dentist = taskEntries.find((e) => e.item?.id === "c");
check(
  "tl: all 4 tasks placed",
  taskEntries.length === 4 && built.overflow.length === 0,
);
check(
  "tl: deadline start-by = 14:00 - 30 - 15 buffer",
  dentist?.startBy === 14 * 60 - 30 - 15,
);
check(
  "tl: buffer inserted before hard time",
  built.entries.some((e) => e.kind === "buffer"),
);
check(
  "tl: a break appears after ~an hour of work",
  built.entries.some((e) => e.kind === "break"),
);
check(
  "tl: smallest flexible first (momentum)",
  taskEntries[0]?.item?.id === "b",
);
// Calibration stretches durations
const cal = buildTimeline([{ id: "x", title: "Quick job", minutes: 10 }], {
  startAt: 9 * 60,
  ratio: 2,
});
check(
  "tl: ratio 2 doubles the block",
  cal.entries.find((e) => e.kind === "task")?.minutes === 20,
);
// Day-end overflow -> amnesty candidates, never silently dropped
const late = buildTimeline(
  [
    { id: "y", title: "Big thing", minutes: 120 },
    { id: "z", title: "Second big thing", minutes: 120 },
  ],
  { startAt: 21 * 60, ratio: 1 },
);
check("tl: overflow captured", late.overflow.length >= 1);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
