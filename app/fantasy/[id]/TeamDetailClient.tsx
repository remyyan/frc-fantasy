'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getFantasyTeam, getUserLeagues } from '@/app/utils/firebase';
import { FantasyTeam, FantasyLeague } from '@/app/types/types';
import { calculateFantasyTeamScore } from '@/app/utils/scoring';
import { FANTASY_CONFIG, TEAM_LOCK_BYPASS_EMAILS } from '@/app/utils/config';
import { useEvent } from '@/app/contexts/EventContext';

// Define a more specific type for the team member that includes the score
interface TeamMember {
  teamNumber: number;
  teamName: string;
  cost: number;
  score?: number;
  breakdown?: {
    rankingPoints?: number;
    winPoints?: number;
    statPoints?: number;
    awardPoints?: number;
    eliminationPoints?: number;
  };
}

// Extend the FantasyTeam type to include the more specific team member type
interface DetailedFantasyTeam extends Omit<FantasyTeam, 'selectedTeams'> {
  selectedTeams: TeamMember[];
  lastUpdated?: number;
}

export default function TeamDetailClient({ teamId }: { teamId: string }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { activeEvent, hasCompetitionStarted } = useEvent();
  
  const [fantasyTeam, setFantasyTeam] = useState<DetailedFantasyTeam | null>(null);
  const [userLeagues, setUserLeagues] = useState<FantasyLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [teamOwnerLeagues, setTeamOwnerLeagues] = useState<FantasyLeague[]>([]);
  
  // Check if user is admin or has special team lock bypass permissions
  const isAdmin = user && user.email === 'remyan.yc@gmail.com';
  const canBypassTeamLock = user?.email ? TEAM_LOCK_BYPASS_EMAILS.includes(user.email) : false;

  useEffect(() => {
    async function fetchData() {
      try {
        const team = await getFantasyTeam(teamId);
        
        if (!team) {
          setError('Fantasy team not found');
          setLoading(false);
          return;
        }
        
        // Cast to the more detailed type that includes scores
        setFantasyTeam(team as unknown as DetailedFantasyTeam);

        // Get the team owner's leagues
        const ownerLeagues = await getUserLeagues(team.userId);
        setTeamOwnerLeagues(ownerLeagues);

        // If we have a user, fetch their leagues for context
        if (user) {
          const leagues = await getUserLeagues(user.uid);
          setUserLeagues(leagues);
        }
        
        setLoading(false);
        
        // Only auto-calculate if competition has started
        if (hasCompetitionStarted) {
          const shouldCalculateScore =
            team.totalScore === undefined ||
            !team.lastUpdated ||
            Date.now() - team.lastUpdated > 3600000;

          if (shouldCalculateScore) {
            calculateScore(teamId);
          }
        }
      } catch (err) {
        console.error('Error fetching fantasy team:', err);
        setError('Failed to load fantasy team');
        setLoading(false);
      }
    }
    
    fetchData();
  }, [teamId, user]);

  // Function to calculate the team's score
  async function calculateScore(id: string) {
    try {
      setCalculatingScore(true);
      
      // Calculate the score
      await calculateFantasyTeamScore(id);
      
      // Refresh the team data to get the updated score
      const updatedTeam = await getFantasyTeam(id);
      if (updatedTeam) {
        setFantasyTeam(updatedTeam as unknown as DetailedFantasyTeam);
      }
      
      setCalculatingScore(false);
    } catch (err) {
      console.error('Error calculating score:', err);
      setCalculatingScore(false);
    }
  }

  // Check if the team belongs to specific leagues
  const getTeamLeagues = () => {
    // This would need to be implemented based on your data model
    // Currently there's no direct relationship between teams and leagues in the data
    return userLeagues.map(league => league.name).join(', ') || 'No leagues';
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link href="/fantasy/create" className="text-blue-500 hover:text-blue-700 underline">
          Create a new fantasy team
        </Link>
      </div>
    );
  }

  if (!fantasyTeam) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Fantasy Team Not Found</h1>
        <p className="mb-4">The fantasy team you're looking for doesn't exist or has been deleted.</p>
        <Link href="/fantasy/create" className="text-blue-500 hover:text-blue-700 underline">
          Create a new fantasy team
        </Link>
      </div>
    );
  }

  const isOwner = user && user.uid === fantasyTeam.userId;

  // Determine if the current user can view the team details
  const canViewTeamDetails = () => {
    // Admins can always view all team details
    if (isAdmin) return true;
    
    // Team owner can always view details
    if (isOwner) return true;
    
    // If user is not logged in, they cannot view details
    if (!user) return false;
    
    // Check if current user shares any leagues with the team owner
    // by looking for common league IDs
    const userLeagueIds = userLeagues.map(league => league.id);
    const ownerLeagueIds = teamOwnerLeagues.map(league => league.id);
    
    // If there's any overlap in the league IDs, the user can view details
    return userLeagueIds.some(leagueId => ownerLeagueIds.includes(leagueId));
  };

  const hasViewPermission = canViewTeamDetails();

  const canEditTeam = isOwner || isAdmin || canBypassTeamLock;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">{fantasyTeam.name}</h1>
        {canEditTeam && (
          <div className="flex space-x-2">
            <button
              onClick={() => router.push(`/fantasy/create?edit=${teamId}`)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Edit Team
            </button>
            {!isOwner && (isAdmin || canBypassTeamLock) && (
              <div className="ml-2 px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full flex items-center">
                {isAdmin ? 'Admin View' : 'Override Access'}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Fantasy Team Overview */}
        <div className="md:col-span-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Team Overview</h2>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Team Owner</div>
                <div className="font-medium text-black">{fantasyTeam.userName || 'Unknown'}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Leagues</div>
                <div className="font-medium text-black">{getTeamLeagues()}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Total Cost</div>
                <div className="font-medium text-black">${fantasyTeam.totalCost.toLocaleString()}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Total Score</div>
                <div className="font-medium text-black">
                  {!hasCompetitionStarted
                    ? "Competition hasn't started yet"
                    : calculatingScore
                      ? "Calculating score..."
                      : fantasyTeam.totalScore !== undefined
                        ? `${fantasyTeam.totalScore.toLocaleString()} points`
                        : 'Not yet calculated'}
                </div>
                {!hasCompetitionStarted && (
                  <div className="text-xs text-gray-500 mt-1">
                    Competition starts: {new Date(activeEvent?.competitionStartTime ?? FANTASY_CONFIG.competitionStartTime).toLocaleString()}
                  </div>
                )}
                {hasCompetitionStarted && fantasyTeam.lastUpdated && !calculatingScore && (
                  <div className="text-xs text-gray-500 mt-1">
                    Last updated: {new Date(fantasyTeam.lastUpdated).toLocaleString()}
                  </div>
                )}
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Created</div>
                <div className="font-medium text-black">
                  {new Date(fantasyTeam.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              {hasCompetitionStarted && fantasyTeam.totalScore === undefined && !calculatingScore && user && isOwner && (
                <div className="mt-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    Your team's score hasn't been calculated yet.
                  </p>
                  <button 
                    onClick={() => calculateScore(teamId)}
                    className="mt-2 text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                  >
                    Calculate Score Now
                  </button>
                </div>
              )}

              {userLeagues.length === 0 && user && isOwner && (
                <div className="mt-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    Your team isn't part of any leagues yet.
                  </p>
                  <Link 
                    href="/leagues" 
                    className="text-blue-600 hover:text-blue-800 text-sm mt-1 inline-block"
                  >
                    Join a league →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Team Members */}
        <div className="md:col-span-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Selected Teams</h2>
            
            {!hasViewPermission ? (
              <div className="bg-yellow-50 p-4 rounded border border-yellow-200 mb-4">
                <p className="text-yellow-700">
                  The selected teams are hidden. Only team owners and members of the same leagues can view this information.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 text-left">Team #</th>
                      <th className="py-2 px-4 text-left">Team Name</th>
                      <th className="py-2 px-4 text-right">Cost</th>
                      {hasCompetitionStarted && <th className="py-2 px-4 text-right">Score</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {fantasyTeam.selectedTeams.map((team) => (
                      <tr key={team.teamNumber} className="hover:bg-gray-50">
                        <td className="py-3 px-4 border-t">
                          <Link
                            href={`/teams/${team.teamNumber}`}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            {team.teamNumber}
                          </Link>
                        </td>
                        <td className="py-3 px-4 border-t text-black">{team.teamName}</td>
                        <td className="py-3 px-4 border-t text-right text-black">${team.cost.toLocaleString()}</td>
                        {hasCompetitionStarted && (
                          <td className="py-3 px-4 border-t text-right text-black">
                            {calculatingScore ? "Calculating..." : (team.score !== undefined ? team.score.toLocaleString() : '--')}
                          </td>
                        )}
                      </tr>
                    ))}

                    {/* Total row */}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={2} className="py-3 px-4 border-t text-right text-black">
                        Total:
                      </td>
                      <td className="py-3 px-4 border-t text-right text-black">
                        ${fantasyTeam.totalCost.toLocaleString()}
                      </td>
                      {hasCompetitionStarted && (
                        <td className="py-3 px-4 border-t text-right text-black">
                          {calculatingScore ? "Calculating..." : (fantasyTeam.totalScore !== undefined ? fantasyTeam.totalScore.toLocaleString() : '--')}
                        </td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            
            {/* Show total score even if teams are hidden, but only after competition starts */}
            {!hasViewPermission && hasCompetitionStarted && (
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-black">Total Score:</div>
                  <div className="font-semibold text-black">
                    {calculatingScore
                      ? "Calculating..."
                      : fantasyTeam.totalScore !== undefined
                        ? `${fantasyTeam.totalScore.toLocaleString()} points`
                        : 'Not yet calculated'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Back link */}
      <div className="mt-6">
        <Link href="/fantasy" className="text-blue-500 hover:text-blue-700">
          ← Back to all fantasy teams
        </Link>
      </div>
    </div>
  );
} 