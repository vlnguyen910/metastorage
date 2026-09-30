import type { Database } from "@storex/database";
import type { AuthSession, AuthUser } from "../../modules/auth/auth";
import type { FacilityContext } from "../../modules/facilities/facilities.guard.types";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    session: AuthSession["session"] | null;
    facilityContext: FacilityContext | null;
  }

  interface FastifyInstance {
    db: Database;
  }
}
