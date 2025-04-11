'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { SignedIn, SignedOut, SignIn, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

export default function Navbar() {
  const { user, loading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-blue-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <div className="font-bold text-xl">FRC Fantasy</div>
              <div className="ml-2 bg-yellow-500 text-blue-900 text-xs font-bold rounded-full px-2 py-1">
                2025 Championship
              </div>
            </Link>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link
                  href="/teams"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Teams
                </Link>
                <Link
                  href="/leagues"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Leagues
                </Link>
                <Link
                  href="/fantasy"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  My Fantasy Teams
                </Link>
                <Link
                  href="/leaderboard"
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                >
                  Leaderboard
                </Link>
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="ml-4 flex items-center md:ml-6">
              <div className="flex items-center">
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="text-white bg-blue-800 hover:bg-blue-600 px-4 py-2 rounded-md text-sm font-medium">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="ml-2 text-white bg-green-600 hover:bg-green-500 px-4 py-2 rounded-md text-sm font-medium">
                      Sign Up
                      
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </div>
          </div>
          <div className="-mr-2 flex md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="bg-blue-800 inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-800 focus:ring-white"
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className={`${isMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                className={`${isMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state */}
      <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <Link
            href="/teams"
            className="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600"
            onClick={() => setIsMenuOpen(false)}
          >
            Teams
          </Link>
          <Link
            href="/leagues"
            className="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600"
            onClick={() => setIsMenuOpen(false)}
          >
            Leagues
          </Link>
          <Link
            href="/fantasy"
            className="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600"
            onClick={() => setIsMenuOpen(false)}
          >
            My Fantasy Teams
          </Link>
          <Link
            href="/leaderboard"
            className="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600"
            onClick={() => setIsMenuOpen(false)}
          >
            Leaderboard
          </Link>
        </div>
        <div className="pt-4 pb-3 border-t border-blue-800">
          <div className="px-2 space-y-1">
            {user ? (
              <>
                <div className="block px-3 py-2 rounded-md text-base font-medium text-gray-100">
                  {user.displayName || user.email}
                </div>
                <Link
                  href="/profile"
                  className="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  My Profile
                </Link>
                <Link
                  href="/fantasy/create"
                  className="block px-3 py-2 rounded-md text-base font-medium hover:bg-blue-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Create Fantasy Team
                </Link>
              </>
            ) : (
              <div className="flex flex-col space-y-2">
                <Link
                  href="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium bg-blue-800 hover:bg-blue-600 text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="block px-3 py-2 rounded-md text-base font-medium bg-green-600 hover:bg-green-500 text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 