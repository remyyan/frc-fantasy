'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getLeague, getFantasyTeamsByUser, getUsersByIds, deleteLeague, FantasyLeague, FantasyTeam } from '@/app/utils/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/utils/firebase';

export default function LeagueDetailClient({ leagueId }: { leagueId: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [league, setLeague] = useState<FantasyLeague | null>(null);
  const [teams, setTeams] = useState<FantasyTeam[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Record<string, { displayName: string; email: string | null }>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login?redirect=/leagues/' + leagueId);
      return;
    }
    
    async function fetchLeagueData() {
      try {
        setLoading(true);
        
        // Fetch league data
        const leagueData = await getLeague(leagueId);
        
        if (!leagueData) {
          setError('League not found.');
          setLoading(false);
          return;
        }
        
        // Allow access to the league if the user is a member or if the league is public
        if (!user) {
          setError('You must be logged in to view this league.');
          setLoading(false);
          return;
        }
        
        if (!leagueData.members.includes(user.uid) && !leagueData.isPublic) {
          setError('You are not a member of this private league.');
          setLoading(false);
          return;
        }
        
        setLeague(leagueData);
        
        // Fetch member data
        if (leagueData.members.length > 0) {
          const membersData = await getUsersByIds(leagueData.members);
          setMembers(membersData);
        }
        
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
  }, [leagueId, user, authLoading, router]);

  const handleDeleteLeague = async () => {
    if (!user || !league) return;
    
    try {
      setDeleting(true);
      await deleteLeague(leagueId, user.uid);
      setSuccess('League successfully deleted');
      
      // Redirect to leagues page after a short delay
      setTimeout(() => {
        router.push('/leagues');
      }, 1500);
    } catch (err: any) {
      console.error('Error deleting league:', err);
      setError(err.message || 'Failed to delete league. Please try again.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user || !league) return;
    
    // Check if user is the owner
    if (league.createdBy !== user.uid) {
      setError('Only the league owner can remove members');
      return;
    }
    
    // Cannot remove yourself (the owner)
    if (memberId === user.uid) {
      setError('You cannot remove yourself from the league');
      return;
    }
    
    try {
      // Create a new members array without the member to remove
      const updatedMembers = league.members.filter(id => id !== memberId);
      
      // Update the league in Firestore
      const leagueRef = doc(db, 'leagues', leagueId);
      await updateDoc(leagueRef, {
        members: updatedMembers,
        updatedAt: Date.now()
      });
      
      // Update local state
      setLeague({
        ...league,
        members: updatedMembers
      });
      
      // Show success message
      setSuccess(`Member removed successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (err: any) {
      console.error('Error removing member:', err);
      setError(err.message || 'Failed to remove member. Please try again.');
    }
  };

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
  
  if (success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
        <div className="text-center">
          <p className="mb-4">Redirecting to leagues page...</p>
          <Link 
            href="/leagues"
            className="text-blue-500 hover:text-blue-700 font-medium"
          >
            Go to Leagues
          </Link>
        </div>
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

  const isOwner = user && league.createdBy === user.uid;

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
        <div className="flex justify-between items-start mb-2">
          <h1 className="text-2xl font-bold">{league.name}</h1>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded ${league.isPublic ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
              {league.isPublic ? 'Public' : 'Private'}
            </span>
            {isOwner && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleting}
                className="bg-red-500 hover:bg-red-600 text-white text-xs px-2 py-1 rounded"
              >
                Delete League
              </button>
            )}
          </div>
        </div>
        
        {league.description && (
          <p className="text-gray-600 mb-4">{league.description}</p>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
      
      {/* Members Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">League Members ({league.members.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                {isOwner && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {league.members.map((memberId) => (
                <tr key={memberId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {members[memberId]?.displayName || 'Unknown User'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {memberId === league.createdBy ? (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Owner</span>
                      ) : (
                        <span className="text-xs">Member</span>
                      )}
                    </div>
                  </td>
                  {isOwner && memberId !== user?.uid && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleRemoveMember(memberId)}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                  {isOwner && memberId === user?.uid && <td></td>}
                </tr>
              ))}
              
              {league.members.length === 0 && (
                <tr>
                  <td colSpan={isOwner ? 3 : 2} className="px-6 py-8 text-center text-gray-500">
                    No members in this league yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
                    <div className="text-sm text-gray-900">{team.userName || members[team.userId]?.displayName || 'Unknown'}</div>
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
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this league? This action cannot be undone.</p>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteLeague}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete League'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 