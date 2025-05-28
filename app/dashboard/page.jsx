"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/card';

export default function DashboardPage() {
  const router = useRouter();
  const [cards, setCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      // Check authentication status
      const authResponse = await fetch('/api/auth', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!authResponse.ok) {
        // User not authenticated, redirect to login
        router.push('/login');
        return;
      }

      const authData = await authResponse.json();
      
      if (!authData.isLoggedIn) {
        // User not authenticated, redirect to login
        router.push('/login');
        return;
      }

      setUsername(authData.user.name || authData.user.email);
      setIsAuthenticated(true);

      // Fetch user's cards using their email
      const userEmail = authData.user.email;
      const cardsResponse = await fetch(`/api/cards?email=${encodeURIComponent(userEmail)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (cardsResponse.ok) {
        const cardsData = await cardsResponse.json();
        setCards(Array.isArray(cardsData) ? cardsData : []);
      } else {
        console.error('Failed to fetch cards');
        setCards([]);
      }
    } catch (error) {
      console.error('Error checking auth or loading data:', error);
      // On error, redirect to login
      router.push('/login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    router.push("/");
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Force redirect even if logout fails
      router.push('/login');
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen pt-20 bg-[#1A2420]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 w-64 rounded mb-4 bg-[#384D48]"></div>
            <div className="h-4 w-48 rounded mb-8 bg-[#384D48]"></div>
            
            {[1, 2, 3].map((i) => (
              <div key={i} className="mb-6 p-6 rounded-xl bg-[#384D48]">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#4A5D57]"></div>
                  <div>
                    <div className="h-4 w-24 rounded mb-2 bg-[#4A5D57]"></div>
                    <div className="h-3 w-32 rounded bg-[#4A5D57]"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-[#4A5D57]"></div>
                  <div className="h-4 w-3/4 rounded bg-[#4A5D57]"></div>
                  <div className="h-4 w-1/2 rounded bg-[#4A5D57]"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Only render dashboard if authenticated
  if (!isAuthenticated) {
    return null; // This shouldn't show as user would be redirected
  }

  return (
    <div className="min-h-screen pt-20 bg-[#1A2420]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header with Logout */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4"> {/* mb-4 can stay or reduce if needed */}
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 text-[#F5F5F5]">
                Your Analysis Dashboard
              </h1>
              <p className="text-base sm:text-lg text-[#D0D0D0]">
                Welcome back, {username}! Here are all your sustainability analyses.
              </p>
            </div>
            
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-lg font-medium transition-all duration-300 border self-start sm:self-auto mt-3 sm:mt-0 text-[#D0D0D0] border-[#384D48] bg-transparent hover:bg-[#384D48] hover:text-[#F5F5F5]"
            >
              Logout
            </button>
          </div>
          
          {/* Stats and New Analysis Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
            <div className="flex items-center space-x-4 sm:space-x-6">
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-[#9BC53D]">
                  {cards.length}
                </div>
                <div className="text-xs sm:text-sm text-[#D0D0D0]">
                  Total Analyses
                </div>
              </div>
              <div className="text-center">
                <div className="text-xl sm:text-2xl font-bold text-[#7FB069]">
                  {cards.length > 0 ? Math.round(cards.reduce((sum, card) => sum + card.rating, 0) / cards.length) : 0}
                </div>
                <div className="text-xs sm:text-sm text-[#D0D0D0]">
                  Avg. Score
                </div>
              </div>
            </div>
            
            <button
              onClick={handleNewAnalysis}
              className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm sm:text-base font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg bg-[#7FB069] text-[#1A2B24] hover:bg-[#9BC53D] hover:shadow-[0_6px_20px_rgba(155,197,61,0.4)]"
              style={{ boxShadow: '0 4px 15px rgba(127, 176, 105, 0.3)' }}
            >
              + New Analysis
            </button>
          </div>
        </div>

        {/* Cards List */}
        {cards.length > 0 ? (
          <div className="space-y-6">
            {cards.map((card) => (
              <Card key={card._id} card={card} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-[#384D48]">
              <svg className="w-12 h-12 text-[#7FB069]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-4 text-[#F5F5F5]">
              No Analyses Yet
            </h3>
            <p className="mb-6 max-w-md mx-auto text-[#D0D0D0]">
              Start your sustainability journey by analyzing your first product. 
              Get insights into environmental impact and discover better alternatives.
            </p>
            <button
              onClick={handleNewAnalysis}
              className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 bg-[#7FB069] text-[#1A2B24] hover:bg-[#9BC53D]"
            >
              Analyze Your First Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
}