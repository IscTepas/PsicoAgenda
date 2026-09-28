"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@psicoagenda/shared";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch, ApiError } from "@/lib/api-client";
import { saveSession } from "@/lib/session";

interface DemoLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

export function DemoLoginButtons() {
  const router = useRouter();
  const [loading, setLoading] = React.useState<UserRole | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const login = async (role: UserRole.PSYCHOLOGIST | UserRole.PATIENT) => {
    setLoading(role);
    setError(null);
    try {
      const result = await apiFetch<DemoLoginResponse>("/auth/demo-login", {
        method: "POST",
        body: { role },
      });
      saveSession(result);
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo iniciar sesión. Intenta de nuevo.";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-2">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        onClick={() => login(UserRole.PSYCHOLOGIST)}
        disabled={loading !== null}
      >
        {loading === UserRole.PSYCHOLOGIST
          ? "Entrando..."
          : "Entrar como psicólogo/a"}
      </Button>
      <Button
        variant="outline"
        onClick={() => login(UserRole.PATIENT)}
        disabled={loading !== null}
      >
        {loading === UserRole.PATIENT ? "Entrando..." : "Entrar como paciente"}
      </Button>
      {error ? (
        <p className="text-center text-xs text-muted-foreground">
          Si el error persiste, revisa que la API esté corriendo en el puerto 4000.
        </p>
      ) : null}
    </div>
  );
}
