'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getFantasyTeamsByUser, getUserLeagues, getFantasyTeam } from '@/app/utils/firebase';
import { FantasyTeam, FantasyLeague } from '@/app/types/types';
import { calculateFantasyTeamScore } from '@/app/utils/scoring';
import Link from 'next/link';

export default function FantasyTeams() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [fantasyTeams, setFantasyTeams] = useState<FantasyTeam[]>([]);
  const [userLeagues, setUserLeagues] = useState<FantasyLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculatingScores, setCalculatingScores] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setLoading(false);
        return;
      }
      
      try {
        const [teams, leagues] = await Promise.all([
          getFantasyTeamsByUser(user.uid),
          getUserLeagues(user.uid)
        ]);
        
        setFantasyTeams(teams);
        setUserLeagues(leagues);
        setLoading(false);
        
        // Auto-calculate scores for teams that need it
        const teamsNeedingScores = teams.filter(team => 
          team.totalScore === undefined || 
          !team.lastUpdated ||
          Date.now() - team.lastUpdated > 3600000 // 60 minutes
        );
        
        if (teamsNeedingScores.length > 0) {
          calculateTeamScores(teamsNeedingScores);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
        setLoading(false);
      }
    }
    
    if (!authLoading) {
      fetchData();
    }
  }, [user, authLoading]);
  
  // Calculate scores for multiple teams
  async function calculateTeamScores(teamsToCalculate: FantasyTeam[]) {
    // Initialize calculating state for each team
    const initialCalculatingState: Record<string, boolean> = {};
    teamsToCalculate.forEach(team => {
      if (team.id) {
        initialCalculatingState[team.id] = true;
      }
    });
    setCalculatingScores(initialCalculatingState);
    
    // Calculate scores in sequence to avoid overwhelming the API
    for (const team of teamsToCalculate) {
      if (team.id) {
        try {
          await calculateFantasyTeamScore(team.id);
          
          // Refresh the team data
          const updatedTeam = await getFantasyTeam(team.id);
          
          // Update the teams array with the new data
          if (updatedTeam) {
            setFantasyTeams(prevTeams => 
              prevTeams.map(t => 
                t.id === team.id ? updatedTeam : t
              )
            );
          }
          
          // Mark this team as done calculating
          setCalculatingScores(prev => ({
            ...prev,
            [team.id!]: false
          }));
        } catch (err) {
          console.error(`Error calculating score for team ${team.id}:`, err);
          
          // Mark as done even if there was an error
          if (team.id) {
            setCalculatingScores(prev => ({
              ...prev,
              [team.id!]: false
            }));
          }
        }
      }
    }
  }

  // Find league names for display
  const getLeagueNames = (teamId: string) => {
    // In a real implementation, you would have a relationship between teams and leagues
    // This is a placeholder that would need to be replaced with actual implementation
    const leagueNames = userLeagues.map(league => league.name).join(', ');
    return leagueNames || 'No leagues';
  };

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
        <h1 className="text-2xl font-bold text-black">Your Fantasy Teams</h1>
        <div className="flex space-x-3">
          <Link 
            href="/leagues"
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            View Leagues
          </Link>
          <Link 
            href="/fantasy/create"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Create New Team
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {userLeagues.length === 0 && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
          <p className="font-semibold">You haven't joined any leagues yet!</p>
          <p>Join or create a league to compete with other fantasy team owners.</p>
          <Link 
            href="/leagues"
            className="text-blue-600 hover:text-blue-800 underline mt-2 inline-block"
          >
            Browse Leagues →
          </Link>
        </div>
      )}
      
      {fantasyTeams.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-black">No Fantasy Teams Yet</h2>
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
                <h2 className="text-xl font-semibold mb-2 text-black">{team.name}</h2>
                <div className="mb-2">
                  <div className="text-sm text-gray-500">Leagues</div>
                  <div className="text-black">{getLeagueNames(team.id || '')}</div>
                </div>
                <div className="mb-4">
                  <div className="text-sm text-gray-500">Created</div>
                  <div className="text-black">{new Date(team.createdAt).toLocaleDateString()}</div>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <div className="text-sm text-gray-500">Teams</div>
                    <div className="text-black">{team.selectedTeams.length} teams</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Total Cost</div>
                    <div className="text-black">${team.totalCost}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Score</div>
                    <div className="text-black">
                      {team.id && calculatingScores[team.id] 
                        ? "Calculating..." 
                        : (team.totalScore !== undefined 
                          ? team.totalScore.toLocaleString() 
                          : '--')}
                    </div>
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