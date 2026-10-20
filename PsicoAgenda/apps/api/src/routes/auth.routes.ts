import { Router } from "express";
import { registroPacienteSchema, verificarCodigoRegistroSchema } from "@psicoagenda/shared";
import { meController } from "@/controllers/auth.controller";
import {
  preRegistroController,
  verificarCodigoController,
} from "@/controllers/registro.controller";
import { requireAuth } from "@/middleware/auth.middleware";
import { validate } from "@/middleware/validate.middleware";

const router = Router();

// El inicio de sesión y el MFA los resuelve el proveedor de identidad: la API
// no emite tokens ni almacena credenciales. El ALTA sí pasa por aquí, en dos
// pasos: primero un código de 6 dígitos al correo (validado por la API) y solo
// entonces se crea la cuenta, para que ningún correo sin confirmar toque
// Supabase Auth ni la base de datos.
router.post("/pre-registro", validate({ body: registroPacienteSchema }), preRegistroController);
router.post(
  "/verificar-codigo",
  validate({ body: verificarCodigoRegistroSchema }),
  verificarCodigoController,
);
router.get("/me", requireAuth, meController);

export default router;
