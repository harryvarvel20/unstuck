import { z } from "zod";
import { MAX_INPUT_CHARS } from "./constants";

export const breakdownRequestSchema = z.object({
  input: z
    .string()
    .trim()
    .min(1, "Please type the thing you're avoiding.")
    .max(MAX_INPUT_CHARS, `Keep it under ${MAX_INPUT_CHARS} characters.`),
  mode: z.enum(["normal", "smaller", "subtask"]).default("normal"),
});

export type BreakdownRequest = z.infer<typeof breakdownRequestSchema>;
