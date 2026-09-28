import { Router } from "express";
import { demoLoginSchema } from "@psicoagenda/shared";
import { validate } from "@/middleware/validate.middleware";
import { demoLoginController } from "@/controllers/auth.controller";

const router = Router();

router.post("/demo-login", validate({ body: demoLoginSchema }), demoLoginController);

export default router;
