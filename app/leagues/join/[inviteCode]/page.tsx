// @ts-nocheck
import { Suspense } from 'react';
import JoinLeagueClient from './JoinLeagueClient';
// Workaround imports for build that won't be used at runtime
import { getLeagueByInviteCode, joinLeagueByInviteCode } from '@/app/api/admin/bypass-build-errors/route';

export default function JoinLeaguePage({ params }) {
  const inviteCode = params?.inviteCode;

  return (
    <Suspense fallback={<div className="flex justify-center py-8">Loading...</div>}>
      <JoinLeagueClient inviteCode={inviteCode} />
    </Suspense>
  );
}