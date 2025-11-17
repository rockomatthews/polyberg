import { getServerSession } from 'next-auth/next';

import { AppShell } from '@/components/layout/AppShell';
import { SignInPanel } from '@/components/auth/SignInPanel';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <SignInPanel />;
  }

  return <AppShell />;
}
