"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { getAllFantasyTeams, FantasyTeam } from '../utils/firebase';
import { TEAM_LOCK_BYPASS_EMAILS } from '../utils/config';

const AdminPage = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fantasyTeams, setFantasyTeams] = useState<FantasyTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const { user } = useAuth();

  const handleUpdateEPACache = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      setMessage('');
      
      // Call the admin API endpoint
      const response = await fetch('/api/admin/update-epa', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update EPA cache');
      }
      
      setMessage(`Successfully updated EPA cache for ${data.teamsUpdated} teams`);
    } catch (err) {
      console.error('Error updating EPA cache:', err);
      setError(err instanceof Error ? err.message : 'Failed to update EPA cache');
    } finally {
      setLoading(false);
    }
  };

  const handleCacheDivisionTeams = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      setMessage('');
      
      // Call the admin API endpoint to cache division teams
      const response = await fetch('/api/admin/cache-divisions', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to cache division teams');
      }
      
      setMessage(`Successfully cached ${data.teamsUpdated} teams across ${data.divisionsUpdated} divisions`);
    } catch (err) {
      console.error('Error caching division teams:', err);
      setError(err instanceof Error ? err.message : 'Failed to cache division teams');
    } finally {
      setLoading(false);
    }
  };

  // Check if user is a valid admin
  const isAdmin = user && user.email === 'remyan.yc@gmail.com';

  useEffect(() => {
    if (!user || !isAdmin) {
      setFantasyTeams([]);
      return;
    }

    setTeamsLoading(true);
    getAllFantasyTeams()
      .then((teams) => setFantasyTeams(teams))
      .catch((err) => {
        console.error('Error loading fantasy teams:', err);
        setError('Failed to load fantasy teams');
      })
      .finally(() => setTeamsLoading(false));
  }, [user, isAdmin]);
  
  // If not authenticated or not an admin, show access denied
  if (!user || !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Access denied. This page is for administrators only.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>
      
      {/* EPA Cache Update Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">EPA Cache Management</h2>
        <p className="text-gray-600 mb-4">
          Update the EPA cache with the latest data from Statbotics.
        </p>
        <button
          onClick={handleUpdateEPACache}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-white ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Updating...' : 'Update EPA Cache'}
        </button>
        
        {message && (
          <p className="mt-2 text-green-600">{message}</p>
        )}
        {error && (
          <p className="mt-2 text-red-600">{error}</p>
        )}
      </div>
      
      {/* Division Teams Cache Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Division Teams Cache</h2>
        <p className="text-gray-600 mb-4">
          Pre-cache all teams by division for faster fantasy team creation.
        </p>
        <button
          onClick={handleCacheDivisionTeams}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-white ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Caching...' : 'Cache Division Teams'}
        </button>
      </div>
      
      {/* Fantasy Teams Management Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Fantasy Teams Management</h2>
        <p className="text-gray-600 mb-4">
          As an administrator, you can create and manage multiple fantasy teams.
        </p>
        <div className="flex space-x-4">
          <a
            href="/fantasy/create"
            className="px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            Create New Fantasy Team
          </a>
          <a
            href="/fantasy"
            className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            View My Fantasy Teams
          </a>
          <a
            href="/admin/scoring"
            className="px-4 py-2 rounded-md text-white bg-purple-600 hover:bg-purple-700"
          >
            Calculate Scores
          </a>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Lock Override Email List</h2>
        <p className="text-gray-600 mb-4">
          Accounts on this list can bypass the competition start lock and create/edit teams after the event begins.
        </p>
        <ul className="list-disc pl-5 space-y-1 text-gray-700">
          {TEAM_LOCK_BYPASS_EMAILS.map((email) => (
            <li key={email}>{email}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-500">
          To add or remove emails, edit <code>app/utils/config.ts</code>.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Manage All Fantasy Teams</h2>
        <p className="text-gray-600 mb-4">
          View and edit any fantasy team on the platform.
        </p>
        {teamsLoading ? (
          <p>Loading fantasy teams...</p>
        ) : fantasyTeams.length === 0 ? (
          <p>No fantasy teams found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {fantasyTeams.map((team) => (
                  <tr key={team.id ?? `${team.userId}-${team.name}`}>
                    <td className="px-3 py-2 text-sm text-gray-900">{team.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{team.userName || team.userId}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">${team.totalCost?.toLocaleString() ?? '0'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{team.updatedAt ? new Date(team.updatedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      <Link
                        href={`/fantasy/${team.id}/edit`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage; 