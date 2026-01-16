'use client';

import React from 'react';

interface SimpleMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown renderer for basic formatting:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - Bullet lists (lines starting with - or •)
 * - Line breaks preserved
 */
export default function SimpleMarkdown({ content, className = '' }: SimpleMarkdownProps) {
  if (!content) return null;

  // Process the content line by line
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let currentList: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc list-inside space-y-1 my-2">
          {currentList.map((item, i) => (
            <li key={i}>{formatInlineText(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInlineText = (text: string): React.ReactElement => {
    // Process bold and italic
    // Bold: **text** or __text__
    // Italic: *text* or _text_ (but not inside words)

    const parts: (string | React.ReactElement)[] = [];
    let remaining = text;
    let partKey = 0;

    // Process bold first (**text** or __text__)
    const boldRegex = /(\*\*|__)([^*_]+)\1/g;
    let lastIndex = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push(<strong key={`bold-${partKey++}`}>{match[2]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    // Now process italic in the remaining string parts
    const processedParts: (string | React.ReactElement)[] = [];
    for (const part of parts) {
      if (typeof part === 'string') {
        const italicRegex = /(\*|_)([^*_]+)\1/g;
        let italicLastIndex = 0;
        let italicMatch;

        while ((italicMatch = italicRegex.exec(part)) !== null) {
          if (italicMatch.index > italicLastIndex) {
            processedParts.push(part.slice(italicLastIndex, italicMatch.index));
          }
          processedParts.push(<em key={`italic-${partKey++}`}>{italicMatch[2]}</em>);
          italicLastIndex = italicMatch.index + italicMatch[0].length;
        }

        if (italicLastIndex < part.length) {
          processedParts.push(part.slice(italicLastIndex));
        }
      } else {
        processedParts.push(part);
      }
    }

    return <>{processedParts}</>;
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    // Check if line is a bullet point
    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ') || trimmedLine.startsWith('* ')) {
      currentList.push(trimmedLine.slice(2));
    } else {
      // Flush any pending list
      flushList();

      if (trimmedLine === '') {
        // Empty line - add spacing
        elements.push(<div key={`space-${index}`} className="h-2" />);
      } else {
        // Regular paragraph
        elements.push(
          <p key={`p-${index}`} className="my-1">
            {formatInlineText(trimmedLine)}
          </p>
        );
      }
    }
  });

  // Flush any remaining list items
  flushList();

  return <div className={className}>{elements}</div>;
}
