import { Router } from "express";
import { meController } from "@/controllers/auth.controller";
import { requireAuth } from "@/middleware/auth.middleware";

const router = Router();

// El alta, el inicio de sesión, la verificación de correo y el MFA los resuelve el
// proveedor de identidad: la API no emite tokens ni almacena credenciales.
router.get("/me", requireAuth, meController);

export default router;
