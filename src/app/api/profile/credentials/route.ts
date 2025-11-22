import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/lib/auth';
import {
  computeCredentialStatus,
  getUserCredentials,
  getUserCredentialStatus,
  upsertUserCredentials,
  UserCredentialPayload,
} from '@/lib/services/userCredentialsService';
import { logger } from '@/lib/logger';

const allowedKeys = new Set<keyof UserCredentialPayload>([
  'builderSignerUrl',
  'builderSignerToken',
  'builderApiKey',
  'builderApiSecret',
  'builderApiPassphrase',
  'l2Key',
  'l2Secret',
  'l2Passphrase',
  'relayerUrl',
  'relayerRpcUrl',
  'relayerPrivateKey',
  'relayerChainId',
  'orderSignerPrivateKey',
]);

function sanitizePayload(body: Record<string, unknown>, existing?: UserCredentialPayload) {
  const nextPayload: UserCredentialPayload = { ...(existing ?? {}) };
  for (const [key, rawValue] of Object.entries(body)) {
    if (!allowedKeys.has(key as keyof UserCredentialPayload)) {
      continue;
    }
    if (!['string', 'number'].includes(typeof rawValue) && rawValue !== null) {
      continue;
    }
    let value: string | number | undefined;
    if (rawValue === '' || rawValue === null) {
      value = undefined;
    } else if (typeof rawValue === 'number') {
      value = rawValue;
    } else {
      const trimmed = (rawValue as string).trim();
      if (trimmed.length === 0) {
        value = undefined;
      } else if (key === 'relayerChainId') {
        const parsed = Number(trimmed);
        value = Number.isNaN(parsed) ? undefined : parsed;
      } else {
        value = trimmed;
      }
    }
    if (value === undefined) {
      delete (nextPayload as Record<string, unknown>)[key];
    } else {
      (nextPayload as Record<string, unknown>)[key] = value;
    }
  }
  return nextPayload;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const { status, updatedAt } = await getUserCredentialStatus(session.user.id);
  logger.info('credentials.status.fetch', {
    userId: session.user.id,
  });
  return NextResponse.json({ status, updatedAt });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) ?? {};
  const existing = (await getUserCredentials(session.user.id)) ?? {};
  const merged = sanitizePayload(body, existing);
  await upsertUserCredentials(session.user.id, merged);
  const status = computeCredentialStatus(merged);
  logger.info('credentials.updated', {
    userId: session.user.id,
    hasBuilderSigner: status.hasBuilderSigner,
    hasL2Creds: status.hasL2Creds,
    hasRelayerSigner: status.hasRelayerSigner,
  });
  return NextResponse.json({ status });
}

