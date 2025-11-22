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
import {
  getUserCredentialStatus,
  type UserCredentialStatus,
} from '@/lib/services/userCredentialsService';
import { CredentialPanel } from '@/components/profile/CredentialPanel';
import { OnboardingWizard } from '@/components/profile/OnboardingWizard';
import { logger } from '@/lib/logger';

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
  credentialStatus: UserCredentialStatus;
}> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/');
  }
  let credentialStatus: UserCredentialStatus = {
    hasBuilderSigner: false,
    hasL2Creds: false,
    hasRelayerSigner: false,
  };
  try {
    const status = await getUserCredentialStatus(session.user.id);
    credentialStatus = status.status;
  } catch (error) {
    logger.error('profile.credentials.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  let record: UserRecord | null = null;
  let safeRecord: UserSafeRecord | null = null;
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
    safeRecord = await getUserSafe(session.user.id);
  } catch (error) {
    logger.error('profile.userSafe.failed', {
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
    sessionSafe: safeRecord,
    copilotHistory: history,
    sessionEmail: session.user.email ?? record?.email ?? undefined,
    sessionName: session.user.name ?? record?.name ?? undefined,
    credentialStatus,
  };
}

export default async function ProfilePage() {
  const { sessionUser, sessionSafe, copilotHistory, sessionEmail, sessionName, credentialStatus } =
    await loadUser();

  const builderStatuses = [
    { label: 'Builder signer', ok: hasBuilderSigning || credentialStatus.hasBuilderSigner },
    { label: 'L2 API creds', ok: hasL2Auth || credentialStatus.hasL2Creds },
    { label: 'Order signer', ok: hasOrderSigner || credentialStatus.hasRelayerSigner },
    { label: 'Relayer URL', ok: hasRelayer || credentialStatus.hasRelayerSigner },
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

        <CredentialPanel />

        <SafePanel
          initialUserSafe={sessionSafe}
          sharedSafeAddress={env.safeAddress ?? null}
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
              Builder Onboarding Wizard
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Track the end-to-end checklist every trader must complete before firing gasless snipes.
              Steps mark themselves complete as you configure credentials, deploy a Safe, and pass the
              health check.
            </Typography>
            <OnboardingWizard
              hasBuilderSigner={hasBuilderSigning || credentialStatus.hasBuilderSigner}
              hasL2Creds={hasL2Auth || credentialStatus.hasL2Creds}
              hasRelayerSigner={credentialStatus.hasRelayerSigner}
              hasSafe={Boolean(sessionSafe?.safe_address)}
              safeStatus={sessionSafe?.status}
            />
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}

