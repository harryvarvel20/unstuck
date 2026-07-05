// Client-safe constants shared between browser and server code.
// Keep this module free of any Node/server imports so it can be bundled
// into client components without dragging server dependencies along.

/** Hard cap on user input length. */
export const MAX_INPUT_CHARS = 500;

/** Free anonymous breakdowns allowed per IP per day. */
export const ANON_DAILY_LIMIT = 3;
