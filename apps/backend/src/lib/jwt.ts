import { jwt } from "@elysiajs/jwt";
import { env } from "@/config/env";

export const accessJwt = jwt({
  name: "accessJwt",
  secret: env.JWT_ACCESS_SECRET,
  exp: `${env.JWT_ACCESS_TTL_MIN}m`,
});

export const refreshJwt = jwt({
  name: "refreshJwt",
  secret: env.JWT_REFRESH_SECRET,
  exp: `${env.JWT_REFRESH_TTL_DAYS}d`,
});

export interface AccessClaims {
  sub: string; // userId
  email: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export interface RefreshClaims {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}
