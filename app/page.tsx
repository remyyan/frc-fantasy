'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/contexts/AuthContext';
import { FANTASY_CONFIG } from '@/app/utils/config';

// Countdown to the Championship
const CHAMPIONSHIP_START_DATE = new Date('2024-04-17T00:00:00');

export default function Home() {
  const { user, loading } = useAuth();
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Calculate time remaining until Championship
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const difference = CHAMPIONSHIP_START_DATE.getTime() - now.getTime();
      
      if (difference <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setTimeRemaining({ days, hours, minutes, seconds });
    };
    
    calculateTimeRemaining();
    const timer = setInterval(calculateTimeRemaining, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const isChampionshipActive = new Date() >= CHAMPIONSHIP_START_DATE;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Welcome to FRC Fantasy</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Create your own fantasy team of FRC robots and compete with friends based on real competition results.
        </p>
      </div>

      {/* Hero Banner */}
      <div className="bg-blue-700 text-white rounded-lg shadow-xl p-8 mb-12">
        <div className="flex flex-col md:flex-row md:items-center">
          <div className="md:w-2/3 mb-6 md:mb-0 md:pr-8">
            <h2 className="text-3xl font-bold mb-2">{FANTASY_CONFIG.eventName}</h2>
            <p className="text-lg mb-4">{FANTASY_CONFIG.eventDates} • {FANTASY_CONFIG.eventLocation}</p>
            <p className="mb-6">
              Draft your fantasy team now, pick the best robots, manage your budget, and compete with friends!
            </p>
            <div className="flex flex-wrap gap-3">
                <Link
                  href="/fantasy/create"
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md"
                >
                  Create Your Fantasy Team
                </Link>
              <Link
                href="/teams"
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md"
              >
                View Teams
              </Link>
            </div>
          </div>
          <div className="md:w-1/3">
            <div className="bg-blue-800 rounded-lg p-6 shadow-inner">
              <h3 className="text-xl font-bold mb-3">Fantasy Draft Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm opacity-75">Budget</div>
                  <div className="text-2xl font-bold">${FANTASY_CONFIG.totalBudget}</div>
                </div>
                <div>
                  <div className="text-sm opacity-75">Max Teams</div>
                  <div className="text-2xl font-bold">{FANTASY_CONFIG.maxTeams}</div>
                </div>
                <div>
                  <div className="text-sm opacity-75">Event Divisions</div>
                  <div className="text-2xl font-bold">{FANTASY_CONFIG.eventIds.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-blue-300 rounded-lg shadow hover:shadow-lg transition-shadow p-6">
          <div className="text-blue-600 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-black">Draft Your Team</h3>
          <p className="text-gray-600 mb-4">
            Select FRC teams within your budget constraint to build your ultimate fantasy lineup.
            </p>
          <Link href="/fantasy/create" className="text-blue-600 hover:text-blue-800 font-medium">
            Start Drafting →
          </Link>
        </div>
        
        <div className="bg-blue-300 rounded-lg shadow hover:shadow-lg transition-shadow p-6">
          <div className="text-blue-600 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-black">Track Performance</h3>
          <p className="text-gray-600 mb-4">
            Watch how your fantasy team performs based on real match results during the event.
          </p>
          <Link href="/leaderboard" className="text-blue-600 hover:text-blue-800 font-medium">
            View Leaderboard →
          </Link>
        </div>
        
        <div className="bg-blue-300 rounded-lg shadow hover:shadow-lg transition-shadow p-6">
          <div className="text-blue-600 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold mb-2 text-black">Join Leagues</h3>
          <p className="text-gray-600 mb-4">
            Create private leagues to compete with friends, classmates, or colleagues.
          </p>
          <Link href="/fantasy" className="text-blue-600 hover:text-blue-800 font-medium">
            My Fantasy Teams →
          </Link>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-300 rounded-lg p-8 text-center mb-8">
        <h2 className="text-2xl font-bold mb-4 text-black">Ready to Build Your Dream FRC Team?</h2>
        <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
          Join thousands of FIRST Robotics fans in creating your perfect lineup. Challenge your strategic thinking and test your knowledge of competitive robotics.
        </p>
          <Link
          href={user ? "/fantasy/create" : "/register"}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow inline-block"
          >
          {user ? "Create Your Team" : "Sign Up & Get Started"}
          </Link>
      </div>
    </div>
  );
}
