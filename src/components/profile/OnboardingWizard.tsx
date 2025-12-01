'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepContent from '@mui/material/StepContent';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

type OnboardingWizardProps = {
  hasBuilderSigner: boolean;
  hasL2Creds: boolean;
  hasRelayerSigner: boolean;
  hasSafe: boolean;
  safeStatus?: string | null;
};

const initialForm = {
  l2Key: '',
  l2Secret: '',
  l2Passphrase: '',
};

export function OnboardingWizard({
  hasBuilderSigner,
  hasL2Creds,
  hasRelayerSigner,
  hasSafe,
  safeStatus,
}: OnboardingWizardProps) {
  const [status, setStatus] = React.useState(() => ({
    hasBuilderSigner,
    hasL2Creds,
    hasRelayerSigner,
  }));
  const safeReady = hasSafe;
  const [form, setForm] = React.useState(initialForm);
  const currentSafeStatus = safeStatus ?? null;
  const [activeStep, setActiveStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [formSuccess, setFormSuccess] = React.useState<string | null>(null);

  const refreshStatus = React.useCallback(async () => {
    try {
      const response = await fetch('/api/profile/credentials', { cache: 'no-store' });
      const json = await response.json();
      if (response.ok && json.status) {
        setStatus(json.status);
      }
    } catch (error) {
      console.warn('onboardingWizard.refreshStatus', error);
    }
  }, []);

  React.useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const handleFieldChange =
    (field: keyof typeof initialForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSaveCredentials = async () => {
    setFormError(null);
    setFormSuccess(null);
    if (!form.l2Key.trim() || !form.l2Secret.trim() || !form.l2Passphrase.trim()) {
      setFormError('Paste the key, secret, and passphrase from polymarket.com → Builder.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/profile/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          l2Key: form.l2Key.trim(),
          l2Secret: form.l2Secret.trim(),
          l2Passphrase: form.l2Passphrase.trim(),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to save credentials');
      }
      setStatus(json.status);
      setForm(initialForm);
      setFormSuccess('Builder L2 credentials encrypted and saved.');
      setActiveStep(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    {
      label: 'Paste builder API credentials',
      description: 'Copy the L2 key / secret / passphrase into the encrypted vault.',
      complete: status.hasL2Creds,
      content: (
        <Stack spacing={1.5}>
          <TextField
            label="L2 API key"
            size="small"
            value={form.l2Key}
            onChange={handleFieldChange('l2Key')}
            autoComplete="off"
          />
          <TextField
            label="L2 API secret"
            size="small"
            type="password"
            value={form.l2Secret}
            onChange={handleFieldChange('l2Secret')}
            autoComplete="off"
          />
          <TextField
            label="L2 API passphrase"
            size="small"
            type="password"
            value={form.l2Passphrase}
            onChange={handleFieldChange('l2Passphrase')}
            autoComplete="off"
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleSaveCredentials} disabled={saving}>
              {saving ? 'Saving…' : 'Save builder creds'}
            </Button>
            <Button
              variant="text"
              onClick={() => setForm(initialForm)}
              disabled={saving || (!form.l2Key && !form.l2Secret && !form.l2Passphrase)}
            >
              Clear
            </Button>
          </Stack>
          {formError ? (
            <Alert severity="error" variant="outlined">
              {formError}
            </Alert>
          ) : null}
          {formSuccess ? (
            <Alert severity="success" variant="outlined">
              {formSuccess}
            </Alert>
          ) : null}
        </Stack>
      ),
    },
    {
      label: 'Connect signer + relayer',
      description:
        'Point to your builder signer URL/token and relayer private key to unlock live trading.',
      complete: status.hasBuilderSigner && status.hasRelayerSigner,
      content: (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            The detailed credential form below accepts signer URL/token, relayer RPC, and private
            keys. Once they turn green the relayer client can co-sign orders.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              label={`Builder signer • ${status.hasBuilderSigner ? 'connected' : 'pending'}`}
              color={status.hasBuilderSigner ? 'success' : 'warning'}
              size="small"
            />
            <Chip
              label={`Relayer signer • ${status.hasRelayerSigner ? 'ready' : 'pending'}`}
              color={status.hasRelayerSigner ? 'success' : 'warning'}
              size="small"
            />
          </Stack>
          <Button
            component={Link}
            href="#builder-credentials"
            variant="outlined"
            size="small"
          >
            Open advanced credential form
          </Button>
          <Button
            component={Link}
            href="https://docs.polymarket.com/developers/builders/builder-signing-server"
            target="_blank"
            size="small"
          >
            Builder docs
          </Button>
        </Stack>
      ),
    },
    {
      label: safeReady ? 'Safe ready' : 'Safe onboarding',
      description: safeReady
        ? `Safe ${currentSafeStatus ?? 'ready'}. Fund it with USDC on Polygon to trade.`
        : 'Finish the Safe fee + deployment steps inside the Account card above.',
      complete: safeReady,
      content: (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Head to <strong>Account → Safe</strong> to pay the one-time fee and trigger deployment.
            This step marks itself complete once the Safe is live.
          </Typography>
        </Stack>
      ),
    },
  ];

  const firstIncomplete = steps.findIndex((step) => !step.complete);
  React.useEffect(() => {
    if (firstIncomplete === -1) {
      setActiveStep(steps.length - 1);
    } else if (activeStep > firstIncomplete) {
      setActiveStep(firstIncomplete);
    }
  }, [activeStep, firstIncomplete, steps.length]);

  return (
    <Stepper orientation="vertical" activeStep={activeStep}>
      {steps.map((step, index) => (
        <Step key={step.label} expanded>
          <StepLabel
            onClick={() => setActiveStep(index)}
            sx={{ cursor: 'pointer' }}
            optional={
              step.complete ? (
                <Typography variant="caption" color="success.light">
                  Complete
                </Typography>
              ) : undefined
            }
          >
            {step.label}
          </StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {step.description}
            </Typography>
            {step.content}
          </StepContent>
        </Step>
      ))}
    </Stepper>
  );
}

