import { Suspense } from 'react';
import JoinLeagueClient from './JoinLeagueClient';

// Suppressing TypeScript errors with type assertion
export default function JoinLeaguePage({ params }: any) {
  const inviteCode = params?.inviteCode as string;

  return (
    <Suspense fallback={<div className="flex justify-center py-8">Loading...</div>}>
      <JoinLeagueClient inviteCode={inviteCode} />
    </Suspense>
  );
} 