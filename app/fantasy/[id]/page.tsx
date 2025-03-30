'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getFantasyTeam } from '@/app/utils/firebase';
import { FantasyTeam } from '@/app/types/types';
import Link from 'next/link';

export default function FantasyTeamDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [fantasyTeam, setFantasyTeam] = useState<FantasyTeam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFantasyTeam() {
      try {
        const team = await getFantasyTeam(id);
        
        if (!team) {
          setError('Fantasy team not found');
          setLoading(false);
          return;
        }
        
        setFantasyTeam(team);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching fantasy team:', err);
        setError('Failed to load fantasy team');
        setLoading(false);
      }
    }
    
    fetchFantasyTeam();
  }, [id]);

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
        <h1 className="text-2xl font-bold">{fantasyTeam.name}</h1>
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
            <h2 className="text-xl font-semibold mb-4">Team Overview</h2>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500">Team Owner</div>
                <div className="font-medium">{fantasyTeam.userName || 'Unknown'}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Total Cost</div>
                <div className="font-medium">${fantasyTeam.totalCost}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Total Score</div>
                <div className="font-medium">
                  {fantasyTeam.totalScore !== undefined ? fantasyTeam.totalScore : 'Not yet calculated'}
                </div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Created</div>
                <div className="font-medium">
                  {new Date(fantasyTeam.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Team Members */}
        <div className="md:col-span-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Selected Teams</h2>
            
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
                      <td className="py-3 px-4 border-t">{team.teamName}</td>
                      <td className="py-3 px-4 border-t text-right">${team.cost}</td>
                      <td className="py-3 px-4 border-t text-right">
                        {/* This would be filled in once scoring is implemented */}
                        --
                      </td>
                    </tr>
                  ))}
                  
                  {/* Total row */}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={2} className="py-3 px-4 border-t text-right">
                      Total:
                    </td>
                    <td className="py-3 px-4 border-t text-right">
                      ${fantasyTeam.totalCost}
                    </td>
                    <td className="py-3 px-4 border-t text-right">
                      {fantasyTeam.totalScore !== undefined ? fantasyTeam.totalScore : '--'}
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