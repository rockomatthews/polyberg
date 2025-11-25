import { alpha, createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    accent: Palette['primary'];
  }
  interface PaletteOptions {
    accent?: PaletteOptions['primary'];
  }
}

export const terminalTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4dd0e1',
      contrastText: '#020305',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#05070b',
      paper: '#0d1117',
    },
    divider: 'rgba(255,255,255,0.08)',
    accent: {
      main: '#8bc34a',
    },
  },
  typography: {
    fontFamily: [
      'IBM Plex Mono',
      'IBM Plex Sans',
      'SFMono-Regular',
      'ui-monospace',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ].join(','),
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.5rem', fontWeight: 600 },
    h3: { fontSize: '1.25rem', fontWeight: 600 },
    body1: { fontSize: '0.95rem' },
    body2: { fontSize: '0.85rem' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 6,
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: alpha('#ffffff', 0.02),
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#4dd0e1',
          },
        },
        input: {
          padding: '14px 16px',
          fontSize: '0.92rem',
          lineHeight: 1.35,
          '::placeholder': {
            opacity: 0.7,
          },
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: alpha('#ffffff', 0.04),
          '&:hover': {
            backgroundColor: alpha('#ffffff', 0.06),
          },
          '&.Mui-focused': {
            backgroundColor: alpha('#ffffff', 0.08),
          },
        },
        input: {
          padding: '18px 16px 12px',
          fontSize: '0.92rem',
          lineHeight: 1.35,
          '::placeholder': {
            opacity: 0.7,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.82rem',
          transform: 'translate(14px, 12px) scale(1)',
        },
        shrink: {
          transform: 'translate(14px, -8px) scale(0.85)',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.05)',
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        color: 'default',
      },
      styleOverrides: {
        root: {
          backgroundColor: '#090c12',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
  },
});

