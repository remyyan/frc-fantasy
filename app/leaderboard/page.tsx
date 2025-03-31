'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getAllLeagues, getFantasyTeamsByLeague, FantasyLeague, FantasyTeam } from '@/app/utils/firebase';
import { calculateFantasyTeamScore } from '@/app/utils/scoring';

interface LeagueWithTopTeams {
  league: FantasyLeague;
  topTeams: FantasyTeam[];
}

// Number of top teams to show per league
const TOP_TEAMS_COUNT = 5;

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [leaguesWithTeams, setLeaguesWithTeams] = useState<LeagueWithTopTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculatingScores, setCalculatingScores] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    
    async function fetchLeaguesAndTeams() {
      try {
        setLoading(true);
        
        // Fetch all leagues
        const leagues = await getAllLeagues();
        
        if (!leagues.length) {
          setLeaguesWithTeams([]);
          setLoading(false);
          return;
        }
        
        // Fetch top teams for each league
        const leaguesWithTeamsPromises = leagues.map(async (league) => {
          // Skip leagues without an ID
          if (!league.id) {
            return {
              league,
              topTeams: []
            };
          }
          
          const teams = await getFantasyTeamsByLeague(league.id);
          
          // Sort teams by score and take top 5
          const sortedTeams = teams
            .sort((a, b) => {
              if (a.totalScore !== undefined && b.totalScore !== undefined) {
                return b.totalScore - a.totalScore;
              }
              return 0;
            })
            .slice(0, 5);
          
          return {
            league,
            topTeams: sortedTeams
          };
        });
        
        const results = await Promise.all(leaguesWithTeamsPromises);
        setLeaguesWithTeams(results);
        setLoading(false);
        
        // Identify teams that need score calculation
        const allTeams = results.flatMap(({ topTeams }) => topTeams);
        const teamsNeedingScores = allTeams.filter(team => 
          team.totalScore === undefined || 
          !team.lastUpdated ||
          Date.now() - team.lastUpdated > 3600000 // 60 minutes
        );
        
        // Deduplicate teams (a team might appear in multiple leagues)
        const uniqueTeamsToCalculate = teamsNeedingScores.filter(
          (team, index, self) => 
            index === self.findIndex(t => t.id === team.id)
        );
        
        if (uniqueTeamsToCalculate.length > 0) {
          calculateTeamScores(uniqueTeamsToCalculate);
        }
      } catch (err) {
        console.error('Error fetching leagues and teams:', err);
        setError('Failed to load leaderboard data. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchLeaguesAndTeams();
  }, [authLoading]);

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
          const updatedTeam = await getFantasyTeamsByLeague(team.id);
          
          if (updatedTeam) {
            // Update the teams array with the new data
            setLeaguesWithTeams(prevLeaguesWithTeams => {
              return prevLeaguesWithTeams.map(leagueData => {
                // Create a new array with the updated team
                const updatedTopTeams = leagueData.topTeams.map(t => 
                  t.id === team.id ? updatedTeam : t
                ) as FantasyTeam[]; // Explicit type cast
                
                // Re-sort the teams
                const sortedTeams = updatedTopTeams.sort((a, b) => {
                  const scoreA = a.totalScore !== undefined ? a.totalScore : -1;
                  const scoreB = b.totalScore !== undefined ? b.totalScore : -1;
                  return scoreB - scoreA;
                });
                
                return {
                  ...leagueData,
                  topTeams: sortedTeams
                };
              });
            });
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Fantasy Leaderboard</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-6 flex justify-between items-center">
        <p className="text-gray-600">
          View the top performing fantasy teams across all leagues.
        </p>
        {user && (
          <Link
            href="/leagues"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            Browse All Leagues
          </Link>
        )}
      </div>
      
      {leaguesWithTeams.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold mb-2 text-black">No Leagues Yet</h2>
          <p className="text-gray-600 mb-4">
            {user ? 'Create a league to get started!' : 'Sign in to create your own league!'}
          </p>
          {user ? (
            <Link 
              href="/leagues"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Create a League
            </Link>
          ) : (
            <Link 
              href="/login"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Sign In
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {leaguesWithTeams.map(({ league, topTeams }) => (
            <div key={league.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-black">{league.name}</h2>
                  {league.description && (
                    <p className="text-gray-600 mt-1">{league.description}</p>
                  )}
                </div>
                <Link
                  href={`/leagues/${league.id}`}
                  className="text-blue-500 hover:text-blue-700 font-medium"
                >
                  View League
                </Link>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Teams</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topTeams.map((team, index) => (
                      <tr key={team.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{index + 1}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{team.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{team.userName || 'Unknown'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {team.id && calculatingScores[team.id] 
                              ? "Calculating..." 
                              : (team.totalScore !== undefined 
                                ? team.totalScore.toLocaleString() 
                                : '--')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="text-sm text-gray-900">{team.selectedTeams.length}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link 
                            href={`/fantasy/${team.id}`}
                            className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                    
                    {topTeams.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No teams have been created in this league yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="p-4 bg-gray-50 text-right">
                <Link
                  href={`/leagues/${league.id}`}
                  className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center"
                >
                  View All Teams
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 ml-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 