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

      // How to get the public key
      secretOrKeyProvider: passportJwtSecret({
        cache: true,

        rateLimit: true,

        jwksRequestsPerMinute: 10,

        jwksUri: `${configService.get('KEYCLOAK_URL')}/realms/${configService.get('KEYCLOAK_REALM')}/protocol/openid-connect/certs`,
      }),

      // Token validation options
      ignoreExpiration: false,

      audience: configService.get('KEYCLOAK_CLIENT_ID'),

      issuer: `${configService.get('KEYCLOAK_URL')}/realms/${configService.get('KEYCLOAK_REALM')}`,
    });
  }

  // validate()
  async validate(payload: any) {
    this.logger.debug(`Token validated for user: ${payload.sub}`);

    return {
      sub: payload.sub,

      email: payload.email,
      username: payload.preferred_username,

      roles: payload.realm_access?.roles ?? [],
    };
  }
}
