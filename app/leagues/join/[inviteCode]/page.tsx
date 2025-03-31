// @ts-nocheck
// This is a server component that renders the client component
import { Suspense } from 'react';
import JoinLeagueClient from './JoinLeagueClient';

export default function JoinLeaguePage(props: any) {
  const inviteCode = props.params?.inviteCode;

  return (
    <Suspense fallback={<div className="flex justify-center py-8">Loading...</div>}>
      <JoinLeagueClient inviteCode={inviteCode} />
    </Suspense>
  );
}