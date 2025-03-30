'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../contexts/AuthContext';
import { getFantasyTeamsByUser, updateProfile } from '../utils/firebase';
import { FantasyTeam, User } from '../types/types';

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [userFantasyTeams, setUserFantasyTeams] = useState<FantasyTeam[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login if not authenticated
      router.push('/login');
      return;
    }

    if (user) {
      // Initialize form with current user data
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
      
      // Load user's fantasy teams
      const loadFantasyTeams = async () => {
        try {
          setLoadingTeams(true);
          const teams = await getFantasyTeamsByUser(user.uid);
          setUserFantasyTeams(teams);
        } catch (error) {
          console.error('Error loading fantasy teams:', error);
        } finally {
          setLoadingTeams(false);
        }
      };
      
      loadFantasyTeams();
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);
      
      await updateProfile(user, {
        displayName,
        photoURL,
      });
      
      setSuccess('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please try again later.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Profile</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
            
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 p-3 rounded mb-4">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 p-3 rounded mb-4">
                {success}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={user.email || ''}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  disabled
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your email cannot be changed
                </p>
              </div>
              
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  placeholder="Enter your display name"
                />
              </div>
              
              <div>
                <label htmlFor="photoURL" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Profile Picture URL
                </label>
                <input
                  type="text"
                  id="photoURL"
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700"
                  placeholder="Enter URL to your profile picture"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter a valid image URL
                </p>
              </div>
              
              <div className="pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
          
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-medium mb-2">Change Password</h3>
                <button
                  onClick={() => router.push('/change-password')}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
                >
                  Change Password
                </button>
              </div>
              
              <div className="pt-2">
                <h3 className="text-md font-medium mb-2 text-red-600 dark:text-red-400">Danger Zone</h3>
                <button
                  onClick={() => window.confirm('Are you sure you want to delete your account? This action cannot be undone.') && alert('Account deletion functionality would go here.')}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/30 rounded-md transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Your Fantasy Teams</h2>
            
            {loadingTeams ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : userFantasyTeams.length > 0 ? (
              <div className="space-y-4">
                {userFantasyTeams.map((team) => (
                  <div key={team.id} className="border dark:border-gray-700 rounded-md p-3">
                    <h3 className="font-medium">{team.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Teams: {team.selectedTeams.length}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Score: {team.totalScore || 0}
                    </p>
                    <button
                      onClick={() => router.push(`/fantasy/team/${team.id}`)}
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View Team
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  You haven't created any fantasy teams yet
                </p>
                <button
                  onClick={() => router.push('/fantasy/create')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                >
                  Create a Team
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 