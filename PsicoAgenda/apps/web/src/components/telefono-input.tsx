"use client";

import { Input } from "@/components/ui/input";
import {
  DIGITOS_TELEFONO,
  formatearTelefono,
  formatearTelefonoPegado,
} from "@/lib/telefono";

/**
 * Campo de teléfono con máscara `555-123-4567`: solo dígitos, máximo 10 y
 * agrupados mientras se escribe. Al pegar un número con lada se queda con los
 * últimos 10 (`+52 55 1234 5678` → `551-234-5678`).
 *
 * Se usa en el registro y en el perfil para que ambos validen igual.
 */
export function TelefonoInput({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value?: string;
  onChange: (valor: string) => void;
}) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      maxLength={12}
      value={value ?? ""}
      onChange={(evento) => onChange(formatearTelefono(evento.target.value))}
      onPaste={(evento) => {
        const texto = evento.clipboardData.getData("text");
        if (texto.replace(/\D/g, "").length > DIGITOS_TELEFONO) {
          evento.preventDefault();
          onChange(formatearTelefonoPegado(texto));
        }
      }}
    />
  );
}
