import { getServerSession } from 'next-auth/next';

import { AppShell } from '@/components/layout/AppShell';
import { SignInPanel } from '@/components/auth/SignInPanel';
import { authOptions } from '@/lib/auth';
import { ensureUserRecord } from '@/lib/services/userService';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    await ensureUserRecord(session);
  }

  if (!session) {
    return <SignInPanel />;
  }

  return <AppShell />;
}
