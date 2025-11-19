'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

import { PanelCard } from './PanelCard';
import { useMarketsData } from '@/hooks/useTerminalData';

export function StrategyCopilot() {
  const { data: markets } = useMarketsData();
  const [insight, setInsight] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);
    try {
      const prompt = `Summarize where the best sniping opportunities might be across these Polymarket markets: ${markets
        ?.map((m) => `${m.question} (bid ${m.bestBid ?? 'n/a'}¢, ask ${m.bestAsk ?? 'n/a'}¢)`)
        .join('; ')}`;
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Unknown AI error');
      }
      setInsight(json.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown AI error');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!insight && !loading) {
      void generateInsight();
    }
  }, [insight, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PanelCard title="Strategy Copilot" subtitle="AI insight" minHeight={260}>
      <Stack spacing={2}>
        {loading ? (
          <Stack alignItems="center" spacing={1}>
            <CircularProgress size={24} />
            <Typography variant="caption" color="text.secondary">
              Generating intel…
            </Typography>
          </Stack>
        ) : error ? (
          <Typography color="error.main" variant="body2">
            {error}
          </Typography>
        ) : insight ? (
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {insight}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Press the button below to generate a market summary.
          </Typography>
        )}
        <Button onClick={generateInsight} variant="outlined" disabled={loading}>
          {loading ? 'Thinking…' : 'Refresh Insight'}
        </Button>
      </Stack>
    </PanelCard>
  );
}

