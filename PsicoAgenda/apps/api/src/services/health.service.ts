export interface HealthStatus {
  status: "ok";
  service: string;
  timestamp: string;
}

export function getHealthStatus(): HealthStatus {
  return {
    status: "ok",
    service: "psicoagenda-api",
    timestamp: new Date().toISOString(),
  };
}
