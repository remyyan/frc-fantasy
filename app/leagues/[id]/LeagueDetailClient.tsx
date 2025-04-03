'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getLeague, getFantasyTeamsByUser, getUsersByIds, deleteLeague, FantasyLeague, FantasyTeam, getFantasyTeam } from '@/app/utils/firebase';
import { getLeagueInviteUrl } from '@/app/utils/firebase';
import { calculateFantasyTeamScore } from '@/app/utils/scoring';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/utils/firebase';
import Image from 'next/image';

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
  const [copyingLink, setCopyingLink] = useState(false);
  const [calculatingScores, setCalculatingScores] = useState<Record<string, boolean>>({});
  
  // New state variables for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedIsPublic, setEditedIsPublic] = useState(false);
  const [editedPassword, setEditedPassword] = useState('');
  const [saving, setSaving] = useState(false);
  
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
        
        // Initialize edit form with current values
        setEditedName(leagueData.name);
        setEditedDescription(leagueData.description || '');
        setEditedIsPublic(leagueData.isPublic);
        setEditedPassword(leagueData.password || '');
        
        // Fetch member data - load all members at once instead of in batches
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
        
        // Auto-calculate scores for teams that need it
        const teamsNeedingScores = sortedTeams.filter(team => 
          team.totalScore === undefined || 
          !team.lastUpdated ||
          Date.now() - team.lastUpdated > 3600000 // 60 minutes
        );
        
        if (teamsNeedingScores.length > 0) {
          calculateTeamScores(teamsNeedingScores);
        }
      } catch (err) {
        console.error('Error fetching league data:', err);
        setError('Failed to load league data. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchLeagueData();
  }, [leagueId, user, authLoading, router]);
  
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
          
          if (updatedTeam) {
            // Update the teams array with the new data
            setTeams(prevTeams => {
              const newTeams = prevTeams.map(t => 
                t.id === team.id ? updatedTeam : t
              ) as FantasyTeam[];
              
              // Sort by total score
              return newTeams.sort((a, b) => {
                const scoreA = a.totalScore !== undefined ? a.totalScore : -1;
                const scoreB = b.totalScore !== undefined ? b.totalScore : -1;
                return scoreB - scoreA;
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

  // Copy invite link to clipboard
  const copyInviteLinkToClipboard = async () => {
    if (!league) return;
    
    try {
      setCopyingLink(true);
      const inviteUrl = getLeagueInviteUrl(league);
      
      if (!inviteUrl.includes('/join/')) {
        // Update league with invite code if needed
        await fetch('/api/admin/update-league-codes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        // Show a message to refresh the page
        setError('Please refresh the page to get a sharing link');
        setCopyingLink(false);
        return;
      }
      
      await navigator.clipboard.writeText(inviteUrl);
      setCopyingLink(false);
      setSuccess('Invite link copied to clipboard');
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy invite link:', err);
      setError('Failed to copy invite link. Please try again.');
      setCopyingLink(false);
    }
  };

  // New function to handle league updates
  const handleUpdateLeague = async () => {
    if (!user || !league) return;
    
    // Check if user is the owner
    if (league.createdBy !== user.uid) {
      setError('Only the league owner can edit league details');
      return;
    }
    
    try {
      setSaving(true);
      
      // Prepare update data
      const updateData: any = {
        name: editedName,
        description: editedDescription,
        isPublic: editedIsPublic,
        updatedAt: Date.now()
      };
      
      // Only include password if the league is private and a password is provided
      if (!editedIsPublic && editedPassword) {
        updateData.password = editedPassword;
      }
      
      // Update the league in Firestore
      const leagueRef = doc(db, 'leagues', leagueId);
      await updateDoc(leagueRef, updateData);
      
      // Update local state
      setLeague({
        ...league,
        name: editedName,
        description: editedDescription,
        isPublic: editedIsPublic,
        password: !editedIsPublic ? editedPassword : undefined
      });
      
      // Exit edit mode
      setIsEditing(false);
      
      // Show success message
      setSuccess('League details updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (err: any) {
      console.error('Error updating league:', err);
      setError(err.message || 'Failed to update league. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Function to start editing
  const startEditing = () => {
    if (!league) return;
    
    setEditedName(league.name);
    setEditedDescription(league.description || '');
    setEditedIsPublic(league.isPublic);
    setEditedPassword(league.password || '');
    setIsEditing(true);
  };
  
  // Function to cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
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
    // Only redirect if the league was deleted
    if (success.includes('deleted')) {
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
      <div className="mb-4">
        <Link 
          href="/leagues"
          className="text-blue-500 hover:text-blue-700 font-medium"
        >
          ← Back to Leagues
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {league && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-8">
          <div className="bg-blue-600 text-white p-6">
            <div className="flex justify-between items-start">
              <div className="w-full">
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="leagueName" className="block text-sm font-medium text-blue-100 mb-1">
                        League Name
                      </label>
                      <input
                        type="text"
                        id="leagueName"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter league name"
                      />
                    </div>
                    <div>
                      <label htmlFor="leagueDescription" className="block text-sm font-medium text-blue-100 mb-1">
                        Description
                      </label>
                      <textarea
                        id="leagueDescription"
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-white text-gray-900 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter league description"
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isPublic"
                        checked={editedIsPublic}
                        onChange={(e) => setEditedIsPublic(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="isPublic" className="ml-2 block text-sm text-blue-100">
                        Public League (anyone can view)
                      </label>
                    </div>
                    {!editedIsPublic && (
                      <div>
                        <label htmlFor="leaguePassword" className="block text-sm font-medium text-blue-100 mb-1">
                          League Password
                        </label>
                        <input
                          type="password"
                          id="leaguePassword"
                          value={editedPassword}
                          onChange={(e) => setEditedPassword(e.target.value)}
                          className="w-full px-3 py-2 bg-white text-gray-900 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter password for private league"
                        />
                        <p className="mt-1 text-xs text-blue-200">
                          This password will be required for users to join this private league.
                        </p>
                      </div>
                    )}
                    <div className="flex space-x-3 pt-2">
                      <button
                        onClick={handleUpdateLeague}
                        disabled={saving}
                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button
                        onClick={cancelEditing}
                        disabled={saving}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-3xl font-bold">{league.name}</h1>
                    {league.description && (
                      <p className="mt-2 text-blue-100">{league.description}</p>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  league.isPublic ? 'bg-green-500' : 'bg-blue-800'
                }`}>
                  {league.isPublic ? 'Public' : 'Private'}
                </span>
                {isOwner && !isEditing && (
                  <button 
                    onClick={startEditing}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium"
                  >
                    Edit League
                  </button>
                )}
                {isOwner && !isEditing && (
                  <button 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full text-sm font-medium"
                  >
                    Delete League
                  </button>
                )}
              </div>
            </div>
          </div>
          
          {/* Invite Link Section */}
          {user && league.members.includes(user.uid) && (
            <div className="bg-gray-50 p-4 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between">
                <div className="mb-2 sm:mb-0">
                  <h3 className="text-sm font-medium text-gray-500">Share League</h3>
                  <p className="text-sm text-gray-700">Share this invite link to let others join your league directly</p>
                </div>
                <button
                  onClick={copyInviteLinkToClipboard}
                  disabled={copyingLink}
                  className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded-md text-sm font-medium flex items-center disabled:opacity-50"
                >
                  {copyingLink ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Copying...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      Copy Invite Link
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* League Information */}
          <div className="p-6">
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
        </div>
      )}
      
      {/* Members Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">League Members ({league?.members.length})</h2>
        
        {league?.members && league.members.length > 0 ? (
          <div className="rounded-lg border">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 rounded-lg">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Member
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Role
                    </th>
                    {isOwner && (
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {league.members.map((userId) => {
                    const member = members[userId];
                    if (!member) return null;
                    return (
                      <tr key={userId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <div className="flex items-center">
                            <span>{member.displayName || member.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {userId === league.createdBy ? "Owner" : "Member"}
                        </td>
                        {isOwner && (
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {userId !== league.createdBy && (
                              <button
                                className="text-red-600 hover:text-red-900"
                                onClick={() => handleRemoveMember(userId)}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 my-4">No members in this league.</p>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="text-xl font-semibold">League Standings</h2>
        </div>
        
        <div className="overflow-x-auto">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0 z-10">
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
                        {team.id && calculatingScores[team.id] 
                          ? "Calculating..." 
                          : team.totalScore === -1
                            ? <span className="text-gray-500 italic">Hidden until competition</span> 
                            : (team.totalScore !== undefined 
                              ? team.totalScore.toLocaleString() 
                              : '--')}
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