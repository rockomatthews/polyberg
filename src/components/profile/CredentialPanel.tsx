'use client';

import * as React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Link from 'next/link';

type CredentialStatus = {
  hasBuilderSigner: boolean;
  hasL2Creds: boolean;
  hasRelayerSigner: boolean;
};

type FormState = {
  builderSignerUrl: string;
  builderSignerToken: string;
  l2Key: string;
  l2Secret: string;
  l2Passphrase: string;
  relayerRpcUrl: string;
  relayerPrivateKey: string;
};

const initialForm: FormState = {
  builderSignerUrl: '',
  builderSignerToken: '',
  l2Key: '',
  l2Secret: '',
  l2Passphrase: '',
  relayerRpcUrl: '',
  relayerPrivateKey: '',
};

export function CredentialPanel() {
  const [status, setStatus] = React.useState<CredentialStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(initialForm);
  const steps = React.useMemo(
    () => [
      {
        id: 'signer',
        title: 'Connect builder signer',
        description: 'Point to your remote signing server so Polymarket can attribute trades.',
        doc: 'https://docs.polymarket.com/developers/builders/builder-signing-server',
        complete: status?.hasBuilderSigner ?? false,
        fields: [
          {
            name: 'builderSignerUrl' as const,
            label: 'Signer URL',
            placeholder: 'https://builder.example.com/sign',
          },
          {
            name: 'builderSignerToken' as const,
            label: 'Signer token (bearer or API secret)',
            placeholder: 'pm_builder_token',
          },
        ],
      },
      {
        id: 'l2',
        title: 'Paste L2 API credentials',
        description: 'Grab the key / secret / passphrase from polymarket.com → Settings → Builder.',
        doc: 'https://docs.polymarket.com/developers/builders/builder-profile',
        complete: status?.hasL2Creds ?? false,
        fields: [
          { name: 'l2Key' as const, label: 'L2 API key', placeholder: 'pk_live_...' },
          { name: 'l2Secret' as const, label: 'L2 API secret', placeholder: 'secret' },
          { name: 'l2Passphrase' as const, label: 'L2 API passphrase', placeholder: 'passphrase' },
        ],
      },
      {
        id: 'relayer',
        title: 'Wire relayer signer',
        description: 'Use the Safe-owner private key + Polygon RPC to submit gasless snipes.',
        doc: 'https://docs.polymarket.com/developers/builders/relayer-client',
        complete: status?.hasRelayerSigner ?? false,
        fields: [
          {
            name: 'relayerRpcUrl' as const,
            label: 'Polygon RPC URL',
            placeholder: 'https://polygon-mainnet.infura.io/v3/…',
          },
          {
            name: 'relayerPrivateKey' as const,
            label: 'Relayer private key',
            placeholder: '0xabc...',
          },
        ],
      },
    ],
    [status],
  );
  const firstIncomplete = steps.findIndex((step) => !step.complete);
  const [activeStep, setActiveStep] = React.useState(() =>
    firstIncomplete === -1 ? 0 : firstIncomplete,
  );
  React.useEffect(() => {
    if (firstIncomplete >= 0) {
      setActiveStep(firstIncomplete);
    }
  }, [firstIncomplete]);

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/profile/credentials');
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Failed to load credential status');
      setStatus(json.status);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load credential status');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleChange =
    (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSave = async (fieldNames: Array<keyof FormState>, nextStepIndex?: number) => {
    setSaving(true);
    try {
      const payload: Partial<FormState> = {};
      fieldNames.forEach((name) => {
        payload[name] = form[name];
      });
      const response = await fetch('/api/profile/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to save credentials');
      }
      setStatus(json.status);
      setForm((prev) => ({
        ...prev,
        ...fieldNames.reduce(
          (acc, name) => ({
            ...acc,
            [name]: '',
          }),
          {},
        ),
      }));
      setError(null);
      if (typeof nextStepIndex === 'number') {
        setActiveStep(nextStepIndex);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <div>
            <Typography variant="h6">Builder Credentials</Typography>
            <Typography variant="body2" color="text.secondary">
              Store builder signer, L2 API, and relayer credentials encrypted on the server. These
              unlock per-user snipes without sharing global environment secrets.
            </Typography>
          </div>
          {error ? (
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
          ) : null}
          {loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} /> <Typography>Loading status…</Typography>
            </Stack>
          ) : status ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <StatusPill label="Builder signer" ok={status.hasBuilderSigner} />
              <StatusPill label="L2 API creds" ok={status.hasL2Creds} />
              <StatusPill label="Relayer signer" ok={status.hasRelayerSigner} />
            </Stack>
          ) : null}
          <Stack spacing={1.5}>
            {steps.map((step, index) => {
              const isActive = activeStep === index;
              const isComplete = step.complete;
              return (
                <Card
                  key={step.id}
                  variant="outlined"
                  sx={{ borderColor: isComplete ? 'success.light' : 'rgba(255,255,255,0.08)' }}
                >
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        justifyContent="space-between"
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        spacing={1}
                      >
                        <div>
                          <Typography variant="subtitle1">{step.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {step.description}{' '}
                            <Button
                              size="small"
                              component={Link}
                              href={step.doc}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Docs
                            </Button>
                          </Typography>
                        </div>
                        <StatusPill label={isComplete ? 'Complete' : 'Pending'} ok={isComplete} />
                      </Stack>
                      {isActive ? (
                        <Stack spacing={1}>
                          {step.fields.map((field) => (
                            <TextField
                              key={field.name}
                              label={field.label}
                              variant="outlined"
                              size="small"
                              type={field.name.toLowerCase().includes('key') ? 'password' : 'text'}
                              value={form[field.name]}
                              onChange={handleChange(field.name)}
                              placeholder={field.placeholder}
                              autoComplete="off"
                            />
                          ))}
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button
                              variant="contained"
                              onClick={() => handleSave(step.fields.map((f) => f.name), index + 1)}
                              disabled={saving}
                            >
                              {saving ? 'Saving…' : 'Save & continue'}
                            </Button>
                            <Button
                              variant="text"
                              onClick={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  ...step.fields.reduce(
                                    (acc, field) => ({
                                      ...acc,
                                      [field.name]: '',
                                    }),
                                    {},
                                  ),
                                }));
                              }}
                              disabled={saving}
                            >
                              Clear
                            </Button>
                          </Stack>
                        </Stack>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setActiveStep(index)}
                        >
                          {isComplete ? 'Edit' : 'Fill step'}
                        </Button>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

type StatusPillProps = { label: string; ok: boolean };

function StatusPill({ label, ok }: StatusPillProps) {
  return (
    <Typography
      variant="caption"
      sx={{
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        fontWeight: 600,
        bgcolor: ok ? 'success.light' : 'warning.light',
        color: ok ? 'success.contrastText' : 'warning.contrastText',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {label}
    </Typography>
  );
}

type SectionHeaderProps = { title: string; description: string };

function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div>
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="caption" color="text.secondary">
        {description}
      </Typography>
    </div>
  );
}


