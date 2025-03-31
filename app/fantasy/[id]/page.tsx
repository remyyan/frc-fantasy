'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getFantasyTeam, getUserLeagues } from '@/app/utils/firebase';
import { FantasyTeam, FantasyLeague } from '@/app/types/types';
import Link from 'next/link';
import React from 'react';

// Define a more specific type for the team member that includes the score
interface TeamMember {
  teamNumber: number;
  teamName: string;
  cost: number;
  score?: number;
  breakdown?: {
    rankingPoints?: number;
    winPoints?: number;
    oprPoints?: number;
    awardPoints?: number;
    eliminationPoints?: number;
  };
}

// Extend the FantasyTeam type to include the more specific team member type
interface DetailedFantasyTeam extends Omit<FantasyTeam, 'selectedTeams'> {
  selectedTeams: TeamMember[];
}

// Helper function to safely use params with React.use()
function useParams<T extends { [key: string]: any }>(params: T): T {
  try {
    // Use React.use to unwrap the params if it's a Promise
    const unwrappedParams = React.use(params as any) as T;
    return unwrappedParams;
  } catch (e) {
    // If React.use() is not supported or fails, return the params as-is
    console.warn("React.use() failed, falling back to direct params access", e);
    return params;
  }
}

export default function FantasyTeamDetail({ params }: { params: { id: string } }) {
  // Get the id from params, safely handling the Promise if present
  const safeParams = useParams(params);
  const id = safeParams.id;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [fantasyTeam, setFantasyTeam] = useState<DetailedFantasyTeam | null>(null);
  const [userLeagues, setUserLeagues] = useState<FantasyLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const team = await getFantasyTeam(id);
        
        if (!team) {
          setError('Fantasy team not found');
          setLoading(false);
          return;
        }
        
        // Cast to the more detailed type that includes scores
        setFantasyTeam(team as unknown as DetailedFantasyTeam);

        // If we have a user, fetch their leagues for context
        if (user) {
          const leagues = await getUserLeagues(user.uid);
          setUserLeagues(leagues);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching fantasy team:', err);
        setError('Failed to load fantasy team');
        setLoading(false);
      }
    }
    
    fetchData();
  }, [id, user]);

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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-black">{fantasyTeam.name}</h1>
        {isOwner && (
          <div className="flex space-x-2">
            <button
              onClick={() => router.push(`/fantasy/${id}/edit`)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Edit Team
            </button>
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
                  {fantasyTeam.totalScore !== undefined 
                    ? `${fantasyTeam.totalScore.toLocaleString()} points` 
                    : 'Not yet calculated'}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Created</div>
                <div className="font-medium text-black">
                  {new Date(fantasyTeam.createdAt).toLocaleDateString()}
                </div>
              </div>
              
              {fantasyTeam.totalScore === undefined && user && isOwner && (
                <div className="mt-4 bg-yellow-50 p-3 rounded border border-yellow-200">
                  <p className="text-sm text-yellow-700">
                    Your team's score hasn't been calculated yet.
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Scores are updated after events by administrators.
                  </p>
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
            
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="py-2 px-4 text-left">Team #</th>
                    <th className="py-2 px-4 text-left">Team Name</th>
                    <th className="py-2 px-4 text-right">Cost</th>
                    <th className="py-2 px-4 text-right">Score</th>
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
                      <td className="py-3 px-4 border-t text-right text-black">
                        {team.score !== undefined 
                          ? team.score.toLocaleString()
                          : '--'}
                      </td>
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
                    <td className="py-3 px-4 border-t text-right text-black">
                      {fantasyTeam.totalScore !== undefined 
                        ? fantasyTeam.totalScore.toLocaleString() 
                        : '--'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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