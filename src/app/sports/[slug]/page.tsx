import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { notFound } from 'next/navigation';

import { SportsEventClient } from '@/components/sports/SportsEventClient';
import { TerminalHeader } from '@/components/layout/TerminalHeader';
import { fetchSportsEvent } from '@/lib/polymarket/sportsService';

type PageProps = {
  params: { slug: string };
};

export default async function SportsEventPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug);
  const event = await fetchSportsEvent(slug).catch((error) => {
    console.error('sports.fetch.failed', error);
    return null;
  });

  if (!event) {
    notFound();
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        backgroundColor: 'background.default',
        color: 'text.primary',
      }}
    >
      <TerminalHeader />
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Typography variant="overline" color="text.secondary">
            Sports Board
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 600 }}>
            {event.title}
          </Typography>
        </Stack>
        <SportsEventClient event={event} />
      </Container>
    </Box>
  );
}

