'use client';

import * as React from 'react';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Link from 'next/link';

type OnboardingWizardProps = {
  hasBuilderSigner: boolean;
  hasL2Creds: boolean;
  hasRelayerSigner: boolean;
  hasSafe: boolean;
  safeStatus?: string | null;
};

export function OnboardingWizard({
  hasBuilderSigner,
  hasL2Creds,
  hasRelayerSigner,
  hasSafe,
  safeStatus,
}: OnboardingWizardProps) {
  const steps = [
    {
      label: 'Connect builder signer',
      description:
        'Register a remote builder signer (or local API creds) so trades can be co-signed by Polymarket.',
      done: hasBuilderSigner,
      action: (
        <Button
          size="small"
          component={Link}
          href="https://docs.polymarket.com/developers/builders/relayer-client#builder-signer"
          target="_blank"
        >
          Builder docs
        </Button>
      ),
    },
    {
      label: 'Add L2 API credentials',
      description:
        'Paste your L2 API key / secret / passphrase to read balances, orders, and PnL in real time.',
      done: hasL2Creds,
    },
    {
      label: 'Wire relayer + RPC',
      description:
        'Provide a relayer private key (Safe owner) and a reliable Polygon RPC so gasless snipes can be sent.',
      done: hasRelayerSigner,
    },
    {
      label: hasSafe ? 'Safe deployed' : 'Deploy Safe',
      description: hasSafe
        ? `Safe ready (${safeStatus ?? 'deployed'}). Fund it with USDC on Polygon to start trading.`
        : 'Use the “Deploy Safe” button above to spin up a per-user Safe via the builder relayer.',
      done: hasSafe,
    },
    {
      label: 'Run /api/health',
      description:
        'Optional: curl /api/health to verify database, Redis, relayer, Polygon RPC, AI, and Pinecone connectivity.',
      done: false,
      action: (
        <Button size="small" component={Link} href="/api/health" target="_blank">
          Open health check
        </Button>
      ),
    },
  ];

  return (
    <Stepper orientation="vertical">
      {steps.map((step) => (
        <Step key={step.label} active completed={step.done}>
          <StepLabel>{step.label}</StepLabel>
          <StepContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {step.description}
            </Typography>
            {step.action ? <Stack direction="row">{step.action}</Stack> : null}
          </StepContent>
        </Step>
      ))}
    </Stepper>
  );
}

