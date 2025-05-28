"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function Card({ card }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get rating color based on score
  const getRatingColor = (rating) => {
    if (rating >= 80) return 'bg-[#7FB069]'; // Green
    if (rating >= 60) return 'bg-[#9BC53D]'; // Light green
    if (rating >= 40) return 'bg-[#FFA500]'; // Orange
    return 'bg-[#FF6B6B]'; // Red
  };

  // Truncate text for preview
  const truncateText = (text, maxLength = 200) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div 
      className="w-full rounded-xl shadow-lg border p-4 sm:p-6 mb-4 transition-all duration-200 hover:shadow-xl bg-[#384D48] border-[#4A5D57]"
    >
      {/* Header with Rating and Date */}
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Rating Circle */}
          <div 
            className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-base sm:text-lg shadow-lg text-[#1A2B24] ${getRatingColor(card.rating)}`}
          >
            {card.rating}
          </div>
          <div>
            <div className="text-xs sm:text-sm font-medium text-[#D0D0D0]">
              Analysis Score
            </div>
            <div className="text-[10px] sm:text-xs text-[#B0B0B0]">
              {formatDate(card.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Text */}
      <div className="mb-4 sm:mb-6">
        <h3 className="text-md sm:text-lg font-semibold mb-2 sm:mb-3 text-[#F5F5F5]">
          Analysis
        </h3>
        <div 
          className="leading-relaxed text-sm sm:text-base text-[#E8E8E8]"
        >
          {isExpanded ? card.text : truncateText(card.text)}
          {card.text && card.text.length > 200 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="ml-2 text-sm font-medium hover:underline transition-colors duration-200 text-[#9BC53D]"
            >
              {isExpanded ? 'Show Less' : 'Read More'}
            </button>
          )}
        </div>
      </div>

      {/* Citations */}
      {card.citations && card.citations.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <h4 className="text-sm sm:text-base font-semibold mb-2 sm:mb-3 text-[#F5F5F5]">
            Sources & Citations
          </h4>
          <div className="grid gap-1 sm:gap-2">
            {card.citations.map((citation, index) => (
              <a
                key={index}
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center p-2 sm:p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] group bg-[#4A5D57] border-[#6B7A73]"
              >
                <div className="flex-1 min-w-0"> {/* Added min-w-0 for better truncation handling */}
                  <div 
                    className="text-sm group-hover:underline text-[#F5F5F5] truncate" // Added truncate here for long labels
                  >
                    {citation.label}
                  </div>
                  <div 
                    className="text-xs sm:text-sm mt-1 truncate text-[#B0B0B0]"
                  >
                    {citation.url}
                  </div>
                </div>
                <div 
                  className="ml-2 sm:ml-3 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-[#7FB069] text-[#1A2B24] flex-shrink-0" // Added flex-shrink-0
                >
                  Source
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {card.recommendations && card.recommendations.length > 0 && (
        <div className="mb-6">
          <h4 className="text-base font-semibold mb-3 text-[#F5F5F5]">
            Recommended Products
          </h4>
          <div className="grid gap-2">
            {card.recommendations.map((rec, index) => (
              <a
                key={index}
                href={rec.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02] group bg-[#4A5D57] border-[#6B7A73]"
              >
                <div className="flex-1">
                  <div 
                    className="font-medium group-hover:underline text-[#F5F5F5]"
                  >
                    {rec.label}
                  </div>
                  <div 
                    className="text-sm mt-1 truncate text-[#B0B0B0]"
                  >
                    {rec.url}
                  </div>
                </div>
                <div 
                  className="ml-3 text-xs px-2 py-1 rounded bg-[#9BC53D] text-[#1A2B24]"
                >
                  Product
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Questions */}
      {card.suggestedQuestions && card.suggestedQuestions.length > 0 && (
        <div>
          <h4 className="text-base font-semibold mb-3 text-[#F5F5F5]">
            Suggested Questions
          </h4>
          <div className="space-y-2">
            {(showAllQuestions ? card.suggestedQuestions : card.suggestedQuestions.slice(0, 3)).map((question, index) => (
              <button
                key={index}
                className="w-full text-left p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01] group bg-[#4A5D57] border-[#6B7A73]"
                onClick={() => {
                  // You can add functionality here to handle question clicks
                  console.log('Question clicked:', question);
                }}
              >
                <div 
                  className="font-medium group-hover:underline text-[#F5F5F5]"
                >
                  {question}
                </div>
              </button>
            ))}
            
            {card.suggestedQuestions.length > 3 && (
              <button
                onClick={() => setShowAllQuestions(!showAllQuestions)}
                className="w-full text-center py-2 text-sm font-medium hover:underline transition-colors duration-200 text-[#9BC53D]"
              >
                {showAllQuestions ? 'Show Less' : `Show ${card.suggestedQuestions.length - 3} More Questions`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}