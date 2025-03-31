'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getUserLeagues, joinLeague, createLeague, getPublicLeagues, getPrivateLeagues, verifyLeaguePassword } from '@/app/utils/firebase';
import type { FantasyLeague } from '@/app/utils/firebase';

export default function LeaguesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [userLeagues, setUserLeagues] = useState<FantasyLeague[]>([]);
  const [publicLeagues, setPublicLeagues] = useState<FantasyLeague[]>([]);
  const [privateLeagues, setPrivateLeagues] = useState<FantasyLeague[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
  const [leaguePassword, setLeaguePassword] = useState('');
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueDescription, setNewLeagueDescription] = useState('');
  const [isPublicLeague, setIsPublicLeague] = useState(true);
  const [newLeaguePassword, setNewLeaguePassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login?redirect=/leagues');
      return;
    }
    
    async function fetchLeagues() {
      try {
        setLoading(true);
        if (!user) {
          setError('User not authenticated');
          setLoading(false);
          return;
        }
        
        // Fetch user's leagues
        const leagues = await getUserLeagues(user.uid);
        setUserLeagues(leagues);
        
        // Get all league IDs the user is already in
        const userLeagueIds = leagues.map(league => league.id);
        
        // Fetch public leagues the user is not in
        const allPublicLeagues = await getPublicLeagues();
        const filteredPublicLeagues = allPublicLeagues.filter(
          league => !userLeagueIds.includes(league.id)
        );
        setPublicLeagues(filteredPublicLeagues);
        
        // Fetch private leagues the user is not in
        const allPrivateLeagues = await getPrivateLeagues();
        const filteredPrivateLeagues = allPrivateLeagues.filter(
          league => !userLeagueIds.includes(league.id)
        );
        setPrivateLeagues(filteredPrivateLeagues);
      } catch (err) {
        console.error('Error fetching leagues:', err);
        setError('Failed to load leagues. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchLeagues();
  }, [user, authLoading, router]);

  const handleJoinPublicLeague = async (leagueId: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      await joinLeague(leagueId, user.uid);
      
      // Refresh leagues after joining
      const updatedLeagues = await getUserLeagues(user.uid);
      setUserLeagues(updatedLeagues);
      
      // Update public and private leagues lists
      await refreshLeagueLists(updatedLeagues);
      
      setError(null);
    } catch (err) {
      console.error('Error joining league:', err);
      setError('Failed to join league. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPrivateLeague = async (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    setLeaguePassword('');
    setShowPasswordModal(true);
  };

  const handleSubmitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedLeagueId) return;
    
    try {
      setLoading(true);
      const isPasswordCorrect = await verifyLeaguePassword(selectedLeagueId, leaguePassword);
      
      if (!isPasswordCorrect) {
        setError('Incorrect password. Please try again.');
        setLoading(false);
        return;
      }
      
      await joinLeague(selectedLeagueId, user.uid);
      
      // Refresh leagues after joining
      const updatedLeagues = await getUserLeagues(user.uid);
      setUserLeagues(updatedLeagues);
      
      // Update public and private leagues lists
      await refreshLeagueLists(updatedLeagues);
      
      setShowPasswordModal(false);
      setSelectedLeagueId(null);
      setLeaguePassword('');
      setError(null);
    } catch (err) {
      console.error('Error joining private league:', err);
      setError('Failed to join league. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to refresh league lists
  const refreshLeagueLists = async (userLeagues: FantasyLeague[]) => {
    const userLeagueIds = userLeagues.map(league => league.id);
    
    // Update public leagues list
    const allPublicLeagues = await getPublicLeagues();
    const filteredPublicLeagues = allPublicLeagues.filter(
      league => !userLeagueIds.includes(league.id)
    );
    setPublicLeagues(filteredPublicLeagues);
    
    // Update private leagues list
    const allPrivateLeagues = await getPrivateLeagues();
    const filteredPrivateLeagues = allPrivateLeagues.filter(
      league => !userLeagueIds.includes(league.id)
    );
    setPrivateLeagues(filteredPrivateLeagues);
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!newLeagueName.trim()) {
      setError('Please enter a league name');
      return;
    }
    
    // Password is required for private leagues
    if (!isPublicLeague && !newLeaguePassword.trim()) {
      setError('Please enter a password for your private league');
      return;
    }
    
    try {
      setLoading(true);
      
      // Create league data object with proper handling of optional fields
      const leagueData: FantasyLeague = {
        name: newLeagueName.trim(),
        createdBy: user.uid,
        members: [user.uid],
        isPublic: isPublicLeague,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Only add description if it's not empty
      if (newLeagueDescription.trim()) {
        leagueData.description = newLeagueDescription.trim();
      }
      
      // Only add password for private leagues if password is set
      if (!isPublicLeague && newLeaguePassword.trim()) {
        leagueData.password = newLeaguePassword.trim();
      }
      
      await createLeague(leagueData);
      
      // Refresh leagues after creating
      const updatedLeagues = await getUserLeagues(user.uid);
      setUserLeagues(updatedLeagues);
      
      // Update public and private leagues lists
      await refreshLeagueLists(updatedLeagues);
      
      // Reset form
      setNewLeagueName('');
      setNewLeagueDescription('');
      setIsPublicLeague(true);
      setNewLeaguePassword('');
      setShowCreateModal(false);
      setError(null);
    } catch (err) {
      console.error('Error creating league:', err);
      setError('Failed to create league. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Fantasy Leagues</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create New League
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {/* Your Leagues */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Your Leagues</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : userLeagues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userLeagues.map((league) => (
              <div key={league.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold">{league.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${league.isPublic ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                    {league.isPublic ? 'Public' : 'Private'}
                  </span>
                </div>
                {league.description && (
                  <p className="text-gray-600 text-sm mb-3">{league.description}</p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <div>Members: {league.members.length}</div>
                  <div>Created: {new Date(league.createdAt).toLocaleDateString()}</div>
                </div>
                <Link 
                  href={`/leagues/${league.id}`}
                  className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                >
                  View League
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">You haven't joined any leagues yet.</p>
            <p className="text-gray-500">Create a new league or join an existing one.</p>
          </div>
        )}
      </div>
      
      {/* Public Leagues */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Public Leagues</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : publicLeagues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicLeagues.map((league) => (
              <div key={league.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold">{league.name}</h3>
                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">
                    Public
                  </span>
                </div>
                {league.description && (
                  <p className="text-gray-600 text-sm mb-3">{league.description}</p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <div>Members: {league.members.length}</div>
                  <div>Created: {new Date(league.createdAt).toLocaleDateString()}</div>
                </div>
                <button 
                  onClick={() => handleJoinPublicLeague(league.id as string)}
                  disabled={loading}
                  className="block w-full text-center bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                >
                  {loading ? 'Joining...' : 'Join League'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No public leagues available.</p>
          </div>
        )}
      </div>
      
      {/* Private Leagues */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Private Leagues</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : privateLeagues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {privateLeagues.map((league) => (
              <div key={league.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold">{league.name}</h3>
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                    Private
                  </span>
                </div>
                {league.description && (
                  <p className="text-gray-600 text-sm mb-3">{league.description}</p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <div>Members: {league.members.length}</div>
                  <div>Created: {new Date(league.createdAt).toLocaleDateString()}</div>
                </div>
                <button 
                  onClick={() => handleJoinPrivateLeague(league.id as string)}
                  disabled={loading}
                  className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                >
                  {loading ? 'Joining...' : 'Enter Password'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No private leagues available.</p>
          </div>
        )}
      </div>
      
      {/* Create League Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create New League</h2>
            
            <form onSubmit={handleCreateLeague}>
              <div className="mb-4">
                <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-1">
                  League Name
                </label>
                <input
                  type="text"
                  id="leagueName"
                  value={newLeagueName}
                  onChange={(e) => setNewLeagueName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter league name"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="leagueDescription" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  id="leagueDescription"
                  value={newLeagueDescription}
                  onChange={(e) => setNewLeagueDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter league description"
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Privacy Settings
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="privacy" 
                      checked={isPublicLeague} 
                      onChange={() => setIsPublicLeague(true)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">Public (Anyone can join)</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="privacy" 
                      checked={!isPublicLeague} 
                      onChange={() => setIsPublicLeague(false)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm">Private (Password protected)</span>
                  </label>
                </div>
              </div>
              
              {!isPublicLeague && (
                <div className="mb-4">
                  <label htmlFor="leaguePassword" className="block text-sm font-medium text-gray-700 mb-1">
                    League Password
                  </label>
                  <input
                    type="password"
                    id="leaguePassword"
                    value={newLeaguePassword}
                    onChange={(e) => setNewLeaguePassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter password for your league"
                    required={!isPublicLeague}
                  />
                </div>
              )}
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create League'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Enter League Password</h2>
            
            <form onSubmit={handleSubmitPassword}>
              <div className="mb-6">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={leaguePassword}
                  onChange={(e) => setLeaguePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter league password"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join League'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 