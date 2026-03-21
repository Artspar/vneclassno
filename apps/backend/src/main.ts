import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

function resolveCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return ['http://localhost:3001', 'http://localhost:3002', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002'];
  }

  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter((value) => value.length > 0);
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const strictCors = (process.env.CORS_STRICT ?? 'false') === 'true';
  const allowedOrigins = resolveCorsOrigins();

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (!strictCors) {
        callback(null, true);
        return;
      }

      const normalized = origin.replace(/\/$/, '');
      callback(null, allowedOrigins.includes(normalized));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Nest backend listening on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`Store mode: ${process.env.APP_STORE ?? 'prisma'}`);
  // eslint-disable-next-line no-console
  console.log(`CORS strict mode: ${strictCors ? 'on' : 'off'}`);
}

void (async () => {
  try {
    await bootstrap();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Bootstrap failed:', error);
    process.exit(1);
  }
})();
