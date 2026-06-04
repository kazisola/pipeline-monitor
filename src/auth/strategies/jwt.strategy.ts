import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { ExtractJwt, Strategy } from 'passport-jwt';

import { passportJwtSecret } from 'jwks-rsa';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      //  Where to find the token
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Tells Passport: look for the token in the Authorization header
      // Format: Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
      // fromAuthHeaderAsBearerToken() extracts everything after "Bearer "

      // How to get the public key
      secretOrKeyProvider: passportJwtSecret({
        cache: true,

        rateLimit: true,
        // Prevent abuse — if Keycloak is unreachable, don't hammer it

        jwksRequestsPerMinute: 10,
        // Max 10 key-fetch requests per minute to Keycloak
        // More than enough for normal operation

        jwksUri: `${configService.get('KEYCLOAK_URL')}/realms/${configService.get('KEYCLOAK_REALM')}/protocol/openid-connect/certs`,
      }),

      // Token validation options
      ignoreExpiration: false,

      audience: configService.get('KEYCLOAK_CLIENT_ID'),

      issuer: `${configService.get('KEYCLOAK_URL')}/realms/${configService.get('KEYCLOAK_REALM')}`,
    });
  }

  //
  // validate()
  //
  async validate(payload: any) {
    this.logger.debug(`Token validated for user: ${payload.sub}`);

    // payload = the decoded JWT body
    // Keycloak tokens contain these standard fields:
    // sub           → subject — the user's unique ID (UUID)
    // email         → user's email address
    // given_name    → first name
    // family_name   → last name
    // realm_access  → the user's realm-level roles
    // preferred_username → the username they logged in with

    return {
      sub: payload.sub,
      // sub = unique user ID — we use this as operatorId in sensor readings

      email: payload.email,
      username: payload.preferred_username,

      roles: payload.realm_access?.roles ?? [],
    };
  }
}
