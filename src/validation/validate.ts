import { z } from "zod";

export const validatePayload = <T>(
  data: unknown,
  schema: z.ZodSchema<T>,
): T | null => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn(`Validation error: ${error.message}`);
      return null;
    }
    throw error;
  }
};
