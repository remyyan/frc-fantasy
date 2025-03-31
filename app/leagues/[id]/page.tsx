// This is a Server Component
import React from 'react';
import LeagueDetailClient from './LeagueDetailClient';

// Server Component to handle params
export default async function LeagueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15 uses async server components where params is a Promise
  const resolvedParams = await params;
  
  return <LeagueDetailClient leagueId={resolvedParams.id} />;
} 