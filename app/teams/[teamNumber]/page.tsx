// This is a Server Component
import React from 'react';
import TeamDetailClient from './TeamDetailClient';

// Server Component to handle params
export default async function TeamDetailPage({ params }: { params: Promise<{ teamNumber: string }> }) {
  // Next.js 15 uses async server components where params is a Promise
  const resolvedParams = await params;
  
  return <TeamDetailClient teamNumber={resolvedParams.teamNumber} />;
} 