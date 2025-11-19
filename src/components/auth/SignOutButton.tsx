'use client';

import Button from '@mui/material/Button';
import LogoutIcon from '@mui/icons-material/Logout';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <Button
      variant="outlined"
      color="inherit"
      size="small"
      startIcon={<LogoutIcon fontSize="small" />}
      onClick={() => signOut({ callbackUrl: '/' })}
    >
      Sign out
    </Button>
  );
}

