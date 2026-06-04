// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';

// async function bootstrap() {
//   const app = await NestFactory.create(AppModule);
//   await app.listen(process.env.PORT ?? 3000);
// }
// bootstrap();

import { NestFactory } from '@nestjs/core';

import { ValidationPipe } from '@nestjs/common';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted: true,

      transform: true,
    }),
  );

  // CORS BEHAVE DUDEEE
  app.enableCors({
    origin: 'http://localhost:5173',

    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],

    credentials: true,
  });

  // Global Route Prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(
    `🚀 Pipeline Monitor API running on http://localhost:${port}/api`,
  );
  console.log(`📊 MongoDB Express UI: http://localhost:8081`);
  console.log(`🔐 Keycloak Admin: http://localhost:8080`);
}

bootstrap();
