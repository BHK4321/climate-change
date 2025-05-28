"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // Add this to detect route changes

  // Check authentication status on component mount, route changes, and when localStorage changes
  useEffect(() => {
    checkAuthStatus();
  }, [pathname]); // Add pathname as dependency

  useEffect(() => {
    // Listen for storage changes (login/logout from other tabs)
    const handleStorageChange = () => {
      checkAuthStatus();
    };
    
    // Listen for focus events (when user comes back to tab)
    const handleFocus = () => {
      checkAuthStatus();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      // First check if user data exists in localStorage
      const userEmail = localStorage.getItem("userEmail");
      const storedUsername = localStorage.getItem("Username");
      
      if (userEmail && storedUsername) {
        // Then verify with server that the JWT is still valid
        const response = await fetch("/api/auth", {
          method: "GET",
          credentials: "include", // Include cookies
        });
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.isLoggedIn) {
            setIsLoggedIn(true);
            setUsername(storedUsername);
          } else {
            // Token is invalid, clear localStorage
            localStorage.removeItem("userEmail");
            localStorage.removeItem("Username");
            setIsLoggedIn(false);
            setUsername("");
          }
        } else {
          // Server error, but keep user logged in based on localStorage
          setIsLoggedIn(true);
          setUsername(storedUsername);
        }
      } else {
        // No user data in localStorage
        setIsLoggedIn(false);
        setUsername("");
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      // On network error, fall back to localStorage data
      const userEmail = localStorage.getItem("userEmail");
      const storedUsername = localStorage.getItem("Username");
      
      if (userEmail && storedUsername) {
        setIsLoggedIn(true);
        setUsername(storedUsername);
      } else {
        setIsLoggedIn(false);
        setUsername("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Always clear localStorage first
      localStorage.removeItem("userEmail");
      localStorage.removeItem("Username");
      
      // Update state immediately
      setIsLoggedIn(false);
      setUsername("");
      
      // Try to call logout API
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Logout API failed, but user is logged out locally");
      }
      
      // Redirect to home page
      router.push("/");
    } catch (error) {
      console.error("Error during logout:", error);
      // Even if API fails, user is logged out locally
    }
  };

  if (isLoading) {
    return (
      <nav className="fixed top-0 left-0 w-full z-50 py-3 px-6 border-b bg-[#384D48] border-[#4A5D57]">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="h-6 w-16 rounded animate-pulse bg-[#4A5D57]"></div>
          <div className="h-6 w-20 rounded animate-pulse bg-[#4A5D57]"></div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed top-0 left-0 w-full z-50 py-3 px-6 border-b shadow-lg bg-[#384D48] border-[#4A5D57]">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo/Brand Name */}
        <Link 
          href="/" 
          className="text-xl font-bold transition-colors duration-200 hover:no-underline text-[#F5F5F5] hover:text-[#9BC53D]"
        >
          NAME
        </Link>

        {/* Hamburger Menu Button - visible on mobile, hidden on md and up */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
            className="text-[#F5F5F5] hover:text-[#9BC53D] focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16m-7 6h7"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Desktop Right Side Navigation - hidden on mobile, visible on md and up */}
        <div className="hidden md:flex items-center space-x-4">
          {isLoggedIn ? (
            <>
              <span className="text-base font-medium hidden sm:inline text-[#D0D0D0]"> {/* sm:inline here is fine as this whole div is md:flex */}
                Welcome, {username}
              </span>
              <Link 
                href="/dashboard" 
                className="px-3 py-1.5 rounded-md font-medium transition-all duration-200 hover:no-underline text-sm text-[#F5F5F5] bg-[#4A5D57] hover:bg-[#7FB069] hover:text-[#1A2B24]"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md font-medium transition-all duration-200 hover:scale-105 text-sm bg-[#7FB069] text-[#1A2B24] border-none hover:bg-[#9BC53D] hover:shadow-[0_4px_12px_rgba(155,197,61,0.3)]"
              >
                Logout
              </button>
            </>
          ) : (
            <Link 
              href="/login" 
              className="px-3 py-1.5 rounded-md font-medium transition-all duration-200 hover:no-underline hover:scale-105 text-sm bg-[#7FB069] text-[#1A2B24] hover:bg-[#9BC53D] hover:shadow-[0_4px_12px_rgba(155,197,61,0.3)]"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu - shown/hidden based on state, hidden on md and up */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 w-full bg-[#384D48] shadow-lg rounded-b-md overflow-hidden">
          <div className="flex flex-col py-2">
            {isLoggedIn ? (
              <>
                <span className="px-6 py-3 text-base font-medium text-[#D0D0D0]">
                  Welcome, {username}
                </span>
                <Link 
                  href="/dashboard" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-6 py-3 text-base text-[#F5F5F5] hover:bg-[#4A5D57] transition-colors duration-200"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-6 py-3 text-base text-[#F5F5F5] bg-[#7FB069] hover:bg-[#9BC53D] transition-colors duration-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link 
                href="/login" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-6 py-3 text-base text-[#F5F5F5] bg-[#7FB069] hover:bg-[#9BC53D] transition-colors duration-200"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}