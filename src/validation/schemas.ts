import { z } from "zod";

export const PhaseSchema = z.enum(["setup", "day", "night"]);
export const DeathReasonSchema = z.enum(["eliminado", "expulso"]).nullable();

export const PlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  roleId: z.string().nullable(),
  isAlive: z.boolean(),
  isRevealed: z.boolean(),
  deathReason: DeathReasonSchema.optional(),
});

export const NightActionSchema = z.object({
  sourceRoleId: z.string().min(1),
  targetId: z.string().min(1),
  actionType: z.string().min(1),
});

export const UpdatePlayersSchema = z.array(PlayerSchema);
export const ExecuteActionSchema = z.object({
  type: z.string().min(1),
  targetId: z.string().min(1),
});

export const UseOneTimeSchema = z.string().min(1);
export const SetMatiasTargetSchema = z.string().min(1);
export const ToggleRevealSchema = z.string().min(1);
