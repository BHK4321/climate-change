"use client";
import React, { useState, useEffect } from "react";
import Navbar from "@/components/navbar";
import Card from "@/components/card";

// User location hook
function useUserLocation() {
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      () => setLocation({ latitude: null, longitude: null })
    );
  }, []);
  return location;
}

const NAVBAR_HEIGHT = 72; // px

export default function MainPage() {
  // Side panel state
  const [sideOpen, setSideOpen] = useState(false);
  const [sideWidth, setSideWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);

  // Main message state
  const [input, setInput] = useState("");
  const [mainLoading, setMainLoading] = useState(false);
  const [mainCard, setMainCard] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [msgBoxLifted, setMsgBoxLifted] = useState(false);
  const [quoteFading, setQuoteFading] = useState(false);
  const [contentSlideUp, setContentSlideUp] = useState(false);
  const [cardAppear, setCardAppear] = useState(false);

  // Side message state
  const [sideInput, setSideInput] = useState("");
  const [sideLoading, setSideLoading] = useState(false);
  const [sideMessages, setSideMessages] = useState([]);

  // User & cards
  const [userEmail, setUserEmail] = useState(null);
  const [username, setUsername] = useState("");
  const [userCards, setUserCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  const location = useUserLocation();

  // Fetch user auth info and cards
  useEffect(() => {
    async function fetchUserAndCards() {
      setCardsLoading(true);
      try {
        const authRes = await fetch("/api/auth", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!authRes.ok) { setUserEmail(null); setUserCards([]); setCardsLoading(false); return; }
        const authData = await authRes.json();
        if (!authData.isLoggedIn) { setUserEmail(null); setUserCards([]); setCardsLoading(false); return; }
        setUserEmail(authData.user.email);
        setUsername(authData.user.name || authData.user.email);

        const cardsRes = await fetch(`/api/cards?email=${encodeURIComponent(authData.user.email)}`, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (cardsRes.ok) {
          const cardsData = await cardsRes.json();
          setUserCards(Array.isArray(cardsData) ? cardsData.filter(Boolean) : []);
        } else {
          setUserCards([]);
        }
      } catch {
        setUserEmail(null); setUserCards([]);
      }
      setCardsLoading(false);
    }
    fetchUserAndCards();
  }, []);

  // Responsive side panel width
  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobileView(mobile);
      if (mobile) { 
        setSideWidth(window.innerWidth * 0.9); // Take 90% of screen width on mobile
      } else {
        const width = Math.max(320, Math.min(window.innerWidth * 0.4, 600));
        setSideWidth(width);
      }
    }
    handleResize(); // Call on initial mount
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Panel resizing (for desktop) - ensure this only runs on desktop
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isMobileView || !isResizing || sideCollapsed) return;
      let newWidth = window.innerWidth - e.clientX;
      newWidth = Math.max(320, Math.min(newWidth, 600));
      setSideWidth(newWidth);
    };
    const handleMouseUp = () => {
      if (isMobileView) return;
      setIsResizing(false);
    };
    if (isResizing && !isMobileView) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, sideCollapsed]);

  // Keyboard shortcut for collapse
  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "q") {
        setSideCollapsed((c) => !c);
        setSideOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
  useEffect(() => {
    setSideOpen(false);
    setSideCollapsed(true);
  }, []);

  // Slide up content block after sending a message
  useEffect(() => {
    if (showCard) {
      setTimeout(() => setContentSlideUp(true), 80);
      setTimeout(() => setCardAppear(true), 400);
    } else {
      setContentSlideUp(false);
      setCardAppear(false);
    }
  }, [showCard]);

  // Side section open/close like original, not overlay
  const handleCollapse = () => {
    setSideCollapsed(true);
    setTimeout(() => setSideOpen(false), 240);
  };
  const handleExpand = () => {
    setSideOpen(true);
    setTimeout(() => setSideCollapsed(false), 20);
  };

  // Only translate/fade on send, not on focus
  const handleSendMain = async (e) => {
    e.preventDefault();
    if (!input.trim() || mainLoading) return;
    setMainLoading(true);
    setMainCard(null);
    setShowCard(false);
    setMsgBoxLifted(true);
    setQuoteFading(true);
    setContentSlideUp(false);
    setCardAppear(false);

    setTimeout(async () => {
      try {
        const res = await fetch("/api/query.js", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: 1,
            prompt: input,
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        });
        const data = await res.json();

        // If data contains a new card, save it to DB and update recent
        if (
          data &&
          data.card &&
          typeof data.card === "object" &&
          userEmail
        ) {
          // Save card to DB
          await fetch("/api/createCard.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data.card,
              email: userEmail,
            }),
          });
          // Add new card to top of recent cards state
          setUserCards((prev) => [data.card, ...prev].slice(0, 3));
        }

        setMainCard(data.card || data); // If card field, use it, else fallback
        setShowCard(true);
      } catch {
        setMainCard({ error: "Failed to fetch response." });
        setShowCard(true);
      } finally {
        setMainLoading(false);
        setInput("");
      }
    }, 800);
  };

  // Side Send
  const handleSendSide = async (e) => {
    e.preventDefault();
    if (!sideInput.trim() || sideLoading) return;
    setSideLoading(true);
    setSideMessages((msgs) => [...msgs, { user: sideInput, response: null }]);
    const msgIdx = sideMessages.length;
    try {
      const res = await fetch("/api/query.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: 2,
          prompt: sideInput,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
      const data = await res.json();
      setSideMessages((msgs) =>
        msgs.map((msg, idx) =>
          idx === msgIdx ? { ...msg, response: data.answer || data.error || "No response." } : msg
        )
      );
    } catch {
      setSideMessages((msgs) =>
        msgs.map((msg, idx) =>
          idx === msgIdx ? { ...msg, response: "Failed to fetch response." } : msg
        )
      );
    } finally {
      setSideLoading(false);
      setSideInput("");
    }
  };

  return (
    <div
      className="h-screen w-screen overflow-hidden relative bg-[#1A2420] md:flex" // Use flex on md+ for side-by-side
    >
      {/* Main Content */}
      <main
        className="min-h-screen flex flex-col items-center justify-start min-w-0 relative box-border bg-[#1A2420] transition-all duration-200 ease-linear w-full md:w-auto" // Adjusted width classes
        style={{
          paddingTop: `${NAVBAR_HEIGHT + 16}px`,
          width: (!isMobileView && sideOpen && !sideCollapsed) 
                 ? `calc(100vw - ${sideWidth}px)` 
                 : '100vw',
        }}
      >
        {/* Quote Heading */}
        <div
          className={`text-2xl sm:text-3xl md:text-[2.4rem] font-bold text-[#F5F5F5] mb-8 sm:mb-10 md:mb-12 mt-6 sm:mt-8 md:mt-10 tracking-[0.01em] text-center z-[2] w-full select-none px-4 sm:px-6 md:px-4 ${quoteFading ? "quote-fade-out" : "quote-fade-in"}`}
        >
          Beyond the Surface : The Real Cost
        </div>

        {/* All content below quote block */}
        <div
          className={`w-full max-w-full px-4 sm:max-w-lg md:max-w-xl mx-auto flex flex-col items-center opacity-100 slide-up-content${contentSlideUp ? " slide" : ""}`}
        >
          {/* Input bar with send button */}
          <form
            className={`w-full max-w-full sm:max-w-md md:max-w-lg flex flex-row items-center bg-[#384D48] rounded-lg shadow-[0_1px_8px_0_#1a237e16] p-2 sm:px-5 sm:py-2 z-[6] text-[#F5F5F5] ${msgBoxLifted ? "msgbox-lift" : "msgbox-rest"}`}
            onSubmit={handleSendMain}
            autoComplete="off"
          >
            <input
              className="border-none w-full h-[42px] text-lg outline-none bg-transparent text-[#F5F5F5]"
              type="text"
              placeholder="Start your query..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={mainLoading}
            />
            <button
              className={`bg-none border-none p-0 pl-[10px] flex items-center ${!input.trim() || mainLoading ? "cursor-not-allowed" : "cursor-pointer"}`}
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || mainLoading}
              tabIndex={0}
            >
              <svg height={22} width={22} viewBox="0 0 20 20" fill={input.trim() ? "#9BC53D" : "#b0b8c1"}>
                <path d="M2.01 10.384l14.093-6.246c.822-.364 1.621.435 1.257 1.257l-6.247 14.093c-.367.829-1.553.834-1.926.008l-2.068-4.683a.65.65 0 0 1 .276-.827l6.624-3.883-7.222 2.937a.65.65 0 0 1-.8"/>
              </svg>
            </button>
          </form>

          {/* Card (response) */}
          {showCard && (
            <div
              className="main-card-appear w-full max-w-[500px] mt-[22px] min-h-[80px] z-[2]"
            >
              {mainLoading ? (
                <div className="p-6 sm:p-8 text-[#888] text-center">Loading...</div>
              ) : mainCard && typeof mainCard === "object" && mainCard !== null && mainCard.hasOwnProperty("rating") ? (
                <Card card={mainCard} />
              ) : mainCard && mainCard.error ? (
                <div className="text-[#ff6666] bg-[#384D48] rounded-lg p-4 sm:p-5 text-center">{mainCard.error}</div>
              ) : null}
            </div>
          )}

          {/* Recent cards section */}
          <div className="w-full max-w-full sm:max-w-lg md:max-w-xl mt-8 md:mt-9">
            <h2 className="text-xl sm:text-[22px] text-[#F5F5F5] font-semibold mb-3 sm:mb-4 tracking-[0.01em]">
              Your Recent Analyses
            </h2>
            {cardsLoading ? (
              <div className="bg-[#384D48] text-[#D0D0D0] rounded-[10px] p-6 sm:p-8 text-center">
                Loading...
              </div>
            ) : (userCards && userCards.length > 0 ? (
              userCards.slice(0, 3).map((card, idx) => (
                card && typeof card === "object" && card.hasOwnProperty("rating") ? (
                  <div
                    key={card._id || idx}
                    className={`mb-4 sm:mb-6 bg-[#384D48] rounded-[14px] shadow-[0_1px_8px_0_#1a237e16] overflow-hidden ${cardAppear && idx === 0 ? "main-card-appear-below" : ""}`}
                  >
                    <Card card={card} />
                  </div>
                ) : null
              ))
            ) : (
              <div className="bg-[#384D48] text-[#D0D0D0] rounded-[10px] p-6 sm:p-8 text-center">
                No recent analyses found.
              </div>
            ))}
          </div>
        </div>
      </main>
      {/* Slide Button (expand/collapse) */}
      <button
        className={`fixed top-1/2 -translate-y-1/2 z-40 bg-[#1A2420] border-[1.5px] border-[#384D48] rounded-lg w-10 h-10 items-center justify-center shadow-lg cursor-pointer transition-all duration-200 ease-linear p-0 opacity-100 md:z-35 ${ (isMobileView && sideOpen && !sideCollapsed) ? 'hidden' : 'flex' }`}
        style={{ 
          right: sideCollapsed 
            ? 14 
            : (isMobileView && sideOpen ? sideWidth - 10 : sideWidth + 14)
        }}
        onClick={sideCollapsed ? handleExpand : handleCollapse}
        aria-label={sideCollapsed ? "Show General Talk" : "Hide General Talk"}
        title={sideCollapsed ? "Show General Talk" : "Hide General Talk"}
      >
        <svg width={26} height={26} viewBox="0 0 20 20" fill="none">
          <path
            d="M7 4l5 6-5 6"
            stroke="#9BC53D"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 origin-center ${!sideCollapsed ? "rotate-0" : "rotate-180"}`}
          />
        </svg>
      </button>
      {/* Side Section: General Talk */}
      <aside
        className={`h-screen overflow-hidden flex flex-col bg-[#384D48] border-l border-[#4A5D57] transition-all duration-300 ease-in-out
                    fixed inset-y-0 right-0 z-50 md:z-30 md:relative md:translate-x-0 
                    ${sideOpen && !sideCollapsed ? 'translate-x-0 shadow-xl md:shadow-lg' : 'translate-x-full md:translate-x-0'}
                    ${sideCollapsed && sideOpen ? 'md:w-[0px] opacity-0 md:opacity-100' : 'md:w-auto' }`}
        style={{
          width: isMobileView 
                 ? (sideOpen && !sideCollapsed ? sideWidth : 0)
                 : sideWidth,
          minWidth: isMobileView 
                    ? (sideOpen && !sideCollapsed ? Math.min(320, sideWidth) : 0) 
                    : (sideCollapsed && sideOpen ? 0 : 320), // if fully collapsed on desktop via JS, it's 0, else 320.
                                                              // sideCollapsed && sideOpen is the 240ms transition to 0 effective width.
          maxWidth: isMobileView ? '100vw' : 600,
          boxShadow: (!sideCollapsed && sideOpen) ? "rgba(60,64,67,0.12) 0px 1.5px 12px 0px" : "none",
        }}
        tabIndex={!sideCollapsed ? 0 : -1}
        aria-hidden={sideCollapsed && isMobileView}
      >
        {/* Drag Resizer, disabled when collapsed or on mobile */}
        {!sideCollapsed && (
          <div
            className={`w-[6px] absolute left-[-3px] top-0 bottom-0 z-31 hidden md:block ${sideCollapsed ? "cursor-default bg-transparent" : "cursor-ew-resize bg-[#4A5D57]"}`}
            onMouseDown={() => !sideCollapsed && !isMobileView && setIsResizing(true)}
            title="Resize"
          />
        )}
        {/* Content of the side panel */}
        {/* Show content only if not collapsed, or if on desktop (where "collapsed" means narrow) */}
        {(!sideCollapsed || (typeof window !== 'undefined' && window.innerWidth >= 768)) && ( 
          <div className={`flex flex-col h-full transition-opacity duration-150 ease-in-out ${sideCollapsed && sideOpen && (typeof window !== 'undefined' && window.innerWidth >=768) ? 'opacity-0 md:opacity-100 delay-100' : 'opacity-100'}`}>
            {/* Close button for mobile overlay */}
            {sideOpen && !sideCollapsed && typeof window !== 'undefined' && window.innerWidth < 768 && (
              <button
                className="absolute right-3 top-3 bg-transparent border-none text-3xl cursor-pointer text-[#9BC53D] z-50 p-2"
                onClick={handleCollapse}
                aria-label="Close General Talk"
                title="Close General Talk"
              >
                &times;
              </button>
            )}
             {/* Desktop Collapse Button (Original X) - hidden on mobile for overlay, shown when not collapsed on desktop */}
            {!sideCollapsed && (typeof window !== 'undefined' && window.innerWidth >= 768) && (
              <button
                className="absolute right-3 top-3 bg-none border-none text-[22px] cursor-pointer text-[#9BC53D] z-32 opacity-85"
                onClick={handleCollapse}
                aria-label="Collapse"
                title="Collapse"
              >
                ×
              </button>
            )}
            <div
              className="px-4 sm:px-6 py-4 sm:py-5 pb-3 sm:pb-4 font-semibold text-md sm:text-lg border-b border-[#4A5D57] bg-[#384D48] text-[#F5F5F5]"
            >
              General Talk
            </div>
            <div
              className="flex-1 overflow-y-auto p-5 text-[15.5px] text-[#F5F5F5] bg-[#4A5D57]"
            >
              <p className="m-0 text-[#D0D0D0]">
                Welcome to the General Talk section! You can use this space to chat, ask questions, or discuss anything related to climate change.
              </p>
              <div className="mt-[18px]">
                {sideMessages.map((msg, idx) => (
                  <div key={idx} className="mb-[14px]">
                    <div
                      className="text-[13.5px] text-[#9BC53D] mb-1 font-medium whitespace-pre-line break-words"
                    >
                      {msg.user}
                    </div>
                    {msg.response ? (
                      <div
                        className="text-[15.5px] text-[#F5F5F5] bg-[#384D48] py-[0.7rem] px-4 rounded-[7px] shadow-[0_1px_4px_0_#1a237e0e]"
                      >
                        {msg.response}
                      </div>
                    ) : (
                      <div
                        className="text-[15px] text-[#D0D0D0] py-[0.7rem] px-4"
                      >
                        Loading...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Side panel query input and send button */}
            <form
              className="w-full bg-[#4A5D57] p-4 pt-3 border-t border-[#4A5D57] flex items-center gap-2"
              onSubmit={handleSendSide}
              autoComplete="off"
            >
              <input
                className="border-none bg-[#384D48] rounded-[6px] text-base py-[0.6rem] px-4 flex-1 outline-none shadow-[0_0.5px_7px_0_rgba(60,64,67,0.07)] text-[#F5F5F5]"
                type="text"
                placeholder="Type a message..."
                value={sideInput}
                onChange={(e) => setSideInput(e.target.value)}
                disabled={sideLoading}
              />
              <button
                className={`bg-none border-none p-0 pl-[10px] flex items-center ${!sideInput.trim() || sideLoading ? "cursor-not-allowed" : "cursor-pointer"}`}
                type="submit"
                aria-label="Send"
                disabled={!sideInput.trim() || sideLoading}
                tabIndex={0}
              >
                <svg height={22} width={22} viewBox="0 0 20 20" fill={sideInput.trim() ? "#9BC53D" : "#b0b8c1"}>
                  <path d="M2.01 10.384l14.093-6.246c.822-.364 1.621.435 1.257 1.257l-6.247 14.093c-.367.829-1.553.834-1.926.008l-2.068-4.683a.65.65 0 0 1 .276-.827l6.624-3.883-7.222 2.937a.65.65 0 0 1-.8"/>
                </svg>
              </button>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}