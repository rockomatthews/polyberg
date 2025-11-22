import { Logtail } from '@logtail/node';

import { env } from '@/lib/env';

type LogLevel = 'info' | 'error' | 'warn';

const logtail = env.logtailToken ? new Logtail(env.logtailToken) : null;

async function ship(level: LogLevel, event: string, metadata?: Record<string, unknown>) {
  if (!logtail) {
    return;
  }
  const payload = metadata ?? {};
  try {
    if (level === 'error') {
      await logtail.error(event, payload);
    } else if (level === 'warn') {
      await logtail.warn(event, payload);
    } else {
      await logtail.info(event, payload);
    }
  } catch (error) {
    console.error('[logger] logtail ship failed', error);
  }
}

function format(event: string, metadata?: Record<string, unknown>) {
  return JSON.stringify({ event, ...(metadata ?? {}) });
}

export const logger = {
  info(event: string, metadata?: Record<string, unknown>) {
    console.log(format(event, metadata));
    void ship('info', event, metadata);
  },
  warn(event: string, metadata?: Record<string, unknown>) {
    console.warn(format(event, metadata));
    void ship('warn', event, metadata);
  },
  error(event: string, metadata?: Record<string, unknown>) {
    console.error(format(event, metadata));
    void ship('error', event, metadata);
  },
};

