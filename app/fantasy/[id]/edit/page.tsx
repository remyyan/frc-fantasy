'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { getFantasyTeam, updateFantasyTeam, deleteFantasyTeam } from '@/app/utils/firebase';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EditFantasyTeam({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [teamId] = useState(params.id);
  const [teamName, setTeamName] = useState('');
  const [originalTeam, setOriginalTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch the fantasy team data
  useEffect(() => {
    async function fetchFantasyTeam() {
      if (!user) return;
      
      try {
        setLoading(true);
        const teamData = await getFantasyTeam(teamId);
        
        if (!teamData) {
          setError('Fantasy team not found');
          setLoading(false);
          return;
        }
        
        // Check if the user is the owner of the team
        if (teamData.userId !== user.uid) {
          setError('You do not have permission to edit this team');
          setLoading(false);
          return;
        }
        
        setOriginalTeam(teamData);
        setTeamName(teamData.name);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching fantasy team:', err);
        setError('Failed to load fantasy team');
        setLoading(false);
      }
    }
    
    if (!authLoading) {
      fetchFantasyTeam();
    }
  }, [teamId, user, authLoading]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to edit a fantasy team');
      return;
    }
    
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Only updating the name for now
      await updateFantasyTeam(teamId, {
        name: teamName,
        updatedAt: Date.now()
      });
      
      setSuccess('Fantasy team updated successfully!');
      setTimeout(() => {
        router.push(`/fantasy/${teamId}`);
      }, 1500);
    } catch (err) {
      console.error('Error updating fantasy team:', err);
      setError('Failed to update fantasy team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle team deletion
  const handleDelete = async () => {
    if (!user) {
      setError('You must be logged in to delete a fantasy team');
      return;
    }
    
    try {
      setDeleting(true);
      setError(null);
      
      await deleteFantasyTeam(teamId, user.uid);
      
      // Redirect to fantasy teams list
      router.push('/fantasy');
    } catch (err) {
      console.error('Error deleting fantasy team:', err);
      setError('Failed to delete fantasy team. Please try again.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
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
        <h1 className="text-2xl font-bold mb-4">Edit Fantasy Team</h1>
        <p className="mb-4">Please log in to edit your fantasy team.</p>
        <button 
          onClick={() => router.push('/login')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (error && !originalTeam) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link href="/fantasy" className="text-blue-500 hover:underline">
          ← Back to Fantasy Teams
        </Link>
      </div>
    );
  }

  // Calculate the budget information
  const totalBudget = FANTASY_CONFIG.totalBudget;
  const budgetUsed = originalTeam?.totalCost || 0;
  const budgetRemaining = totalBudget - budgetUsed;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-black">Edit Fantasy Team</h1>
        <p className="text-gray-600 mb-4">
          {FANTASY_CONFIG.eventName} • {FANTASY_CONFIG.eventDates}
        </p>
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
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Fantasy Team Details</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="team-name">
                  Team Name
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter team name"
                  required
                />
              </div>
              
              {originalTeam && originalTeam.selectedTeams && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2 text-black">Selected Teams</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    You cannot modify your selected teams after creation.
                  </p>
                  <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                          <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {originalTeam.selectedTeams.map((team: any) => (
                          <tr key={team.teamNumber} className="hover:bg-gray-50">
                            <td className="py-2 px-4 whitespace-nowrap font-medium text-black">{team.teamNumber}</td>
                            <td className="py-2 px-4 whitespace-nowrap text-gray-600">{team.teamName}</td>
                            <td className="py-2 px-4 whitespace-nowrap text-right font-medium text-blue-600">${team.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center mt-6">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                  Delete Team
                </button>
                
                <div className="flex space-x-4">
                  <Link
                    href={`/fantasy/${teamId}`}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className={`px-4 py-2 text-white rounded ${
                      saving || deleting
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
        
        {/* Sidebar */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Team Summary</h2>
            
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-1">Budget</div>
              <div className="flex items-center">
                <div className="flex-grow bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${(budgetUsed / totalBudget) * 100}%` }}
                  ></div>
                </div>
                <div className="ml-2 text-sm font-medium text-gray-700">
                  ${budgetUsed} / ${totalBudget}
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-gray-500">Remaining Budget</div>
              <div className="text-2xl font-bold text-black">${budgetRemaining}</div>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-gray-500">Teams Selected</div>
              <div className="text-2xl font-bold text-black">{originalTeam?.selectedTeams?.length || 0}</div>
            </div>
            
            {originalTeam?.totalScore !== undefined && (
              <div className="mb-4">
                <div className="text-sm text-gray-500">Current Score</div>
                <div className="text-2xl font-bold text-black">{originalTeam.totalScore}</div>
              </div>
            )}
            
            <div className="mb-4">
              <div className="text-sm text-gray-500">Created</div>
              <div className="text-sm text-black">
                {originalTeam?.createdAt ? new Date(originalTeam.createdAt).toLocaleDateString() : '-'}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-black">Delete Fantasy Team</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this fantasy team? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`px-4 py-2 text-white rounded ${
                  deleting
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deleting ? 'Deleting...' : 'Delete Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 