"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useMemo, useEffect, type ComponentProps } from "react"
import { z } from "zod"
import {
  emailSchema,
  passwordSchema,
  APP_NAME,
  MAX_INTENTOS_CODIGO,
  esMenorDeEdad,
} from "@psicoagenda/shared"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  MailCheck,
  RefreshCw,
  ArrowLeft,
  ClipboardPaste,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react"
import { isSupabaseConfigured } from "@/lib/supabase/client"
import {
  construirPayloadRegistro,
  completarRegistro,
  DIGITOS_TELEFONO,
  formatearTelefono,
  formatearTelefonoPegado,
  leerCodigoDelPortapapeles,
  mensajeDeRegistro,
  normalizarCodigo,
  registroService,
  segundosDeEspera,
  type DatosRegistro,
} from "@/services/registro.service"

/**
 * Esquema de validación para registro integral de Pacientes y Profesionales.
 */
const registerSchema = z
  .object({
    role: z.literal("patient"),
    name: z.string().min(2, "El nombre completo debe tener al menos 2 caracteres"),
    email: emailSchema,
    phone: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirma tu contraseña"),
    termsAccepted: z.literal(true, {
      errorMap: () => ({ message: "Debes aceptar el aviso de privacidad" }),
    }),

    // Campos de Paciente
    birthDate: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    emergencyContactRelationship: z.string().optional(),
    /** Declaración de la persona: "si" registra a un menor, "no" es su cuenta. */
    paraMenor: z.enum(["si", "no"]).optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianRelationship: z.string().optional(),
    guardianConsent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // Coincidencia de contraseña
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Las contraseñas no coinciden",
        path: ["confirmPassword"],
      });
    }

    if (!data.birthDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de nacimiento es obligatoria",
        path: ["birthDate"],
      });
    }

    const tieneDiezDigitos = (telefono: string | undefined): boolean =>
      (telefono ?? "").replace(/\D/g, "").length === 10;

    // La fecha es la fuente de verdad (el servidor también la usa); el selector
    // "¿Para quién es la cuenta?" solo sirve para mostrar el tutor desde el
    // principio. Si se contradicen, se avisa aquí en vez de esperar al alta.
    const fechaEsMenor = data.birthDate ? esMenorDeEdad(data.birthDate) : null;
    const esMenor = fechaEsMenor ?? data.paraMenor === "si";

    // Para menores, el teléfono de contacto es el del tutor: el campo de
    // "Datos de acceso" queda deshabilitado y no se valida aquí.
    if (!esMenor && !tieneDiezDigitos(data.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El teléfono debe tener 10 dígitos",
        path: ["phone"],
      });
    }

    if (!data.emergencyContactName || data.emergencyContactName.trim().length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre del contacto de emergencia es obligatorio",
        path: ["emergencyContactName"],
      });
    }

    if (!tieneDiezDigitos(data.emergencyContactPhone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ingresa un teléfono de emergencia de 10 dígitos",
        path: ["emergencyContactPhone"],
      });
    }

    // Si la elección del selector contradice la fecha, se avisa en la fecha en
    // lugar de dejar que el alta falle al final.
    if (data.paraMenor === "no" && fechaEsMenor === true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha indica que es menor de 18 años. Elige «Para un menor a mi cargo».",
        path: ["birthDate"],
      });
    }
    if (data.paraMenor === "si" && fechaEsMenor === false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha indica que es mayor de 18 años. Corrige la fecha o elige «Para mí».",
        path: ["birthDate"],
      });
    }

    // Requisitos si es menor de edad
    if (esMenor) {
      if (!data.guardianName || data.guardianName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El nombre del tutor/a legal es obligatorio para menores de edad",
          path: ["guardianName"],
        });
      }
      if (!tieneDiezDigitos(data.guardianPhone)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El teléfono del tutor/a legal es obligatorio (10 dígitos)",
          path: ["guardianPhone"],
        });
      }
      if (!data.guardianRelationship || data.guardianRelationship.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Especifica el parentesco del tutor legal",
          path: ["guardianRelationship"],
        });
      }
      if (!data.guardianConsent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Se requiere la autorización expresa del tutor legal",
          path: ["guardianConsent"],
        });
      }
    }
  });

type RegisterValues = z.infer<typeof registerSchema>;

/**
 * Marca de tiempo actual. Vive en el módulo (y no como `Date.now()` suelto en el
 * componente) porque la regla de pureza de React Compiler marca las llamadas a
 * funciones impuras en el camino de render, y `onSubmit` pasa por
 * `form.handleSubmit`.
 */
const ahoraMs = (): number => Date.now();

/** Formatea segundos como `m:ss` para las cuentas regresivas del paso 2. */
const minutosYSegundos = (segundos: number): string => {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, "0")}`;
};

/**
 * Campo de teléfono con máscara `555-123-4567`: solo dígitos, máximo 10 y
 * agrupados mientras se escribe. Al pegar un número con lada se queda con los
 * últimos 10 (`+52 55 1234 5678` → `551-234-5678`).
 */
function TelefonoInput({
  value,
  onChange,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange"> & {
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

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const configured = isSupabaseConfigured();

  // Paso 2: el formulario ya se envió y esperamos el código de 6 dígitos. Los
  // datos quedan guardados (y en el store de react-hook-form, que sigue
  // montado) para que un código mal escrito no obligue a repetirlos.
  const [paso, setPaso] = useState<"formulario" | "codigo">("formulario");
  const [datos, setDatos] = useState<DatosRegistro | null>(null);
  const [codigo, setCodigo] = useState("");
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [pegando, setPegando] = useState(false);
  const [ahora, setAhora] = useState(ahoraMs);
  const [expiraEn, setExpiraEn] = useState<number | null>(null);
  const [puedeReenviarEn, setPuedeReenviarEn] = useState(0);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "patient",
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      birthDate: "",
      gender: "",
      address: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelationship: "",
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "",
      guardianConsent: false,
      termsAccepted: true,
    },
  });

  const watchBirthDate = useWatch({ control: form.control, name: "birthDate" });
  const watchParaMenor = useWatch({ control: form.control, name: "paraMenor" });
  const watchGuardianPhone = useWatch({ control: form.control, name: "guardianPhone" });

  // La fecha es la fuente de verdad (el servidor también la usa). Mientras no
  // haya fecha manda el selector "¿Para quién es la cuenta?", de modo que el
  // bloque del tutor aparezca desde el principio si se registra a un menor.
  const esMenor = useMemo(() => {
    if (watchBirthDate) return esMenorDeEdad(watchBirthDate);
    return watchParaMenor === "si";
  }, [watchBirthDate, watchParaMenor]);

  // Un tick por segundo mientras se espera el código: alimenta la cuenta
  // regresiva del vencimiento y la del reenvío.
  useEffect(() => {
    if (paso !== "codigo") return;
    const id = setInterval(() => setAhora(ahoraMs()), 1000);
    return () => clearInterval(id);
  }, [paso]);

  const segundosParaExpirar =
    expiraEn === null ? 0 : Math.max(0, Math.ceil((expiraEn - ahora) / 1000));
  const segundosParaReenviar = Math.max(0, Math.ceil((puedeReenviarEn - ahora) / 1000));
  const codigoVencido = paso === "codigo" && segundosParaExpirar <= 0;

  // Paso 1: pedir el código. Todavía no existe ninguna cuenta: hasta que la
  // persona no lo escriba, ni Supabase Auth ni la base de datos ven sus datos.
  async function onSubmit(values: RegisterValues) {
    setError(null);
    setIsPending(true);

    try {
      // Para menores, el teléfono de contacto es el del tutor: el campo de
      // "Datos de acceso" está deshabilitado y aquí se sustituye antes de
      // guardar los datos (que también usan el reenvío y la verificación).
      const normalizados = {
        ...values,
        phone: esMenor ? (values.guardianPhone ?? "") : (values.phone ?? ""),
      };
      const respuesta = await registroService.solicitarCodigo(construirPayloadRegistro(normalizados));
      const marcaTiempo = ahoraMs();
      setDatos(normalizados);
      setCodigo("");
      setCodigoError(null);
      setIntentosFallidos(0);
      setAhora(marcaTiempo);
      setExpiraEn(marcaTiempo + respuesta.expiresInSeconds * 1000);
      setPuedeReenviarEn(marcaTiempo + respuesta.resendCooldownSeconds * 1000);
      setPaso("codigo");
    } catch (fallo) {
      setError(mensajeDeRegistro(fallo));
    } finally {
      setIsPending(false);
    }
  }

  // Paso 2: verificar el código. En éxito la API crea la cuenta confirmada,
  // iniciamos sesión y entramos al panel; en fallo no se pierde nada.
  async function onVerificar() {
    if (!datos || isPending) return;
    setCodigoError(null);
    setIsPending(true);

    try {
      await completarRegistro(datos, codigo, (ruta) => {
        router.push(ruta);
        router.refresh();
      });
    } catch (fallo) {
      setCodigoError(mensajeDeRegistro(fallo));
      setIntentosFallidos((intentos) => intentos + 1);
    } finally {
      setIsPending(false);
    }
  }

  async function onReenviar() {
    if (!datos || isPending) return;
    setCodigoError(null);
    setIsPending(true);

    try {
      const respuesta = await registroService.solicitarCodigo(construirPayloadRegistro(datos));
      const marcaTiempo = ahoraMs();
      setAhora(marcaTiempo);
      setExpiraEn(marcaTiempo + respuesta.expiresInSeconds * 1000);
      setPuedeReenviarEn(marcaTiempo + respuesta.resendCooldownSeconds * 1000);
      setCodigo("");
      setIntentosFallidos(0);
    } catch (fallo) {
      // Si la API responde que todavía hay que esperar, el botón se apaga por
      // los segundos que ella misma indicó.
      setCodigoError(mensajeDeRegistro(fallo));
      setPuedeReenviarEn(ahoraMs() + (segundosDeEspera(fallo) ?? 60) * 1000);
      setAhora(ahoraMs());
    } finally {
      setIsPending(false);
    }
  }

  function volverAlFormulario() {
    setPaso("formulario");
    setCodigoError(null);
    setCodigo("");
  }

  // Pegar el código copiado del correo. El correo no puede leer el portapapeles
  // (los clientes eliminan el JavaScript), así que la copia la hace la persona
  // — con el botón nativo de "Copiar código" de Gmail — y aquí se pega.
  async function onPegarCodigo() {
    if (pegando) return;
    setPegando(true);
    setCodigoError(null);

    try {
      setCodigo(await leerCodigoDelPortapapeles());
    } catch (fallo) {
      setCodigoError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo leer el portapapeles. Copia el código del correo y pégalo con Ctrl+V.",
      );
    } finally {
      setPegando(false);
    }
  }

  // Paso 2 (código de verificación)
  if (paso === "codigo" && datos) {
    return (
      <div className="w-full max-w-md rounded-4xl bg-card p-7 sm:p-8 border border-border shadow-sm flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-2">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-1">
            <MailCheck className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Confirma tu correo
          </h1>
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 font-normal text-xs bg-muted text-foreground"
          >
            Cuenta de Paciente
          </Badge>
          <p className="text-sm text-muted-foreground">Escribimos un código de 6 dígitos a:</p>
          <p className="max-w-full truncate font-semibold text-foreground text-sm bg-muted/60 px-4 py-2 rounded-xl">
            {datos.email}
          </p>
        </div>

        {codigoError ? (
          <Alert
            variant="destructive"
            className="rounded-xl animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <AlertDescription>{codigoError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2.5">
          <label htmlFor="codigo-verificacion" className="text-sm font-medium text-foreground">
            Código de verificación
          </label>
          <div className="flex gap-2">
            <Input
              id="codigo-verificacion"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              autoFocus
              value={codigo}
              onChange={(evento) => setCodigo(normalizarCodigo(evento.target.value))}
              onKeyDown={(evento) => {
                if (evento.key === "Enter") {
                  evento.preventDefault();
                  void onVerificar();
                }
              }}
              className="h-14 min-w-0 flex-1 text-center text-2xl tracking-[0.4em] tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void onPegarCodigo()}
              disabled={pegando}
              title="Pegar el código copiado del correo"
              className="h-14 shrink-0 px-4"
            >
              {pegando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ClipboardPaste className="size-4" />
              )}
              Pegar
              <span className="sr-only"> el código del portapapeles</span>
            </Button>
          </div>
          <p
            aria-live="polite"
            className="text-center text-xs leading-relaxed text-muted-foreground"
          >
            {codigoVencido ? (
              <span className="font-medium text-destructive">
                El código ya venció. Solicita uno nuevo.
              </span>
            ) : (
              <>
                El código vence en{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {minutosYSegundos(segundosParaExpirar)}
                </span>
                {intentosFallidos > 0 ? (
                  <>
                    {" · "}Intento {Math.min(intentosFallidos + 1, MAX_INTENTOS_CODIGO)} de{" "}
                    {MAX_INTENTOS_CODIGO}
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>

        <Button
          type="button"
          size="lg"
          onClick={() => void onVerificar()}
          disabled={isPending || codigo.length !== 6 || codigoVencido}
          className="w-full h-11 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Verificando...
            </>
          ) : (
            "Verificar y crear mi cuenta"
          )}
        </Button>

        <div className="flex flex-col gap-2 border-t border-border">
          {segundosParaReenviar > 0 ? (
            <p className="pt-4 text-center text-xs tabular-nums text-muted-foreground">
              ¿No te llegó? Podrás pedir otro código en {segundosParaReenviar} s
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => void onReenviar()}
              disabled={isPending}
              className="mt-4 w-full h-11 rounded-xl text-sm font-semibold"
            >
              <RefreshCw className="mr-2 size-4" />
              Enviar un código nuevo
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={volverAlFormulario}
            className="w-full rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 size-4" />
            Volver al formulario
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl rounded-4xl bg-card p-7 sm:p-9 border border-border shadow-sm flex flex-col gap-6">
      {/* Cabecera con el logo de PsicoAgenda */}
      <div className="text-center flex flex-col items-center">
        <Image
          src="/images/psicoagenda-logo.png"
          alt={APP_NAME}
          width={167}
          height={116}
          className="mb-2 h-[116px] w-[167px] object-contain"
          priority
        />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Crear una nueva cuenta
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Completa tus datos para acceder a {APP_NAME}
        </p>
      </div>

      <div className="space-y-6">
        {error ? (
          <Alert
            variant="destructive"
            className="rounded-xl animate-in fade-in slide-in-from-top-1 duration-200"
          >
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!configured ? (
          <Alert variant="destructive" className="rounded-xl">
            <AlertDescription>
              Faltan variables de entorno en el cliente. Revisa tu archivo{" "}
              <code>.env</code>.
            </AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* El alta pública solo crea cuentas de paciente; el rol de
                psicólogo/a se asigna desde el panel administrativo. */}

            {/* Selector de flujo: avisa desde el principio si harán falta los
                datos del tutor. La fecha de nacimiento sigue siendo la que
                decide (el servidor también la deriva de ahí). */}
            <FormField
              control={form.control}
              name="paraMenor"
              render={({ field }) => (
                <FormItem className="rounded-2xl border border-border/70 bg-muted/30 p-3.5">
                  <FormLabel className="text-sm">¿Para quién es la cuenta?</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { valor: "no" as const, etiqueta: "Para mí" },
                      { valor: "si" as const, etiqueta: "Para un menor a mi cargo" },
                    ].map((opcion) => (
                      <Button
                        key={opcion.valor}
                        type="button"
                        variant={field.value === opcion.valor ? "default" : "outline"}
                        aria-pressed={field.value === opcion.valor}
                        onClick={() => field.onChange(opcion.valor)}
                        className="h-10 rounded-xl"
                      >
                        {opcion.etiqueta}
                      </Button>
                    ))}
                  </div>
                  <FormDescription className="text-[11px] leading-snug">
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Datos del tutor: va antes de las credenciales para que quien
                registra a un menor sepa desde el principio qué necesita. Es
                una sección más del formulario, sin caja destacada. */}
            {esMenor ? (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Datos del tutor legal</h2>
                <p className="text-xs text-muted-foreground leading-snug">
                </p>

                <FormField
                  control={form.control}
                  name="guardianName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo del tutor/a</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de madre, padre o tutor" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="guardianRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parentesco / Representación</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Parentesco" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Madre">Madre</SelectItem>
                            <SelectItem value="Padre">Padre</SelectItem>
                            <SelectItem value="Tutor legal">Tutor/a legal</SelectItem>
                            <SelectItem value="Familiar responsable">Familiar responsable</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="guardianPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono del tutor/a</FormLabel>
                        <FormControl>
                          <TelefonoInput placeholder="311-123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ) : null}

              {/* SECCIÓN 1: Credenciales y datos básicos */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Datos de acceso
                </h2>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Carlos Mendoza Ramos"
                          autoComplete="name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="tu@correo.com"
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono móvil</FormLabel>
                        <FormControl>
                          <TelefonoInput
                            placeholder="311-123-4567"
                            {...field}
                            value={esMenor ? (watchGuardianPhone ?? "") : field.value}
                            disabled={esMenor}
                          />
                        </FormControl>
                        <FormDescription className="text-[11px] leading-tight text-muted-foreground">
                          {esMenor
                            ? "Se usará el teléfono del tutor/a legal."
                            : "10 dígitos, con guiones automáticos"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <div className="relative flex items-center">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="pr-10"
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                            aria-pressed={showPassword}
                            className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </div>
                        <FormDescription className="text-[11px] leading-tight text-muted-foreground">
                          Mín. 8 caracteres, mayúscula, minúscula y número
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar contraseña</FormLabel>
                        <div className="relative flex items-center">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className="pr-10"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* SECCIÓN 2: Ficha personal y contacto de emergencia */}
              <div className="space-y-4 pt-2">
                  <h2 className="text-sm font-semibold text-foreground">
                    Información personal
                  </h2>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de nacimiento</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Género</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecciona una opción" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Femenino">Femenino</SelectItem>
                              <SelectItem value="Masculino">Masculino</SelectItem>
                              <SelectItem value="No binario">No binario</SelectItem>
                              <SelectItem value="Prefiero no decir">
                                Prefiero no decir
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Dirección <span className="text-muted-foreground font-normal">(Opcional)</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ciudad, municipio o dirección"
                            autoComplete="street-address"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* BLOQUE: Contacto de emergencia (RD-12) */}
                  <div className="space-y-3 pt-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Contacto de emergencia
                    </h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="emergencyContactName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del contacto</FormLabel>
                            <FormControl>
                              <Input placeholder="Nombre de contacto" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="emergencyContactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono de emergencia</FormLabel>
                            <FormControl>
                              <TelefonoInput placeholder="311-123-4567" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="emergencyContactRelationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Parentesco o relación <span className="text-muted-foreground font-normal">(Opcional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Ej. Pareja, Hermano/a, Amistad" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

              {/* AVISO DE PRIVACIDAD Y TÉRMINOS */}
              <FormField
                control={form.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0 pt-2 border-t border-border">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0.5 leading-none">
                      <FormLabel className="text-xs font-normal text-muted-foreground cursor-pointer">
                        Acepto el{" "}
                        <span className="text-primary font-medium underline-offset-4 hover:underline">
                          Aviso de Privacidad
                        </span>{" "}
                        y autorizo el tratamiento confidencial de mis datos conforme a la
                        LFPDPPP y el secreto profesional.
                      </FormLabel>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {/* Consentimiento del tutor, junto al aviso de privacidad */}
              {esMenor ? (
                <FormField
                  control={form.control}
                  name="guardianConsent"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-2 space-y-0 pt-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-0.5 leading-none">
                        <FormLabel className="text-xs font-normal text-foreground cursor-pointer">
                          Como tutor/a legal, autorizo el registro y la atención psicológica del menor.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              ) : null}

              {/* BOTONES: enviar el código (principal) y Cancelar / Volver al login (secundario) */}
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs active:scale-[0.98] transition-all"
                  disabled={isPending || !configured}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Enviando código...
                    </>
                  ) : (
                    "Enviar código de verificación"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  asChild
                  className="w-full h-11 rounded-xl text-sm font-semibold border-border hover:bg-muted text-foreground"
                >
                  <Link href="/login">Cancelar / Volver al login</Link>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    );
}
