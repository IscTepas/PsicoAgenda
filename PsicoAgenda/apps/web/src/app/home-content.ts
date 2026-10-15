// Contenido de la página de inicio. Todo lo marcado con EJEMPLO es un dato de
// prueba que debe reemplazarse por la información real del consultorio; lo
// demás describe cómo funciona PsicoAgenda y puede quedarse tal cual.

export type WeeklyHours = {
  /** 0 = domingo … 6 = sábado */
  day: number
  /** Horas en formato 24 h, hora local del consultorio */
  opens: string
  closes: string
}

export const PRACTICE = {
  // EJEMPLO
  psychologist: "Dra. Ana García",
  // EJEMPLO
  specialty: "Psicología clínica",
  // EJEMPLO
  approach: "Terapia cognitivo-conductual",
  // EJEMPLO
  address: "Paseo de la Reforma #450, Piso 3, Consultorio 3B, CDMX",
  // EJEMPLO
  phoneDisplay: "55 0000 0000",
  // EJEMPLO: número con lada internacional, solo dígitos
  phoneE164: "525500000000",
  // EJEMPLO
  email: "consultorio@example.com",
  timeZone: "America/Mexico_City",
  // EJEMPLO
  hours: [
    { day: 1, opens: "09:00", closes: "20:00" },
    { day: 2, opens: "09:00", closes: "20:00" },
    { day: 3, opens: "09:00", closes: "20:00" },
    { day: 4, opens: "09:00", closes: "20:00" },
    { day: 5, opens: "09:00", closes: "20:00" },
    { day: 6, opens: "09:00", closes: "14:00" },
  ] satisfies WeeklyHours[],
  // EJEMPLO: versión corta del horario para la ficha
  hoursSummary: ["Lunes a viernes, 9:00 a 20:00", "Sábados, 9:00 a 14:00"],
}

// Filas de la ficha del consultorio.
export const FACTS: { label: string; value: string | string[] }[] = [
  { label: "Enfoque", value: PRACTICE.approach },
  { label: "Modalidad", value: "En consultorio o en línea por videollamada" },
  { label: "Duración", value: "Sesiones de 45 a 60 minutos" },
  { label: "Horario", value: PRACTICE.hoursSummary },
  { label: "Cómo agendas", value: "Desde tu cuenta, con recordatorio por WhatsApp y correo" },
]

// EJEMPLO: servicios del consultorio
export const SERVICES = [
  {
    name: "Terapia individual",
    description: "Para adultos que atraviesan ansiedad, estrés, duelo o cambios importantes.",
    modalities: "Presencial y en línea",
  },
  {
    name: "Terapia infantil y adolescente",
    description: "Acompañamiento a niñas, niños y adolescentes, con participación de su familia.",
    modalities: "Presencial",
  },
  {
    name: "Terapia de pareja",
    description: "Un espacio para mejorar la comunicación y resolver conflictos en pareja.",
    modalities: "Presencial y en línea",
  },
  {
    name: "Evaluación inicial",
    description: "Una primera sesión para conocerte, entender lo que te trae y definir un plan.",
    modalities: "Presencial y en línea",
  },
]

// Respuestas basadas en cómo funciona PsicoAgenda hoy. La duración y los
// recordatorios ya están en la ficha, así que no se repiten aquí.
export const FAQ = [
  {
    question: "¿Cómo agendo, cambio o cancelo una cita?",
    answer:
      "Desde tu cuenta: eliges un horario disponible y, si algo cambia, puedes reagendar o cancelar desde el mismo lugar.",
  },
  {
    // EJEMPLO: confirmar que el consultorio atiende a menores (el sistema sí lo permite)
    question: "¿Atienden a menores de edad?",
    answer:
      "Sí. La cuenta de la persona menor de edad se registra junto con su madre, padre o tutor legal, quien da el consentimiento informado.",
  },
  {
    question: "¿Lo que hablo en terapia es confidencial?",
    answer:
      "Sí. Tu información clínica es confidencial y solo la consulta el personal autorizado de tu tratamiento, conforme a la ley de protección de datos personales.",
  },
  {
    question: "¿Puedo pedir una copia de mi historial?",
    answer: "Sí. Puedes solicitar la exportación de tu historial de citas y notas cuando lo necesites.",
  },
]
