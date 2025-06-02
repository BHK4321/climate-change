"use client";
import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/navbar";
import Card from "@/components/card";

function useUserLocation() {
  const [location, setLocation] = useState({ latitude: null, longitude: null });
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      () => setLocation({ latitude: null, longitude: null })
    );
  }, []);
  return location;
}

const NAVBAR_HEIGHT = 72;

function parseFinalResponseJSON(final_response) {
  if (!final_response || typeof final_response !== "string") return null;
  console.log(final_response);
  let match = final_response.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
  console.log(match[1]);
  if(match){
    try {
      console.log(JSON.parse(match[1]));
      return JSON.parse(match[1]);
    } catch (e) {
      console.log(e);
    }
  }

  try {
    let trimmed = final_response.trim().replace(/^```json|^```|```$/g, "");
    return JSON.parse(trimmed);
  } catch (e) {
    console.log(e);
    return null;
  }
}

function extractCardData(card, email = null, productName = null, flag = true) {
  if (!card) return {};
  let data = card.result || card;
  // If final_response is a code block, parse it and merge into data
  let parsedFromFinal = null;
  if (
    typeof data.final_response === "string" &&
    data.final_response.trim().startsWith("```")
  ) {
    parsedFromFinal = parseFinalResponseJSON(data.final_response);
    console.log(parsedFromFinal);
  }
  if (parsedFromFinal && typeof parsedFromFinal === "object") {
    data = { ...data, ...parsedFromFinal };
  }
  
  // Defensive: ensure arrays
  const rating = data.rating ?? null;
  const text = data.text ?? "";
  const citationsArr = Array.isArray(data.citations) ? data.citations : [];
  const recommendationsArr = Array.isArray(data.recommendations) ? data.recommendations : [];
  const questionsArr = (
    Array.isArray(data.suggestedQuestions)
      ? data.suggestedQuestions
      : Array.isArray(data.suggested_questions)
        ? data.suggested_questions
        : []
  );
  const sub_answers = Array.isArray(data.sub_answers) ? data.sub_answers : [];
  const final_response = data.final_response ?? "";

  // Normalize citations to {label, url}
  const citations = citationsArr.map((c) => {
    if (typeof c === "object" && c.label && c.url)
      return { label: c.label, url: c.url };
    const match =
      typeof c === "string" && c.match(/^\[(.*)\]\((.*)\)$/);
    if (match) return { label: match[1], url: match[2] };
    if (typeof c === "string" && c.startsWith("http"))
      return { label: "Source", url: c };
    return { label: c?.toString() || "Source", url: "#" };
  });
  console.log(citations);
  // Normalize recommendations to {label}
  const recommendations = recommendationsArr.map((rec) => {
    if (typeof rec === "object" && rec.label) return { label: rec.label };
    if (typeof rec === "object" && rec.text) return { label: rec.text };
    if (typeof rec === "string") return { label: rec };
    return { label: "Recommendation" };
  });

  // Main text construction
  let mainText = text;
  // Always try to display final_response if present and non-empty
  if ((!mainText || !mainText.trim()) && final_response && typeof final_response === "string" && final_response.trim()) {
    mainText = final_response;
  }
  if ((!mainText || !mainText.trim()) && sub_answers.length > 0)
    mainText = sub_answers.join("\n\n---\n\n");

  // If text and final_response both exist and are different, show both (final_response appended)
  if (
    text &&
    final_response &&
    typeof final_response === "string" &&
    final_response.trim() &&
    text.trim() !== final_response.trim()
  ) {
    mainText = text + "\n\n" + final_response;
  }

  const createdAt =
    card.createdAt ||
    data.createdAt ||
    data.date ||
    data.timestamp ||
    new Date().toISOString();

  const result = {
    email: email || data.email || undefined,
    product: productName || data.product || data.productName || undefined,
    rating,
    text: mainText,
    citations,
    recommendations,
    suggestedQuestions: questionsArr,
  };
  if (flag) {
    result.createdAt = createdAt;
  }
  if (card._id) result._id = card._id;
  return result;
}

/**
 * Reads and parses SSE stream from response, calling callbacks on logs/result
 */
async function readSSEStreamRealtime(response, { onLogs, onResult }) {
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;
  let resultReceived = false;
  const reader = response.body.getReader();
  while (!done) {
    const { value, done: streamDone } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !streamDone });
      // Split by double newlines (SSE event delimiter)
      let events = buffer.split("\n\n");
      // Keep last partial event in buffer
      buffer = events.pop();
      for (const eventChunk of events) {
        // Each event can be multiple lines, parse event type and data
        const lines = eventChunk.split("\n");
        let eventType = null;
        let dataLines = [];
        for (const l of lines) {
          if (l.startsWith("event: ")) eventType = l.replace("event: ", "");
          if (l.startsWith("data: ")) dataLines.push(l.replace("data: ", ""));
        }
        const dataStr = dataLines.join("\n");
        if (eventType === "logs" && onLogs) {
          try {
            onLogs(JSON.parse(dataStr));
          } catch {
            onLogs(dataStr);
          }
        }
        if (eventType === "result" && onResult) {
          resultReceived = true;
          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            parsed = { error: "Parse error", raw: dataStr };
          }
          onResult(parsed);
        }
        if (eventType === "error" && onResult) {
          resultReceived = true;
          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            parsed = { error: "Parse error", raw: dataStr };
          }
          onResult(parsed);
        }
      }
    }
    if (streamDone) done = true;
  }
}

export default function MainPage() {
  const mainBg = "#D9EAFD";
  const cardBg = "#3F72AF";
  const cardAlt = "#3F72AF";
  const inputBg = "#DBE2EF";
  const textMain = "#112D4E";
  const textSub = "#6DA9E4";

  const [showUnderline, setShowUnderline] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowUnderline(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const [sideOpen, setSideOpen] = useState(false);
  const [sideWidth, setSideWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(true);
  const [sideFullScreen, setSideFullScreen] = useState(false);

  const [input, setInput] = useState("");
  const [mainLoading, setMainLoading] = useState(false);
  const [mainCard, setMainCard] = useState(null);
  const [mainLogs, setMainLogs] = useState([]); // logs for main
  const [showCard, setShowCard] = useState(false);
  const [msgBoxLifted, setMsgBoxLifted] = useState(false);
  const [quoteFading, setQuoteFading] = useState(false);
  const [contentSlideUp, setContentSlideUp] = useState(false);
  const [cardAppear, setCardAppear] = useState(false);

  const [sideInput, setSideInput] = useState("");
  const [sideLoading, setSideLoading] = useState(false);
  const [sideMessages, setSideMessages] = useState([]);
  const [sideTypingIdx, setSideTypingIdx] = useState(-1);
  const [sideTypingChunks, setSideTypingChunks] = useState([]);
  const [sideTypingCurrentChunk, setSideTypingCurrentChunk] = useState("");
  const [sideLogs, setSideLogs] = useState({}); // logs for each side message idx
  const sidebarBottomRef = useRef(null);

  const [userEmail, setUserEmail] = useState(null);
  const [username, setUsername] = useState("");
  const [userCards, setUserCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  const location = useUserLocation();

  useEffect(() => {
    async function fetchUserAndCards() {
      setCardsLoading(true);
      try {
        const authRes = await fetch("/api/auth", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        if (!authRes.ok) {
          setUserEmail(null);
          setUserCards([]);
          setCardsLoading(false);
          return;
        }
        const authData = await authRes.json();
        if (!authData.isLoggedIn) {
          setUserEmail(null);
          setUserCards([]);
          setCardsLoading(false);
          return;
        }
        setUserEmail(authData.user.email);
        setUsername(authData.user.name || authData.user.email);

        const cardsRes = await fetch(
          `/api/cards?email=${encodeURIComponent(authData.user.email)}`,
          {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          }
        );
        if (cardsRes.ok) {
          const cardsData = await cardsRes.json();
          setUserCards(Array.isArray(cardsData) ? cardsData.filter(Boolean) : []);
        } else {
          setUserCards([]);
        }
      } catch {
        setUserEmail(null);
        setUserCards([]);
      }
      setCardsLoading(false);
    }
    fetchUserAndCards();
  }, []);

  useEffect(() => {
    function handleResize() {
      if (sideFullScreen) return;
      const width = Math.max(320, Math.min(window.innerWidth * 0.4, 600));
      setSideWidth(width);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sideFullScreen]);
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || sideCollapsed || sideFullScreen) return;
      let newWidth = window.innerWidth - e.clientX;
      newWidth = Math.max(320, Math.min(newWidth, 600));
      setSideWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, sideCollapsed, sideFullScreen]);
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

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !document.getElementById("msgbox-fadeup-style")
    ) {
      const style = document.createElement("style");
      style.id = "msgbox-fadeup-style";
      style.innerHTML = `
        .msgbox-rest {
          transition: transform 0.8s linear;
          transform: translateY(0);
          z-index: 4;
        }
        .msgbox-lift {
          transition: transform 0.8s linear;
          transform: translateY(-32px);
          z-index: 4;
        }
        .quote-fade-in {
          opacity: 1;
          transition: opacity 0.8s linear;
        }
        .quote-fade-out {
          opacity: 0;
          transition: opacity 0.8s linear;
        }
        .main-card-appear {
          animation: fadeinCardMain 0.42s ease;
        }
        .slide-up-content {
          opacity: 1;
          transform: translateY(90px);
          transition: transform 0.7s cubic-bezier(.23,1.07,.37,1.01), opacity 0.7s cubic-bezier(.23,1.07,.37,1.01);
        }
        .slide-up-content.slide {
          opacity: 1;
          transform: translateY(0px);
        }
        .main-card-appear-below {
          animation: fadeinCardBelow 0.55s cubic-bezier(.23,1.07,.37,1.01);
        }
        @keyframes fadeinCardMain {
          from { opacity: 0; transform: translateY(32px);}
          to   { opacity: 1; transform: translateY(0);}
        }
        @keyframes fadeinCardBelow {
          from { opacity: 0; transform: translateY(56px);}
          to   { opacity: 1; transform: translateY(0);}
        }
        @media (max-width: 600px) {
          .msgbox-rest, .msgbox-lift {
            width: 96vw !important;
            min-width: 0 !important;
            max-width: 99vw !important;
            left: 0;
            padding: 0.5rem 2vw;
          }
        }
        .blinking-cursor {
          animation: blink 1s steps(1) infinite;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);
  useEffect(() => {
    if (showCard) {
      setTimeout(() => setContentSlideUp(true), 80);
      setTimeout(() => setCardAppear(true), 400);
    } else {
      setContentSlideUp(false);
      setCardAppear(false);
    }
  }, [showCard]);
  useEffect(() => {
    if (sidebarBottomRef.current) {
      sidebarBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sideMessages, sideTypingChunks, sideTypingCurrentChunk, sideFullScreen]);

  const handleCollapse = () => {
    setSideCollapsed(true);
    setTimeout(() => setSideOpen(false), 240);
  };
  const handleExpand = () => {
    setSideOpen(true);
    setTimeout(() => setSideCollapsed(false), 20);
  };
  const handleFullScreen = () => setSideFullScreen(true);
  const handleExitFullScreen = () => setSideFullScreen(false);

  const handleSuggestedQuestionClick = (question) => {
    setSideOpen(true);
    setSideCollapsed(false);
    setSideInput(question);
    setTimeout(() => {
      document.querySelector("#side-query-input")?.focus();
      handleSendSide({ preventDefault: () => { } }, question);
    }, 100);
  };

  // Helper to stream logs/results from SSE API for main query
  const handleSendMain = async (e) => {
    e.preventDefault();
    if (!input.trim() || mainLoading) return;
    setMainLoading(true);
    setMainCard(null);
    setMainLogs([]);
    setShowCard(false);
    setMsgBoxLifted(true);
    setQuoteFading(true);
    setContentSlideUp(false);
    setCardAppear(false);

    setTimeout(async () => {
      try {
        const response = await fetch('/api/query', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: 1,
            prompt: input,
            latitude: location.latitude,
            longitude: location.longitude,
          }),
        });
        if (!response.ok) {
          const errorText = await response.text();
          setMainCard({ error: `FastAPI error: ${errorText}` });
          setShowCard(true);
          setMainLoading(false);
          setInput("");
          return;
        }

        await readSSEStreamRealtime(response, {
          onLogs: (log) => {
            setMainLogs((prev) => [...prev, log]);
          },
          onResult: async (result) => {
            if (
              result &&
              typeof result === "object" &&
              result.result &&
              userEmail
            ) {
              const cardForDb = extractCardData({ result: result.result }, userEmail, input, false);
              const resp = await fetch("/api/createCard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cardForDb),
              });
              if (resp.ok) {
                const savedCard = await resp.json();
                setUserCards((prev) => [savedCard, ...prev].slice(0, 3));
              }
            }
            setMainCard(result);
            setShowCard(true);
            setMainLoading(false);
            setInput("");
          }
        });
      } catch (err) {
        setMainCard({ error: "Failed to fetch response." });
        setShowCard(true);
        setMainLoading(false);
        setInput("");
      }
    }, 400);
  };

  // Helper to stream logs/results from SSE API for side queries
  const handleSendSide = async (e, overrideInput = null) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    const query = overrideInput !== null ? overrideInput : sideInput;
    if (!query.trim() || sideLoading) return;
    setSideLoading(true);
    setSideMessages((msgs) => [...msgs, { user: query, chunks: [] }]);
    const msgIdx = sideMessages.length;
    setSideLogs((prev) => ({ ...prev, [msgIdx]: [] }));
    try {
      const response = await fetch('/api/query', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: 2,
          prompt: query,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        setSideMessages((msgs) =>
          msgs.map((msg, idx) =>
            idx === msgIdx
              ? { ...msg, chunks: [`FastAPI error: ${errorText}`] }
              : msg
          )
        );
        setSideLoading(false);
        setSideInput("");
        return;
      }
      await readSSEStreamRealtime(response, {
        onLogs: (log) => {
          setSideLogs((prev) => ({
            ...prev,
            [msgIdx]: [...(prev[msgIdx] || []), log],
          }));
        },
        onResult: (data) => {
          // Always display the final_response if present for both query types
          let textToShow = "";
          if (
            data &&
            typeof data === "object" &&
            data.result &&
            (data.result.type === 2 || data.result.type === "2")
          ) {
            // Side panel "General Talk" answer
            let all = [];
            if (Array.isArray(data.result.sub_answers)) {
              all = [...data.result.sub_answers];
            }
            if (data.result.final_response) {
              all.push(data.result.final_response);
            }
            let currentChunks = [];
            let idx = 0;
            function animateChunk() {
              if (idx < all.length) {
                setSideTypingIdx(msgIdx);
                setSideTypingChunks(currentChunks);
                setSideTypingCurrentChunk("");
                let full = all[idx];
                let charIdx = 0;
                function typeChar() {
                  setSideTypingCurrentChunk(full.slice(0, charIdx + 1));
                  charIdx++;
                  if (charIdx < full.length) {
                    setTimeout(typeChar, 2);
                  } else {
                    currentChunks = [...currentChunks, full];
                    setSideMessages((prev) =>
                      prev.map((msg, mi) =>
                        mi === msgIdx
                          ? {
                            ...msg,
                            chunks: [...currentChunks],
                          }
                          : msg
                      )
                    );
                    idx++;
                    setTimeout(animateChunk, 30);
                  }
                }
                typeChar();
              } else {
                setSideTypingIdx(-1);
                setSideTypingChunks([]);
                setSideTypingCurrentChunk("");
              }
            }
            animateChunk();
          } else {
            // For other types, display the final_response if exists
            if (
              data &&
              typeof data === "object" &&
              data.final_response &&
              typeof data.final_response === "string"
            ) {
              textToShow = data.final_response;
            } else if (
              data &&
              typeof data === "object" &&
              data.text &&
              typeof data.text === "string"
            ) {
              textToShow = data.text;
            } else if (data && Array.isArray(data.sub_answers)) {
              textToShow = data.sub_answers.join("\n\n---\n\n");
            } else if (data && data.error) {
              textToShow = data.error;
            } else {
              textToShow = "No response.";
            }
            setSideMessages((msgs) =>
              msgs.map((msg, idx) =>
                idx === msgIdx
                  ? {
                    ...msg,
                    chunks: [textToShow],
                  }
                  : msg
              )
            );
          }
          setSideLoading(false);
          setSideInput("");
        }
      });
    } catch (err) {
      setSideMessages((msgs) =>
        msgs.map((msg, idx) =>
          idx === msgIdx
            ? { ...msg, chunks: ["Failed to fetch response."] }
            : msg
        )
      );
      setSideLoading(false);
      setSideInput("");
    }
  };

  // LogsDisplay is now always open and visible
  function LogsDisplay({ logs }) {
    if (!logs || !logs.length) return null;
    return (
      <div style={{
        margin: "1rem 0",
        background: "#eee",
        borderRadius: 7,
        padding: "0.75rem"
      }}>
        <div style={{
          background: "#222e3a",
          color: "#D9EAFD",
          fontSize: 13,
          borderRadius: 7,
          padding: "0.75rem",
          whiteSpace: "pre-wrap",
          maxHeight: 300,
          overflowY: "auto"
        }}>
          {logs.map((log, idx) =>
            typeof log === "string"
              ? log
              : typeof log === "object"
                ? JSON.stringify(log, null, 2)
                : String(log)
          ).join("\n")}
        </div>
      </div>
    );
  }

  const sidePanelStyle = sideFullScreen
    ? {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      height: "100vh",
      width: "100vw",
      minWidth: 0,
      maxWidth: "100vw",
      background: cardAlt,
      zIndex: 100,
      boxShadow: "rgba(60,64,67,0.18) 0px 1.5px 24px 0px",
      display: "flex",
      flexDirection: "column",
      transition:
        "width 0.2s, left 0.2s, right 0.2s, top 0.2s, bottom 0.2s, opacity 0.15s",
      borderLeft: `1px solid ${cardAlt}`,
      overflow: "hidden",
    }
    : {
      position: "fixed",
      top: 0,
      right: 0,
      height: "100vh",
      width: sideWidth,
      minWidth: 320,
      maxWidth: 600,
      background: cardAlt,
      boxShadow: !sideCollapsed
        ? "rgba(60,64,67,0.12) 0px 1.5px 12px 0px"
        : "none",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      zIndex: 30,
      transform: sideCollapsed
        ? `translateX(${sideWidth - 40}px)`
        : "translateX(0)",
      opacity: !sideCollapsed ? 1 : 0,
      pointerEvents: !sideCollapsed ? "all" : "none",
      transition:
        "transform 0.24s ease, width 0.2s ease, opacity 0.15s",
      borderLeft: `1px solid ${cardAlt}`,
    };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100vw",
        overflow: "auto",
        position: "relative",
        background: mainBg,
      }}
    >
      <main
        style={{
          width: sideFullScreen
            ? "0"
            : `calc(100vw - ${(sideOpen && !sideCollapsed) ? sideWidth : 0}px)`,
          transition: "width 0.2s ease",
          minHeight: "100vh",
          display: sideFullScreen ? "none" : "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          minWidth: 0,
          position: "relative",
          boxSizing: "border-box",
          background: mainBg,
          paddingTop: `${NAVBAR_HEIGHT + 16}px`,
        }}
      >
        <div className="text-center mb-16" style={{ marginTop: 10 }}>
          <h1
            className="text-4xl md:text-5xl font-bold mb-6"
            style={{
              color: textMain,
              fontSize: "2.4rem",
              fontWeight: 700,
              letterSpacing: "0.01em",
              textAlign: "center",
              userSelect: "none",
            }}
          >
            Beyond the Surface: The{" "}
            <span
              style={{
                color: "#3F72AF",
                cursor: "pointer",
                position: "relative",
                display: "inline-block",
              }}
            >
              real
              <span
                style={{
                  position: "absolute",
                  bottom: "-8px",
                  left: "0",
                  width: "100%",
                  height: "3px",
                  backgroundColor: "#3F72AF",
                  transform: showUnderline ? "scaleX(1)" : "scaleX(0)",
                  transformOrigin: "left",
                  transition: "transform 0.8s ease",
                }}
              />
            </span>{" "}
            cost
          </h1>
        </div>
        <div
          className={`slide-up-content${contentSlideUp ? " slide" : ""}`}
          style={{
            width: "100%",
            maxWidth: "900px",
            minWidth: "340px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            opacity: 1,
          }}
        >
          <form
            className={msgBoxLifted ? "msgbox-lift" : "msgbox-rest"}
            style={{
              width: "100%",
              maxWidth: 800,
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              background: cardBg,
              borderRadius: 8,
              boxShadow: "0 1px 8px 0 #1a237e16",
              padding: "0.5rem 1.2rem",
              zIndex: 6,
              color: textMain,
              marginBottom: 18
            }}
            onSubmit={handleSendMain}
            autoComplete="off"
          >
            <input
              style={{
                border: "none",
                width: "100%",
                height: 42,
                fontSize: 18,
                outline: "none",
                background: inputBg,
                color: textMain,
                borderRadius: 6,
                padding: "0 1rem",
                marginRight: 10,
              }}
              type="text"
              placeholder="Enter product name for analysis..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={mainLoading}
            />
            <button
              style={{
                background: "none",
                border: "none",
                padding: "0 0 0 10px",
                cursor: !input.trim() || mainLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
              }}
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || mainLoading}
              tabIndex={0}
            >
              <svg height={22} width={22} viewBox="0 0 20 20" fill={input.trim() ? "#9BC53D" : "#b0b8c1"}>
                <path d="M2.01 10.384l14.093-6.246c.822-.364 1.621.435 1.257 1.257l-6.247 14.093c-.367.829-1.553.834-1.926.008l-2.068-4.683a.65.65 0 0 1 .276-.827l6.624-3.883-7.222 2.937a.65.65 0 0 1-..." />
              </svg>
            </button>
          </form>
          {/* Main logs display - always visible */}
          <LogsDisplay logs={mainLogs} />
          {showCard && (
            <div
              className="main-card-appear"
              style={{
                width: "100%",
                maxWidth: "900px",
                minWidth: "340px",
                marginTop: 22,
                minHeight: 80,
                zIndex: 2,
                background: cardBg,
                borderRadius: 14,
                boxShadow: "0 2px 10px 0 #1a237e0e",
                overflowWrap: "break-word",
                wordBreak: "break-word",
                padding: 0,
              }}
            >
              {mainLoading ? (
                <div style={{ padding: "2rem", color: "#888", textAlign: "center" }}>Loading...</div>
              ) : (
                (() => {
                  if (
                    mainCard &&
                    typeof mainCard === "object" &&
                    mainCard.result
                  ) {
                    const cardData = extractCardData(mainCard, null, input);
                    return <Card card={cardData} onSuggestedQuestionClick={handleSuggestedQuestionClick} />;
                  }
                  // Always display final_response if available
                  if (
                    mainCard &&
                    typeof mainCard === "object" &&
                    mainCard.final_response &&
                    typeof mainCard.final_response === "string"
                  ) {
                    return (
                      <div
                        style={{
                          color: "#fff",
                          background: cardBg,
                          borderRadius: 8,
                          padding: "1.2rem",
                          textAlign: "left",
                        }}
                      >
                        <ReactMarkdown>{mainCard.final_response}</ReactMarkdown>
                      </div>
                    );
                  }
                  if (mainCard && mainCard.error) {
                    return (
                      <div
                        style={{
                          color: "#ff6666",
                          background: cardBg,
                          borderRadius: 8,
                          padding: "1.2rem",
                          textAlign: "center",
                        }}
                      >
                        {mainCard.error}
                      </div>
                    );
                  }
                  return null;
                })()
              )}
            </div>
          )}
          <div style={{
            width: "100%",
            maxWidth: "900px",
            minWidth: "340px",
            marginTop: 36,
          }}>
            <h2 style={{
              color: textMain,
              fontSize: 22,
              fontWeight: 600,
              marginBottom: 16,
              letterSpacing: "0.01em",
            }}>
              Your Recent Analyses
            </h2>
            {cardsLoading ? (
              <div style={{
                background: cardBg,
                color: "#fff",
                borderRadius: 10,
                padding: "2rem",
                textAlign: "center"
              }}>
                Loading...
              </div>
            ) : (userCards && userCards.length > 0 ? (
              userCards.slice(0, 3).map((card, idx) => (
                card && typeof card === "object" && card.hasOwnProperty("rating") ? (
                  <div
                    key={card._id || idx}
                    className={cardAppear && idx === 0 ? "main-card-appear-below" : ""}
                    style={{
                      marginBottom: 24,
                      background: cardBg,
                      borderRadius: 14,
                      boxShadow: "0 1px 8px 0 #1a237e16",
                      overflow: "hidden",
                    }}
                  >
                    <Card card={extractCardData(card)} onSuggestedQuestionClick={handleSuggestedQuestionClick} />
                  </div>
                ) : null
              ))
            ) : (
              <div style={{
                background: cardBg,
                color: "#fff",
                borderRadius: 10,
                padding: "2rem",
                textAlign: "center"
              }}>
                No recent analyses found.
              </div>
            ))}
          </div>
        </div>
      </main>
      {!sideFullScreen && (
        <button
          style={{
            position: "fixed",
            top: "50%",
            right: sideCollapsed ? 14 : sideWidth + 14,
            transform: "translateY(-50%)",
            zIndex: 35,
            background: mainBg,
            border: `1.5px solid ${cardBg}`,
            borderRadius: 9,
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 14px 0 rgba(60,64,67,0.10)",
            cursor: "pointer",
            transition: "right 0.24s ease, box-shadow 0.2s",
            padding: 0,
            opacity: 1,
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
              style={{
                transform: !sideCollapsed ? "rotate(0deg)" : "rotate(180deg)",
                transformOrigin: "50% 50%",
                transition: "transform 0.2s",
              }}
            />
          </svg>
        </button>
      )}
      <aside
        style={sidePanelStyle}
        tabIndex={!sideCollapsed ? 0 : -1}
        aria-hidden={sideCollapsed && !sideFullScreen}
      >
        {!sideFullScreen && !sideCollapsed && (
          <div
            style={{
              width: 6,
              cursor: sideCollapsed ? "default" : "ew-resize",
              background: sideCollapsed ? "transparent" : cardAlt,
              position: "absolute",
              left: -3,
              top: 0,
              bottom: 0,
              zIndex: 31,
            }}
            onMouseDown={() => !sideCollapsed && setIsResizing(true)}
            title="Resize"
          />
        )}
        {sideFullScreen && (
          <button
            style={{
              position: "absolute",
              top: 12,
              right: 56,
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#9BC53D",
              zIndex: 200,
              opacity: 0.85,
            }}
            onClick={handleExitFullScreen}
            aria-label="Exit Full Screen"
            title="Exit Full Screen"
          >
            ⬜
          </button>
        )}
        {!sideFullScreen && !sideCollapsed && (
          <button
            style={{
              position: "absolute",
              top: 12,
              right: 56,
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#9BC53D",
              zIndex: 32,
              opacity: 0.85,
            }}
            onClick={handleFullScreen}
            aria-label="Full Screen Chat"
            title="Full Screen Chat"
          >
            ⬜
          </button>
        )}
        {!sideCollapsed && (
          <button
            style={{
              position: "absolute",
              right: 12,
              top: 12,
              background: "none",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#9BC53D",
              zIndex: 32,
              opacity: 0.85,
            }}
            onClick={handleCollapse}
            aria-label="Collapse"
            title="Collapse"
          >
            ×
          </button>
        )}
        {!sideCollapsed && (
          <>
            <div
              style={{
                padding: "1.2rem 1.5rem 1rem 1.5rem",
                fontWeight: 600,
                fontSize: 19,
                borderBottom: `1px solid ${cardBg}`,
                background: cardAlt,
                color: "#D9EAFD",
              }}
            >
              General Talk
            </div>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.2rem",
                fontSize: 15.5,
                color: "#D9EAFD",
                background: cardAlt,
                wordBreak: "break-word",
                overflowWrap: "break-word",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                maxWidth: "100vw",
                width: "100%",
              }}
            >
              <p style={{ margin: 0, color: "#D9EAFD" }}>
                Welcome to the General Talk section! You can use this space to chat, ask questions, or discuss anything related to climate change.
              </p>
              <div style={{ marginTop: 18, width: "100%" }}>
                {sideMessages.map((msg, idx) => (
                  <div key={idx} style={{ marginBottom: 18, width: "100%" }}>
                    <div
                      style={{
                        fontSize: 13.5,
                        color: "#9BC53D",
                        marginBottom: 4,
                        fontWeight: 500,
                        whiteSpace: "pre-line",
                        wordBreak: "break-word",
                        maxWidth: "100%",
                        width: "100%",
                        overflowWrap: "break-word",
                      }}
                    >
                      {msg.user}
                    </div>
                    {/* Side logs display per message idx - always visible */}
                    <LogsDisplay logs={sideLogs[idx]} />
                    {msg.chunks && msg.chunks.map((chunk, chunkIdx) => (
                      <div
                        key={chunkIdx}
                        style={{
                          fontSize: 15.5,
                          color: "#D9EAFD",
                          background: cardBg,
                          padding: "0.7rem 1rem",
                          borderRadius: 7,
                          boxShadow: "0 1px 4px 0 #1a237e0e",
                          marginBottom: 8,
                          overflowWrap: "break-word",
                          wordBreak: "break-word",
                          maxWidth: "100%",
                          width: "100%",
                          whiteSpace: "pre-line",
                          overflow: "hidden",
                          boxSizing: "border-box",
                          display: "block"
                        }}
                      >
                        <ReactMarkdown
                          components={{
                            p: ({ node, ...props }) => <p {...props} style={{ margin: "0 0 10px 0", wordBreak: "break-word", overflowWrap: "break-word" }} />,
                            ul: ({ node, ...props }) => <ul {...props} style={{ margin: "0 0 10px 1.2em", paddingLeft: "1.2em" }} />,
                            ol: ({ node, ...props }) => <ol {...props} style={{ margin: "0 0 10px 1.2em", paddingLeft: "1.2em" }} />,
                            li: ({ node, ...props }) => <li {...props} style={{ marginBottom: "0.2em", wordBreak: "break-word", overflowWrap: "break-word" }} />,
                            a: ({ node, ...props }) => <a {...props} style={{ color: "#9BC53D", wordBreak: "break-all" }} target="_blank" rel="noopener noreferrer" />,
                            table: ({ node, ...props }) => <table {...props} style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0" }} />,
                            th: ({ node, ...props }) => <th {...props} style={{ border: "1px solid #9BC53D", padding: "4px", background: "#2c3e50" }} />,
                            td: ({ node, ...props }) => <td {...props} style={{ border: "1px solid #9BC53D", padding: "4px" }} />,
                            code: ({ node, ...props }) => <code {...props} style={{ background: "#1e2b34", color: "#9BC53D", borderRadius: "4px", padding: "1px 4px" }} />
                          }}
                        >
                          {chunk}
                        </ReactMarkdown>
                      </div>
                    ))}
                    {sideTypingIdx === idx && sideTypingCurrentChunk && (
                      <div
                        style={{
                          fontSize: 15.5,
                          color: "#D9EAFD",
                          background: cardBg,
                          padding: "0.7rem 1rem",
                          borderRadius: 7,
                          boxShadow: "0 1px 4px 0 #1a237e0e",
                          fontStyle: "italic",
                          overflowWrap: "break-word",
                          wordBreak: "break-word",
                          maxWidth: "100%",
                          width: "100%",
                          marginBottom: 8,
                          whiteSpace: "pre-line",
                          overflow: "hidden",
                          boxSizing: "border-box",
                        }}
                      >
                        <ReactMarkdown>{sideTypingCurrentChunk}</ReactMarkdown>
                        <span className="blinking-cursor" style={{ color: "#9BC53D" }}>|</span>
                      </div>
                    )}
                    {!msg.chunks?.length && sideTypingIdx !== idx && !sideLoading && (
                      <div
                        style={{
                          fontSize: 15,
                          color: "#D9EAFD",
                          padding: "0.7rem 1rem",
                        }}
                      >
                        Loading...
                      </div>
                    )}
                  </div>
                ))}
                <div ref={sidebarBottomRef} />
              </div>
            </div>
            {/* Side panel query input and send button */}
            <form
              style={{
                width: "100%",
                background: cardAlt,
                padding: "1rem 1.2rem",
                borderTop: `1px solid ${cardBg}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                maxWidth: "100vw",
              }}
              onSubmit={handleSendSide}
              autoComplete="off"
            >
              <input
                id="side-query-input"
                style={{
                  border: "none",
                  background: inputBg,
                  borderRadius: 6,
                  fontSize: 16,
                  padding: "0.6rem 1rem",
                  flex: 1,
                  outline: "none",
                  boxShadow: "0 0.5px 7px 0 rgba(60,64,67,0.07)",
                  color: textMain,
                  maxWidth: "calc(100vw - 120px)",
                }}
                type="text"
                placeholder="Type a message..."
                value={sideInput}
                onChange={(e) => setSideInput(e.target.value)}
                disabled={sideLoading}
              />
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: "0 0 0 10px",
                  cursor: !sideInput.trim() || sideLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                type="submit"
                aria-label="Send"
                disabled={!sideInput.trim() || sideLoading}
                tabIndex={0}
              >
                <svg height={22} width={22} viewBox="0 0 20 20" fill={sideInput.trim() ? "#9BC53D" : "#b0b8c1"}>
                  <path d="M2.01 10.384l14.093-6.246c.822-.364 1.621.435 1.257 1.257l-6.247 14.093c-.367.829-1.553.834-1.926.008l-2.068-4.683a.65.65 0 0 1 .276-.827l6.624-3.883-7.222 2.937a.65.65 0 0 ..." />
                </svg>
              </button>
            </form>
          </>
        )}
      </aside>
    </div>
  );
}

// Helper for rendering sidebar responses (unchanged, but referenced above)
function renderSidebarResponse(data) {
  if (typeof data === "string") return data;
  if (!data) return "";
  if (typeof data === "object") {
    if (data.text) return data.text;
    if (data.final_response) return data.final_response;
    if (Array.isArray(data.sub_answers)) return data.sub_answers.join("\n\n---\n\n");
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}