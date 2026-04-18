/**
 * Production configuration for deployment
 * Supports: Railway.app, Render.com, Fly.io, etc
 */

export interface AppConfig {
  port: number;
  nodeEnv: "development" | "production";
  allowedOrigins: string[];
  gameTimeoutMinutes: number;
}

export const getConfig = (): AppConfig => {
  const nodeEnv = (process.env.NODE_ENV || "development") as
    | "development"
    | "production";

  const allowedOriginsStr =
    process.env.ALLOWED_ORIGINS ||
    (nodeEnv === "production"
      ? "https://jerusalem-dorme.railway.app"
      : "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:5175");

  const allowedOrigins = allowedOriginsStr
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv,
    allowedOrigins,
    gameTimeoutMinutes: parseInt(process.env.GAME_TIMEOUT_MINUTES || "5", 10),
  };
};

/**
 * Validates configuration on startup
 */
export const validateConfig = (config: AppConfig): void => {
  if (!config.port || config.port < 1 || config.port > 65535) {
    throw new Error(
      `Invalid PORT: ${config.port}. Must be between 1 and 65535`,
    );
  }

  if (config.allowedOrigins.length === 0) {
    throw new Error("ALLOWED_ORIGINS cannot be empty");
  }

  if (config.gameTimeoutMinutes < 1 || config.gameTimeoutMinutes > 60) {
    throw new Error(
      `Invalid GAME_TIMEOUT_MINUTES: ${config.gameTimeoutMinutes}. Must be between 1 and 60`,
    );
  }

  console.log("✅ Configuration validated:", {
    port: config.port,
    nodeEnv: config.nodeEnv,
    allowedOrigins: config.allowedOrigins,
    gameTimeoutMinutes: config.gameTimeoutMinutes,
  });
};
