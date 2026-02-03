# UX Patterns

## Round-Robin & Collective Events
- **No single host:** Don't show host name/email fields - host assigned dynamically
- **Maximum coverage:** Show ALL slots where ANY team member is available
- **Recommended strategy:** "Load Balanced" (least_bookings) for most use cases

## Form Validation
- Validate unique fields (slugs) in real-time with debounced API checks (400ms)
- Show visual feedback: green check when valid, red X with suggestions when taken
- Disable submit until validation passes
- Provide clickable alternatives when value is taken

## Multi-line Input
- Preserve user input while typing (don't filter in `onChange`)
- Clean up on blur (filter empty lines in `onBlur`)

## Dashboard & Card Design
- **Copy Link is primary action** - most prominent button
- **Whole card is clickable** - no competing click targets
- **Status badges need contrast** - borders and bolder colors for accessibility
- **Sticky footers for long forms** - keep Save/Cancel visible
- **Dismissible alerts** - stored in localStorage with 24-hour expiry

## Events Page (Admin Dashboard)
- Two-column grid (`lg:grid-cols-2`)
- Compact cards (p-4), condensed analytics
- Debounced search (300ms), meeting type tabs
- Grid/List toggle (localStorage), Host avatar stacks
- Bulk selection with floating action bar
- Drag-and-drop reordering via `@dnd-kit` (only when no filters active)
- Status colors: emerald=Active, red=Fully booked, amber=Almost full, gray=Disabled
- Dimmed inactive cards (60% opacity)

## Today's Sessions
- Collapsible attendee list (first 3 inline, "View All" for 4+)
- Prominent Join Meet button (large, shadow, `px-4 py-2.5`)
- Reminder status badges (green=sent, gray=pending)
- Compact rows for empty/past sessions

## Event Details Page (`/admin/events/[id]`)
- Sticky header with title, status, quick actions (`sticky top-0 z-30`)
- Session health metrics (avg rating, attendance rate)
- "Add Time Slots" uses dashed border + gradient background
- Collapsible past sessions (most recent expanded by default)
- Attendance pills: Green=attended, Red=no-show, Amber=unmarked
- Attendee badges: Blue=New, Purple=Returning, Green=Frequent, Red=high no-show
- Search input appears when >5 attendees
- Session topics section for upcoming slots

## Event Settings Page
- Sidebar navigation highlighting active section on scroll
- Sticky action bar at bottom
- Live preview panel (right side)
- Buffer timeline visualization
- Priority weight sliders (1-10) with percentage preview

## Team/People Page
- Compact table layout (not cards)
- Collapsible add form (hidden by default)
- Status badges with dots (green=Active, amber=Pending)
- Invitation timestamps ("Invited Xd ago")
- Responsive columns (hide less critical on mobile)

## Public Booking Page
- Minimum 2 time slots on initial load
- Progressive disclosure with "Show more days" button
- 650px max-width for comfortable reading

## Booking Confirmation Page
- Large success indicator (80x80px checkmark)
- Email verification pill (high-contrast)
- "Made a mistake?" link near top
- Calendar buttons: Google, Outlook, Apple (.ics)
- Copy Meeting Link as primary action
- All buttons minimum 52px height

## Visual Consistency
- Same action = same color (brand purple #6F71EE)
- Don't mix brand colors for side-by-side elements
- Touch targets: 44px minimum
