'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getLeague, getFantasyTeamsByUser, FantasyLeague, FantasyTeam } from '@/app/utils/firebase';
import React from 'react';

export default function LeagueDetailPage({ params }: { params: { id: string } }) {
  const unwrappedParams = React.use(params);
  const { id } = unwrappedParams;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login?redirect=/leagues/' + id);
      return;
    }
    
    async function fetchLeagueData() {
      try {
        setLoading(true);
        
        // Fetch league data
        const leagueData = await getLeague(id);
        
        if (!leagueData) {
          setError('League not found.');
          setLoading(false);
          return;
        }
        
        if (!leagueData.members.includes(user.uid)) {
          setError('You are not a member of this league.');
          setLoading(false);
          return;
        }
        
        setLeague(leagueData);
        
        // Fetch fantasy teams of all members
        const memberTeamsPromises = leagueData.members.map(memberId => 
          getFantasyTeamsByUser(memberId)
        );
        
        const memberTeamsResults = await Promise.all(memberTeamsPromises);
        const allTeams = memberTeamsResults.flat();
        
        // Sort by total score (if available)
        const sortedTeams = allTeams.sort((a, b) => {
          if (a.totalScore !== undefined && b.totalScore !== undefined) {
            return b.totalScore - a.totalScore;
          }
          return 0;
        });
        
        setTeams(sortedTeams);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching league data:', err);
        setError('Failed to load league data. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchLeagueData();
  }, [id, user, authLoading, router]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link 
          href="/leagues"
          className="text-blue-500 hover:text-blue-700 font-medium"
        >
          ← Back to Leagues
        </Link>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          League not found.
        </div>
        <Link 
          href="/leagues"
          className="text-blue-500 hover:text-blue-700 font-medium"
        >
          ← Back to Leagues
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link 
        href="/leagues"
        className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center mb-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Leagues
      </Link>
      
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h1 className="text-2xl font-bold mb-2">{league.name}</h1>
        {league.description && (
          <p className="text-gray-600 mb-4">{league.description}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500 mb-1">League Code</div>
            <div className="font-medium">{league.joinCode}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500 mb-1">Members</div>
            <div className="font-medium">{league.members.length}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500 mb-1">Created</div>
            <div className="font-medium">{new Date(league.createdAt).toLocaleDateString()}</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="text-xl font-semibold">League Standings</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fantasy Teams</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.map((team, index) => (
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{team.selectedTeams.length}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {team.totalScore !== undefined ? team.totalScore : '--'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link 
                      href={`/fantasy/${team.id}`}
                      className="text-blue-500 hover:text-blue-700 text-sm font-medium"
                    >
                      View Team
                    </Link>
                  </td>
                </tr>
              ))}
              
              {teams.length === 0 && (
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
    </div>
  );
} 