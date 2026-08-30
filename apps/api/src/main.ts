import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { parseEnv } from './config/env';

async function bootstrap(): Promise<void> {
  // Before anything else: a misconfigured environment should stop the process
  // here, not surface as an undefined value inside a request later.
  const env = parseEnv(process.env);

  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT);
}

void bootstrap();
