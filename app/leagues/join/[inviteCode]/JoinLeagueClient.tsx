// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { joinLeague, collection, query, where, getDocs, db } from '@/app/utils/firebase';

export default function JoinLeagueClient({ inviteCode }: { inviteCode: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Joining league...');
  const [leagueName, setLeagueName] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // If user is not logged in, redirect to login page with return URL
      router.push(`/login?redirect=/leagues/join/${inviteCode}`);
      return;
    }
    
    async function joinLeagueWithInvite() {
      try {
        // Find the league with this invite code using a query in getLeague
        // Since we don't have a dedicated function, we'll use a direct firestore query
        const leaguesRef = collection(db, 'leagues');
        const q = query(leaguesRef, where('inviteCode', '==', inviteCode));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setStatus('error');
          setMessage('Invalid invite link. The league may have been deleted or the invite code is incorrect.');
          return;
        }
        
        // Get the first matching league
        const leagueDoc = querySnapshot.docs[0];
        const league = { id: leagueDoc.id, ...leagueDoc.data() };
        
        setLeagueName(league.name);
        
        // Check if user is already a member
        if (league.members.includes(user.uid)) {
          setStatus('success');
          setMessage('You are already a member of this league.');
          
          // Redirect to the league page after a short delay
          setTimeout(() => {
            router.push(`/leagues/${league.id}`);
          }, 2000);
          return;
        }
        
        // Join the league
        await joinLeague(league.id, user.uid);
        
        setStatus('success');
        setMessage('Successfully joined the league!');
        
        // Redirect to the league page after a short delay
        setTimeout(() => {
          router.push(`/leagues/${league.id}`);
        }, 2000);
      } catch (error) {
        console.error('Error joining league by invite link:', error);
        setStatus('error');
        setMessage('An error occurred while trying to join the league.');
      }
    }
    
    joinLeagueWithInvite();
  }, [user, authLoading, inviteCode, router]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-md">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">
          {status === 'loading' ? 'Joining League...' : 
           status === 'success' ? 'Success!' : 
           'Unable to Join League'}
        </h1>
        
        {leagueName && (
          <h2 className="text-xl mb-4">{leagueName}</h2>
        )}
        
        <div className={`mb-6 ${
          status === 'loading' ? 'text-blue-600' :
          status === 'success' ? 'text-green-600' :
          'text-red-600'
        }`}>
          {status === 'loading' && (
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {status === 'success' && (
            <svg className="h-12 w-12 text-green-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          
          {status === 'error' && (
            <svg className="h-12 w-12 text-red-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          
          <p>{message}</p>
        </div>
        
        <div>
          <Link 
            href="/leagues" 
            className="text-blue-500 hover:text-blue-700 font-medium"
          >
            Go to Leagues
          </Link>
        </div>
      </div>
    </div>
  );
} 