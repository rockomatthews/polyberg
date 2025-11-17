'use client';

import * as React from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';

type PanelCardProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  minHeight?: number;
};

export function PanelCard({
  title,
  subtitle,
  actions,
  children,
  minHeight = 0,
}: PanelCardProps) {
  return (
    <Paper
      sx={{
        borderRadius: 2,
        padding: 1.5,
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        backgroundColor: 'background.paper',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        justifyContent="space-between"
      >
        <div>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
          <Typography variant="h6" sx={{ fontSize: '1rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
        </div>
        {actions ? <Stack direction="row">{actions}</Stack> : null}
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
      <Stack sx={{ flex: 1 }}>{children}</Stack>
    </Paper>
  );
}

