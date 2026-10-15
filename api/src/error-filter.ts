// Необработанная ошибка запроса (ответ 500) уходит в GlitchTip; ответ клиенту не меняется.
// Без SENTRY_DSN - только журнал NestJS.
import { type ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { errorEvent, parseDsn } from './error-report';

const dsn = parseDsn(process.env.SENTRY_DSN);

@Catch()
export class ErrorReporter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    if (dsn && !(exception instanceof HttpException)) {
      const req = host.switchToHttp().getRequest<{ method?: string; url?: string }>();
      void fetch(dsn.storeUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-sentry-auth': `Sentry sentry_version=7, sentry_client=prize-draw/1.0, sentry_key=${dsn.publicKey}`,
        },
        body: JSON.stringify(errorEvent(exception, req, process.env.SENTRY_RELEASE)),
        signal: AbortSignal.timeout(3000),
      }).catch(() => undefined);
    }
    super.catch(exception, host);
  }
}
