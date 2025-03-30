'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getFantasyTeamsByUser } from '@/app/utils/firebase';
import { FantasyTeam } from '@/app/types/types';
import Link from 'next/link';

export default function FantasyTeams() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [fantasyTeams, setFantasyTeams] = useState<FantasyTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFantasyTeams() {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const teams = await getFantasyTeamsByUser(user.uid);
        setFantasyTeams(teams);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching fantasy teams:', err);
        setError('Failed to load fantasy teams');
        setLoading(false);
      }
    }
    
    if (!authLoading) {
      fetchFantasyTeams();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Your Fantasy Teams</h1>
        <p className="mb-4">Please log in to view your fantasy teams.</p>
        <button 
          onClick={() => router.push('/login')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Fantasy Teams</h1>
        <Link 
          href="/fantasy/create"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create New Team
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {fantasyTeams.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">No Fantasy Teams Yet</h2>
          <p className="text-gray-600 mb-4">Create your first fantasy team to get started!</p>
          <Link 
            href="/fantasy/create"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Create Fantasy Team
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fantasyTeams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-2">{team.name}</h2>
                <div className="mb-4">
                  <div className="text-sm text-gray-500">Created</div>
                  <div>{new Date(team.createdAt).toLocaleDateString()}</div>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="text-sm text-gray-500">Teams</div>
                    <div>{team.selectedTeams.length} teams</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Cost</div>
                    <div>${team.totalCost}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Score</div>
                    <div>{team.totalScore !== undefined ? team.totalScore : '--'}</div>
                  </div>
                </div>
                
                <Link 
                  href={`/fantasy/${team.id}`}
                  className="block text-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded w-full"
                >
                  View Team
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 