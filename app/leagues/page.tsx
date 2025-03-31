'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/contexts/AuthContext';
import { getUserLeagues, getLeagueByJoinCode, joinLeague, createLeague } from '@/app/utils/firebase';
import type { FantasyLeague } from '@/app/utils/firebase';

export default function LeaguesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leagues, setLeagues] = useState<FantasyLeague[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueDescription, setNewLeagueDescription] = useState('');
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
        const userLeagues = await getUserLeagues(user.uid);
        setLeagues(userLeagues);
      } catch (err) {
        console.error('Error fetching leagues:', err);
        setError('Failed to load leagues. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchLeagues();
  }, [user, authLoading, router]);

  const handleJoinLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!joinCode.trim()) {
      setError('Please enter a join code');
      return;
    }
    
    try {
      setLoading(true);
      const league = await getLeagueByJoinCode(joinCode.trim());
      
      if (!league) {
        setError('Invalid join code. League not found.');
        return;
      }
      
      if (league.members.includes(user.uid)) {
        setError('You are already a member of this league.');
        return;
      }
      
      await joinLeague(league.id as string, user.uid);
      
      // Refresh leagues after joining
      const updatedLeagues = await getUserLeagues(user.uid);
      setLeagues(updatedLeagues);
      setJoinCode('');
      setError(null);
    } catch (err) {
      console.error('Error joining league:', err);
      setError('Failed to join league. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLeague = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!newLeagueName.trim()) {
      setError('Please enter a league name');
      return;
    }
    
    try {
      setLoading(true);
      
      await createLeague({
        name: newLeagueName.trim(),
        description: newLeagueDescription.trim() || undefined,
        createdBy: user.uid,
        members: [user.uid],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      // Refresh leagues after creating
      const updatedLeagues = await getUserLeagues(user.uid);
      setLeagues(updatedLeagues);
      
      // Reset form
      setNewLeagueName('');
      setNewLeagueDescription('');
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
      
      {/* Join a League */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Join a League</h2>
        <form onSubmit={handleJoinLeague} className="flex items-end gap-4">
          <div className="flex-1">
            <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700 mb-1">
              Enter Join Code
            </label>
            <input
              type="text"
              id="joinCode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter 6-character code"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Joining...' : 'Join League'}
          </button>
        </form>
      </div>
      
      {/* Your Leagues */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Your Leagues</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : leagues.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league) => (
              <div key={league.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold mb-2">{league.name}</h3>
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
            <p className="text-gray-500">Create a new league or join an existing one using a join code.</p>
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
              
              <div className="mb-6">
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
    </div>
  );
} 