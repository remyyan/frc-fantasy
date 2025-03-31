"use client";

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const AdminPage = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>
      
      {/* EPA Cache Update Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">EPA Cache Management</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
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
          <p className="mt-2 text-green-600 dark:text-green-400">{message}</p>
        )}
        {error && (
          <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
      
      {/* Division Teams Cache Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Division Teams Cache</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
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
        
        {message && (
          <p className="mt-2 text-green-600 dark:text-green-400">{message}</p>
        )}
        {error && (
          <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
};

export default AdminPage; 