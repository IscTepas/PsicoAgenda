import { UserRole, type SessionUser } from "@psicoagenda/shared";
import { signToken } from "@/utils/jwt";
import { config } from "@/config";
import { AppError } from "@/utils/app-error";

type DemoRole = UserRole.PSYCHOLOGIST | UserRole.PATIENT;

const DEMO_USERS: Record<DemoRole, SessionUser> = {
  [UserRole.PSYCHOLOGIST]: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "demo.psicologo@psicoagenda.test",
    name: "Dra. Ana García (demo)",
    role: UserRole.PSYCHOLOGIST,
  },
  [UserRole.PATIENT]: {
    id: "22222222-2222-2222-2222-222222222222",
    email: "demo.paciente@psicoagenda.test",
    name: "María López (demo)",
    role: UserRole.PATIENT,
  },
};

export interface DemoLoginResult {
  token: string;
  user: SessionUser;
}

export const demoLogin = (role: DemoRole): DemoLoginResult => {
  if (!config.allowDemoLogin) {
    throw AppError.notFound("Endpoint no encontrado");
  }

  const user = DEMO_USERS[role];
  const token = signToken({ id: user.id, email: user.email, role: user.role });

  return { token, user };
};
