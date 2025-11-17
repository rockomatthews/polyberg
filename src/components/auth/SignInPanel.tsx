'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';

export function SignInPanel() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Paper
        sx={{
          maxWidth: 420,
          width: '100%',
          p: 4,
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          backgroundImage: 'none',
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Typography variant="h5" fontWeight={600}>
            Polymarket Terminal
          </Typography>
          <Typography color="text.secondary" align="center">
            Sign in with Google to access your sniping workspace.
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={() => signIn('google')}
          >
            Continue with Google
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

