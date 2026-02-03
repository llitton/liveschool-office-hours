# Email Templates

## Template Functions
Use template functions from `src/lib/email-html.ts`:
- `generateConfirmationEmailHtml()` - Booking confirmations
- `generateReminderEmailHtml()` - Day-before and hour-before reminders
- `generateFollowupEmailHtml()` - Post-session thank you / we missed you
- `generateFeedbackEmailHtml()` - Feedback request emails
- `generateRecordingEmailHtml()` - Recording notification emails
- `generateCancellationEmailHtml()` - Booking cancellation notifications

## Design Rules
- **Unicode emoji for icons:** Gmail blocks SVG data URIs - use Unicode characters instead of images
- **Table-based layout:** HTML tables for layout, not flexbox/grid - max compatibility
- **Inline styles only:** No `<style>` blocks or external stylesheets
- **Mobile-first:** 44px minimum touch targets, responsive width with max-width
- **Visual hierarchy:** Hero section with confirmation badge, prominent session details
- **XSS prevention:** All user-provided strings must be escaped via `escapeHtml()` before embedding

## Template Variants

**Confirmation:** Session details, calendar buttons (Google, Outlook, Apple), prep checklist if materials exist

**Follow-up (`generateFollowupEmailHtml`):**
- Two variants: "Thanks for joining!" (attended) and "We missed you!" (no-show)
- Header: Purple for attended, amber for no-shows
- Resources section: Recording, deck, shared links (attended only)
- CTA: "Watch Recording" (green) + "Book Another Session"

**Feedback (`generateFeedbackEmailHtml`):**
- Purple header with "How was your session?"
- CTA: "Share Feedback" button

**Recording (`generateRecordingEmailHtml`):**
- Green header with "Your Recording is Ready!"
- CTA: "Watch Recording" button
- Optional deck/shared links and booking link

**Cancellation (`generateCancellationEmailHtml`):**
- Gray header with strikethrough date/time
- Optional custom message from admin
- CTA: "Book Another Session"

## Email Templates Page UX
`/admin/events/[id]/emails` uses live side-by-side editor:
- Left panel: Edit subject/body with template variables
- Right panel: Live styled preview updates instantly
- Variable chips for quick insertion
- No mode switching - preview always visible
