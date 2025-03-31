'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getAllLeagues, getFantasyTeamsByLeague, FantasyLeague, FantasyTeam } from '@/app/utils/firebase';

interface LeagueWithTopTeams {
  league: FantasyLeague;
  topTeams: FantasyTeam[];
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [leaguesWithTeams, setLeaguesWithTeams] = useState<LeagueWithTopTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        console.error('Error fetching leagues and teams:', err);
        setError('Failed to load leaderboard data. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchLeaguesAndTeams();
  }, [authLoading]);

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
                            {team.totalScore !== undefined ? team.totalScore : '--'}
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