import { getServerSession } from 'next-auth/next';

import { AppShell } from '@/components/layout/AppShell';
import { authOptions } from '@/lib/auth';
import { ensureUserRecord } from '@/lib/services/userService';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    await ensureUserRecord(session);
  }
  return <AppShell />;
}
