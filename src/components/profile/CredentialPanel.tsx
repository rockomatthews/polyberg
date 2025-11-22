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

  const handleChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/profile/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Failed to save credentials');
      }
      setStatus(json.status);
      setForm(initialForm);
      setError(null);
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
          <Stack spacing={2}>
            <SectionHeader title="Builder signer" description="Remote signer endpoint + token" />
            <Stack spacing={1}>
              <TextField
                label="Builder signer URL"
                variant="outlined"
                size="small"
                value={form.builderSignerUrl}
                onChange={handleChange('builderSignerUrl')}
                placeholder="https://builder-signer.example.com/sign"
              />
              <TextField
                label="Builder signer token"
                variant="outlined"
                size="small"
                value={form.builderSignerToken}
                onChange={handleChange('builderSignerToken')}
                placeholder="bearer token or API secret"
              />
            </Stack>
            <SectionHeader title="L2 API credentials" description="Key / secret / passphrase" />
            <Stack spacing={1}>
              <TextField
                label="L2 API key"
                variant="outlined"
                size="small"
                value={form.l2Key}
                onChange={handleChange('l2Key')}
              />
              <TextField
                label="L2 API secret"
                variant="outlined"
                size="small"
                value={form.l2Secret}
                onChange={handleChange('l2Secret')}
              />
              <TextField
                label="L2 API passphrase"
                variant="outlined"
                size="small"
                value={form.l2Passphrase}
                onChange={handleChange('l2Passphrase')}
              />
            </Stack>
            <SectionHeader title="Relayer signer" description="Private key + RPC URL" />
            <Stack spacing={1}>
              <TextField
                label="Polygon RPC URL"
                variant="outlined"
                size="small"
                value={form.relayerRpcUrl}
                onChange={handleChange('relayerRpcUrl')}
                placeholder="https://polygon-mainnet.infura.io/v3/…"
              />
              <TextField
                label="Relayer private key"
                variant="outlined"
                size="small"
                value={form.relayerPrivateKey}
                onChange={handleChange('relayerPrivateKey')}
                placeholder="0xabc…"
              />
            </Stack>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save credentials'}
            </Button>
            <Button
              variant="text"
              onClick={() => setForm(initialForm)}
              disabled={saving}
            >
              Reset form
            </Button>
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


