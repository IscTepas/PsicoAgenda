import { APP_NAME } from "@psicoagenda/shared";
import { WifiOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Sin conexión",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <WifiOff className="size-12 text-muted-foreground" aria-hidden />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sin conexión</h1>
        <p className="max-w-md text-muted-foreground">
          No hay conexión con el servidor. Los datos clínicos solo están disponibles en línea;
          {APP_NAME} nunca almacena información de pacientes en el dispositivo.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
