import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { RealTimeDataClient, type Message } from '@polymarket/real-time-data-client';

import { authOptions } from '@/lib/auth';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  ensureUserTradingCredentials,
  TradingCredentialsError,
} from '@/lib/services/tradingCredentialsService';

export const runtime = 'nodejs';

type StreamMessage = {
  topic: Message['topic'];
  type: Message['type'];
  payload: Message['payload'];
  receivedAt: number;
};

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userId = session.user.id;

  let creds;
  try {
    creds = await ensureUserTradingCredentials(userId);
  } catch (error) {
    if (error instanceof TradingCredentialsError) {
      return new Response(error.message, { status: 409 });
    }
    logger.error('stream.clobUser.credentialsFailed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return new Response('Unable to provision trading credentials', { status: 500 });
  }

  if (!creds?.l2Key || !creds.l2Secret || !creds.l2Passphrase) {
    return new Response('Trading credentials incomplete', { status: 409 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const sendEvent = (event: string, data: unknown) => {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    return writer.write(encoder.encode(payload)).catch((error) => {
      logger.warn('stream.clobUser.writeFailed', {
        userId,
        event,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  const sendComment = (comment: string) => {
    return writer.write(encoder.encode(`: ${comment}\n\n`)).catch(() => undefined);
  };

  let closed = false;

  let client: RealTimeDataClient | null = null;

  const cleanup = () => {
    if (closed) return;
    closed = true;
    try {
      client?.disconnect();
    } catch (error) {
      logger.warn('stream.clobUser.disconnectFailed', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    clearInterval(heartbeatId);
    writer.close().catch(() => undefined);
  };

  request.signal.addEventListener('abort', cleanup);

  const heartbeatId = setInterval(() => {
    void sendComment('keep-alive');
  }, 15_000);

  await sendComment('clob-user stream init');
  await sendEvent('status', { connected: false, ts: Date.now() });

  client = new RealTimeDataClient({
    host: env.rtdsUrl,
    pingInterval: env.rtdsPingMs,
    autoReconnect: true,
    onConnect: (connectedClient) => {
      void sendEvent('status', { connected: true, ts: Date.now() });
      try {
        connectedClient.subscribe({
          subscriptions: [
            {
              topic: 'clob_user',
              type: '*',
              clob_auth: {
                key: creds.l2Key as string,
                secret: creds.l2Secret as string,
                passphrase: creds.l2Passphrase as string,
              },
            },
          ],
        });
      } catch (error) {
        logger.error('stream.clobUser.subscribeFailed', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        void sendEvent('error', { message: 'Subscription failed' });
      }
    },
    onMessage: (_wsClient, message) => {
      if (message.topic !== 'clob_user') {
        return;
      }
      const payload: StreamMessage = {
        topic: message.topic,
        type: message.type,
        payload: message.payload,
        receivedAt: Date.now(),
      };
      const eventName = message.type ?? 'message';
      void sendEvent(eventName, payload);
    },
    onStatusChange: (status) => {
      void sendEvent('status', { state: status, connected: status === 'connected', ts: Date.now() });
    },
  });

  client.connect();

  const response = new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });

  response.headers.set('Transfer-Encoding', 'chunked');

  return response;
}


