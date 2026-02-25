import type { auth } from "./auth.js";

type Session = typeof auth.$Infer.Session;

export type AppBindings = {
  Variables: {
    userId: string;
    session: Session;
  };
};
