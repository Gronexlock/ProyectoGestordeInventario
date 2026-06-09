import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_TIMEZONE: z.string().default("America/Santiago"),
});

/**
 * Valida las variables de entorno al arranque del servidor.
 * Lanza un error descriptivo si falta alguna variable crítica.
 * Solo debe llamarse desde server.ts — no en tiempo de importación.
 */
export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.errors
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");

    throw new Error(
      `\n❌ Variables de entorno inválidas:\n${missing}\n\nRevisa tu archivo .env`
    );
  }
}
