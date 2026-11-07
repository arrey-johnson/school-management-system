import { todayIso } from "../utils/dates.js";
import type { AppContext } from "../app-context.js";
import { createBackup } from "../modules/backup/service.js";
import { eq } from "drizzle-orm";
import { settings } from "../db/schema.js";

function setting(ctx: AppContext, key: string, fallback: string): string {
  return ctx.bundle.db.select().from(settings).where(eq(settings.key, key)).get()?.valueJson ?? fallback;
}

function setSetting(ctx: AppContext, key: string, value: string): void {
  const at = new Date().toISOString();
  const existing = ctx.bundle.db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    ctx.bundle.db.update(settings).set({ valueJson: value, updatedAt: at }).where(eq(settings.key, key)).run();
  } else {
    ctx.bundle.db.insert(settings).values({ key, valueJson: value, updatedAt: at }).run();
  }
}

function currentHour(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Douala",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? "0");
}

export function startBackupJobs(ctx: AppContext): () => void {
  if (ctx.env.SMS_TEST === "1") return () => undefined;
  const timer = setInterval(() => {
    try {
      const hour = Number(setting(ctx, "backup.hour", "2"));
      if (currentHour() !== hour) return;
      const today = todayIso();
      if (setting(ctx, "backup.lastScheduledDate", "") === today) return;
      void createBackup(ctx.bundle, null, "scheduled").then(() => {
        setSetting(ctx, "backup.lastScheduledDate", today);
      });
    } catch {
      /* next tick */
    }
  }, 60_000);
  timer.unref?.();
  return () => clearInterval(timer);
}
