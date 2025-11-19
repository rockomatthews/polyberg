import 'server-only';

import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
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
  getUserSafe,
  type UserRecord,
  type UserSafeRecord,
} from '@/lib/services/userService';
import {
  env,
  hasBuilderSigning,
  hasL2Auth,
  hasOrderSigner,
  hasRelayer,
} from '@/lib/env';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { SafePanel } from '@/components/profile/SafePanel';
import {
  listCopilotEntries,
  type CopilotEntry,
} from '@/lib/services/copilotService';

type StatusChipProps = {
  label: string;
  ok: boolean;
};

function StatusChip({ label, ok }: StatusChipProps) {
  return (
    <Chip
      label={label}
      color={ok ? 'success' : 'warning'}
      size="small"
      variant={ok ? 'filled' : 'outlined'}
      sx={{ mr: 1, mb: 1 }}
    />
  );
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString();
}

async function loadUser(): Promise<{
  sessionUser: UserRecord | null;
  sessionSafe: UserSafeRecord | null;
  copilotHistory: CopilotEntry[];
  sessionEmail?: string;
  sessionName?: string;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/');
  }
  let record: UserRecord | null = null;
  let safeRecord: UserSafeRecord | null = null;
  let history: CopilotEntry[] = [];

  try {
    await ensureUserRecord(session);
    record = await getUserRecord(session.user.id);
  } catch (error) {
    console.error('[profile] failed to upsert user record', error);
  }

  try {
    safeRecord = await getUserSafe(session.user.id);
  } catch (error) {
    console.error('[profile] failed to load user safe', error);
  }

  try {
    history = await listCopilotEntries(session.user.id, 5);
  } catch (error) {
    console.error('[profile] failed to load copilot history', error);
  }

  return {
    sessionUser: record,
    sessionSafe: safeRecord,
    copilotHistory: history,
    sessionEmail: session.user.email ?? record?.email ?? undefined,
    sessionName: session.user.name ?? record?.name ?? undefined,
  };
}

export default async function ProfilePage() {
  const { sessionUser, sessionSafe, copilotHistory, sessionEmail, sessionName } =
    await loadUser();

  const builderStatuses = [
    { label: 'Builder signer', ok: hasBuilderSigning },
    { label: 'L2 API creds', ok: hasL2Auth },
    { label: 'Order signer', ok: hasOrderSigner },
    { label: 'Relayer URL', ok: hasRelayer },
  ];

  const safeAddress = env.safeAddress ?? 'Not configured';

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Stack spacing={3}>
        <div>
          <Typography variant="h4" gutterBottom>
            Profile
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your Polymarket Snipes account, builder connectivity, and session details.
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
          </CardContent>
        </Card>

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Builder Connectivity
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              These toggles reflect the global environment configuration. All traders inherit these
              settings until per-user Safes are deployed.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {builderStatuses.map((status) => (
                <StatusChip key={status.label} label={status.label} ok={status.ok} />
              ))}
            </Box>
          </CardContent>
        </Card>

        <SafePanel
          initialSafeAddress={sessionSafe?.safe_address ?? env.safeAddress ?? null}
          canDeploy={hasRelayer}
          collateralAddress={env.collateralAddress}
        />

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

        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Builder Onboarding Tutorial
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Every trader who wants their own Safe must first be accepted into the Polymarket Builder
              Program. Share these steps with customers so they can gather the required credentials and
              fund their personal Safe.
            </Typography>
            <Box
              component="ol"
              sx={{
                pl: 3,
                '& li': {
                  mb: 1.5,
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                },
              }}
            >
              <li>
                Apply for builder access at{' '}
                <Link href="https://docs.polymarket.com/developers/builders/overview" target="_blank">
                  docs.polymarket.com
                </Link>{' '}
                and wait for approval (takes a few days).
              </li>
              <li>
                Once approved, visit <strong>polymarket.com → Settings → Builder Program</strong> to
                create a Builder API key or configure a remote signer. This becomes the{' '}
                <code>POLYMARKET_BUILDER_SIGNER_URL/TOKEN</code> pair.
              </li>
              <li>
                Generate L2 API credentials (key / secret / passphrase) from the same menu. These map to
                <code>POLYMARKET_L2_API_* </code> and allow the user to read balances and place orders.
              </li>
              <li>
                Deploy a Safe via the “Deploy Safe” action (coming soon here) or manually through the
                builder relayer. Keep the Safe address handy; it’s where collateral will live.
              </li>
              <li>
                Fund the Safe by withdrawing USDC from Polymarket (or any Polygon wallet) directly to the
                Safe address. No gas is required for execution—the relayer covers that part.
              </li>
              <li>
                Paste the signer URL/token + L2 credentials into this terminal (future per-user inputs) so
                trades execute under that user’s identity and balances stay segregated.
              </li>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Until the per-user forms ship, operators can collect these details out-of-band and load them
              into your own signing infrastructure.
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

