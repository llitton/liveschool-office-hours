/**
 * Converts plain text with common formatting patterns to proper HTML
 *
 * Handles:
 * - <<text>> or **text** → <strong>text</strong>
 * - Lines starting with 1., 2., etc. → <ol><li>
 * - Lines starting with - or * → <ul><li>
 * - Double line breaks → paragraph breaks
 * - Single line breaks within paragraphs → preserved
 */
export function convertPlainTextToHtml(text: string): string {
  if (!text || text.trim() === '') return '';

  // If it already looks like HTML, return as-is
  if (text.includes('<p>') || text.includes('<ol>') || text.includes('<ul>')) {
    return text;
  }

  // Split into lines
  const lines = text.split('\n');
  const result: string[] = [];
  let inOrderedList = false;
  let inUnorderedList = false;
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join('<br>');
      result.push(`<p>${formatInlineStyles(content)}</p>`);
      currentParagraph = [];
    }
  };

  const closeList = () => {
    if (inOrderedList) {
      result.push('</ol>');
      inOrderedList = false;
    }
    if (inUnorderedList) {
      result.push('</ul>');
      inUnorderedList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Empty line - close current context
    if (trimmedLine === '') {
      flushParagraph();
      closeList();
      continue;
    }

    // Check for ordered list item (1., 2., etc.)
    const orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (inUnorderedList) {
        result.push('</ul>');
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        result.push('<ol>');
        inOrderedList = true;
      }
      result.push(`<li>${formatInlineStyles(orderedMatch[2])}</li>`);
      continue;
    }

    // Check for unordered list item (- or *)
    const unorderedMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (inOrderedList) {
        result.push('</ol>');
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        result.push('<ul>');
        inUnorderedList = true;
      }
      result.push(`<li>${formatInlineStyles(unorderedMatch[1])}</li>`);
      continue;
    }

    // Regular text - add to current paragraph
    closeList();
    currentParagraph.push(trimmedLine);
  }

  // Flush any remaining content
  flushParagraph();
  closeList();

  return result.join('');
}

/**
 * Format inline styles like bold
 */
function formatInlineStyles(text: string): string {
  // Convert <<text>> to bold
  text = text.replace(/<<([^>]+)>>/g, '<strong>$1</strong>');

  // Convert **text** to bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Convert *text* to italic (but not if it's **)
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Convert _text_ to italic
  text = text.replace(/_([^_]+)_/g, '<em>$1</em>');

  return text;
}

/**
 * Check if text appears to be plain text (not HTML)
 */
export function isPlainText(text: string): boolean {
  if (!text) return true;

  // Check for common HTML tags
  const htmlPattern = /<(p|ol|ul|li|strong|em|br|div|span)[^>]*>/i;
  return !htmlPattern.test(text);
}
