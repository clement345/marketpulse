import { z } from "zod";
import { RULE_TYPES } from "./engine";

export const RuleInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.string().refine((t) => t in RULE_TYPES, "type inconnu"),
  symbol: z.string().trim().max(30).nullable().optional(),
  threshold: z.number().finite().nullable().optional(),
  priority: z.number().int().min(1).max(3).default(2),
  cooldownMin: z.number().int().min(0).max(10080).default(60),
  channels: z.array(z.enum(["inapp", "browser", "telegram", "email"])).default(["inapp"]),
  enabled: z.boolean().default(true),
});
