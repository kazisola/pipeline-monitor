import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    this.logger.debug('JwtAuthGuard checking token...');

    // Call the parent canActivate() which triggers our JwtStrategy
    // super = the parent class (AuthGuard)
    return super.canActivate(context);
  }

  // handleRequest() is called after the token is validated
  // err     = any error from Passport
  // user    = the object returned by JwtStrategy.validate() (or null if invalid)
  // info    = additional info about why validation failed (e.g. "TokenExpiredError")
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // Log why the token was rejected
      this.logger.warn(
        `Auth failed: ${info?.message || err?.message || 'No token'}`,
      );

      // Throw 401 Unauthorized
      // UnauthorizedException → NestJS returns HTTP 401 with a standard error body
      throw (
        err ||
        new UnauthorizedException(
          info?.message || 'Invalid or missing authentication token',
        )
      );
    }

    this.logger.debug(`Auth successful for user: ${user.username}`);

    // Return the user object — NestJS attaches this to req.user
    return user;
  }
}
