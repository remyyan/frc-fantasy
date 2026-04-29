'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getAllLeagues, getFantasyTeamsByLeague, FantasyLeague, FantasyTeam, EventConfig } from '@/app/utils/firebase';
import { calculateFantasyTeamScore } from '@/app/utils/scoring';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { useEvent } from '@/app/contexts/EventContext';

interface LeagueWithTopTeams {
  league: FantasyLeague;
  topTeams: FantasyTeam[];
}

// Number of top teams to show per league
const TOP_TEAMS_COUNT = 5;

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-16 flex justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>}>
      <LeaderboardPageInner />
    </Suspense>
  );
}

function LeaderboardPageInner() {
  const { user, loading: authLoading } = useAuth();
  const { activeEvent, allEvents } = useEvent();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Optional ?event=<id> param to view a past event's leaderboard
  const viewEventId = searchParams?.get('event') ?? null;
  const viewEvent: EventConfig | null = viewEventId
    ? (allEvents.find(e => e.id === viewEventId) ?? null)
    : (activeEvent ?? null);
  const isArchived = !!(viewEventId && activeEvent?.id && viewEventId !== activeEvent.id);
  const competitionStartTime = viewEvent?.competitionStartTime ?? FANTASY_CONFIG.competitionStartTime;
  
  const [leaguesWithTeams, setLeaguesWithTeams] = useState<LeagueWithTopTeams[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculatingScores, setCalculatingScores] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (authLoading) return;
    
    async function fetchLeaguesAndTeams() {
      try {
        setLoading(true);
        
        // Fetch all leagues, filtered to the event being viewed (active or archived)
        const allLeagues = await getAllLeagues();
        const leagues = viewEvent?.id
          ? allLeagues.filter(l => l.eventId === viewEvent.id)
          : allLeagues;

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

          // One team per user: keep only the best-scoring team per member
          const bestPerUser = new Map<string, FantasyTeam>();
          for (const team of teams) {
            const existing = bestPerUser.get(team.userId);
            const teamScore = team.totalScore ?? -Infinity;
            const existingScore = existing?.totalScore ?? -Infinity;
            if (!existing || teamScore > existingScore) {
              bestPerUser.set(team.userId, team);
            }
          }

          // Sort teams by score and take top 5
          const sortedTeams = Array.from(bestPerUser.values())
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
  }, [authLoading, viewEvent?.id]);

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

  // Past events = anything that isn't the active event
  const pastEvents = allEvents.filter(e => e.id && e.id !== activeEvent?.id);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-baseline gap-3 mb-6">
        <h1 className="text-3xl font-bold">Global Leaderboard</h1>
        {viewEvent && (
          <span className="text-lg text-gray-600">— {viewEvent.eventName}</span>
        )}
      </div>

      {/* Archived-event banner */}
      {isArchived && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded mb-6 flex justify-between items-center">
          <div>
            <p className="font-semibold">📜 Viewing archived event</p>
            <p className="text-sm">Showing final standings for <strong>{viewEvent?.eventName}</strong>.</p>
          </div>
          <Link href="/leaderboard" className="text-sm underline hover:no-underline">Back to current event</Link>
        </div>
      )}

      {/* Competition start time notice (only for the live event) */}
      {!isArchived && Date.now() < competitionStartTime && (
        <div className="bg-blue-100 border border-blue-400 text-blue-800 px-4 py-3 rounded mb-6">
          <p className="font-semibold">Competition Hasn't Started Yet</p>
          <p>Scores are hidden until the competition begins on {new Date(competitionStartTime).toLocaleDateString()} at {new Date(competitionStartTime).toLocaleTimeString()}</p>
          <p className="text-sm mt-1">Leaderboard will update once the competition begins.</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <p className="font-bold">Error</p>
          <p>{error}</p>
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
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10">
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
                                : team.totalScore === -1
                                  ? "Hidden until competition" 
                                  : (team.totalScore !== undefined 
                                    ? team.totalScore.toLocaleString() 
                                    : '--')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-900">{team.selectedTeams?.length || 0}</div>
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

      {/* ── Past Events ─────────────────────────────────────────────────── */}
      {pastEvents.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-4">Past Events</h2>
          <p className="text-gray-600 mb-4 text-sm">
            View archived leaderboards from previous competitions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pastEvents.map(ev => (
              <Link
                key={ev.id}
                href={`/leaderboard?event=${ev.id}`}
                className={`block bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${viewEventId === ev.id ? 'border-amber-400 ring-2 ring-amber-200' : 'border-gray-200'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-black">{ev.eventName}</h3>
                  {ev.isCompleted && (
                    <span className="text-[10px] uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Completed</span>
                  )}
                </div>
                {ev.eventDates && <p className="text-sm text-gray-500">{ev.eventDates}</p>}
                {ev.eventLocation && <p className="text-xs text-gray-400">{ev.eventLocation}</p>}
                <p className="mt-2 text-sm text-blue-600">View leaderboard →</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}