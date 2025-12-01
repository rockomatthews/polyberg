'use client';

import * as React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';

import { PanelCard } from './PanelCard';
import { useMarketsData, usePositionsData } from '@/hooks/useTerminalData';
import { useUserWatchlist } from '@/hooks/useWatchlist';
import { useTerminalStore } from '@/state/useTerminalStore';

type SnipingSuggestion = {
  market: string;
  entry: string;
  thesis: string;
  risk: string;
};

export function StrategyCopilot() {
  const { data: markets } = useMarketsData();
  const { data: positionsData } = usePositionsData();
  const positions = positionsData?.positions ?? [];
  const { watchlist } = useUserWatchlist();
  const setSelection = useTerminalStore((state) => state.setSelection);

  const [insight, setInsight] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<SnipingSuggestion[]>([]);

  const generateInsight = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            markets: (markets ?? []).slice(0, 12),
            positions,
            watchlist,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error || 'Unknown AI error');
      }
      setInsight(json.text);
      setSuggestions(json.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown AI error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSuggestion = (suggestion: SnipingSuggestion) => {
    const match =
      markets?.find((market) =>
        market.question.toLowerCase().includes(suggestion.market.toLowerCase()),
      ) ??
      markets?.find(
        (market) => market.tag && suggestion.market.toLowerCase().includes(market.tag.toLowerCase()),
      );
    if (match?.primaryTokenId) {
      setSelection({
        marketId: match.conditionId,
        tokenId: match.primaryTokenId,
        question: match.question,
      });
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
        {suggestions.length ? (
          <Stack spacing={1}>
            {suggestions.map((idea, index) => (
              <Paper
                key={`${idea.market}-${index}`}
                variant="outlined"
                sx={{ p: 1.5, bgcolor: 'rgba(255,255,255,0.02)' }}
              >
                <Typography variant="subtitle2">{idea.market}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Entry {idea.entry} · Risk: {idea.risk}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {idea.thesis}
                </Typography>
                <Button
                  size="small"
                  sx={{ mt: 1 }}
                  onClick={() => handleLoadSuggestion(idea)}
                  disabled={loading || !markets?.length}
                >
                  Load market
                </Button>
              </Paper>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </PanelCard>
  );
}

