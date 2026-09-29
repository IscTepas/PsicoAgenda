import type { Request, Response } from "express";
import { getHealthStatus } from "@/services/health.service";

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const health = await getHealthStatus();
  res.status(health.status === "ok" ? 200 : 503).json(health);
}
