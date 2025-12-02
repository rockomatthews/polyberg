import 'server-only';

import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Link from 'next/link';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import {
  ensureUserRecord,
  getUserRecord,
  type UserRecord,
} from '@/lib/services/userService';
import { env } from '@/lib/env';
import { SignOutButton } from '@/components/auth/SignOutButton';
import {
  listCopilotEntries,
  type CopilotEntry,
} from '@/lib/services/copilotService';
import { SafeSummary } from '@/components/profile/SafeSummary';
import { StrategyAdminPanel } from '@/components/profile/StrategyAdminPanel';
import { logger } from '@/lib/logger';

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}

async function loadUser(): Promise<{
  sessionUser: UserRecord | null;
  copilotHistory: CopilotEntry[];
  sessionEmail?: string;
  sessionName?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/');
  }
  let record: UserRecord | null = null;
  let history: CopilotEntry[] = [];

  try {
    await ensureUserRecord(session);
    record = await getUserRecord(session.user.id);
  } catch (error) {
    logger.error('profile.userRecord.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    history = await listCopilotEntries(session.user.id, 5);
  } catch (error) {
    logger.error('profile.copilotHistory.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    sessionUser: record,
    copilotHistory: history,
    sessionEmail: session.user.email ?? record?.email ?? undefined,
    sessionName: session.user.name ?? record?.name ?? undefined,
  };
}

export default async function ProfilePage() {
  const { sessionUser, copilotHistory, sessionEmail, sessionName } = await loadUser();

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <div>
          <Typography variant="h4" gutterBottom>
            Profile
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your Polymarket Snipes account and session details.
          </Typography>
        </div>

        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6">Account</Typography>
              <Typography variant="body1">
                {sessionName ?? 'Unnamed operator'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {sessionEmail ?? 'No email on file'}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <SignOutButton />
                <Link href="/" passHref legacyBehavior>
                  <Button component="a" variant="text">
                    Back to terminal
                  </Button>
                </Link>
              </Stack>
            </Stack>
            <SafeSummary collateralAddress={env.collateralAddress} />
          </CardContent>
        </Card>

        <StrategyAdminPanel />

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Session Activity
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Account created: {formatTimestamp(sessionUser?.created_at)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Last synced: {formatTimestamp(sessionUser?.updated_at)}
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Copilot Memory
            </Typography>
            {copilotHistory.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No AI insights stored yet. Generate intel from the terminal and they’ll appear here.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {copilotHistory.map((entry) => (
                  <Box
                    key={entry.id}
                    sx={{ p: 1, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.04)' }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      {new Date(entry.created_at).toLocaleString()}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {entry.response}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

      </Stack>
    </Container>
  );
}

