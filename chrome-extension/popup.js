// Configuration
const API_BASE_URL = 'https://liveschoolhelp.com';
// const API_BASE_URL = 'http://localhost:3000'; // For development

// DOM Elements
const loadingEl = document.getElementById('loading');
const setupEl = document.getElementById('setup');
const errorEl = document.getElementById('error');
const eventsEl = document.getElementById('events');
const userInfoEl = document.getElementById('userInfo');
const eventsListEl = document.getElementById('eventsList');
const noResultsEl = document.getElementById('noResults');
const emptyEl = document.getElementById('empty');
const searchInput = document.getElementById('searchInput');
const toastEl = document.getElementById('toast');
const errorMessageEl = document.getElementById('errorMessage');

// State
let allEvents = [];

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Set up event listeners
  document.getElementById('openSettings').addEventListener('click', openSettings);
  document.getElementById('settingsLink').addEventListener('click', openSettings);
  document.getElementById('retry').addEventListener('click', loadEvents);
  searchInput.addEventListener('input', handleSearch);

  // Load events
  await loadEvents();
}

async function loadEvents() {
  showState('loading');

  try {
    // Get token from storage
    const { quickLinksToken } = await chrome.storage.sync.get('quickLinksToken');

    if (!quickLinksToken) {
      showState('setup');
      return;
    }

    // Fetch events from API
    const response = await fetch(`${API_BASE_URL}/api/my-links/${quickLinksToken}`);

    if (!response.ok) {
      if (response.status === 404) {
        // Token is invalid, clear it
        await chrome.storage.sync.remove('quickLinksToken');
        showState('setup');
        return;
      }
      throw new Error('Failed to load events');
    }

    const data = await response.json();

    // Store events and render
    allEvents = data.events || [];

    // Render user info
    renderUserInfo(data.admin);

    // Render events
    if (allEvents.length === 0) {
      showState('events');
      eventsListEl.classList.add('hidden');
      emptyEl.classList.remove('hidden');
    } else {
      renderEvents(allEvents);
      showState('events');
    }
  } catch (err) {
    console.error('Error loading events:', err);
    errorMessageEl.textContent = err.message || 'Failed to load events';
    showState('error');
  }
}

function showState(state) {
  loadingEl.classList.add('hidden');
  setupEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  eventsEl.classList.add('hidden');

  switch (state) {
    case 'loading':
      loadingEl.classList.remove('hidden');
      break;
    case 'setup':
      setupEl.classList.remove('hidden');
      break;
    case 'error':
      errorEl.classList.remove('hidden');
      break;
    case 'events':
      eventsEl.classList.remove('hidden');
      break;
  }
}

function renderUserInfo(admin) {
  if (!admin) return;

  const initial = (admin.name || admin.email || '?')[0].toUpperCase();
  const avatarContent = admin.profile_image
    ? `<img src="${admin.profile_image}" alt="">`
    : initial;

  userInfoEl.innerHTML = `
    <div class="user-avatar">${avatarContent}</div>
    <div class="user-details">
      <div class="user-name">${admin.name || admin.email.split('@')[0]}</div>
      <div class="user-email">${admin.email}</div>
    </div>
  `;
}

function renderEvents(events) {
  eventsListEl.innerHTML = '';
  noResultsEl.classList.add('hidden');
  emptyEl.classList.add('hidden');

  if (events.length === 0) {
    if (searchInput.value.trim()) {
      noResultsEl.classList.remove('hidden');
    } else {
      emptyEl.classList.remove('hidden');
    }
    return;
  }

  events.forEach(event => {
    const card = createEventCard(event);
    eventsListEl.appendChild(card);
  });
}

function createEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.dataset.eventId = event.id;

  const icon = getMeetingTypeIcon(event.meeting_type);
  const badge = getMeetingTypeBadge(event.meeting_type);

  card.innerHTML = `
    <div class="event-header">
      <div class="event-icon">${icon}</div>
      <div class="event-info">
        <div class="event-name">${escapeHtml(event.name)}</div>
        <div class="event-meta">
          <span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
            ${event.duration_minutes} min
          </span>
          ${badge}
          ${event.upcoming_slots > 0 ? `
            <span style="color: #059669;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${event.upcoming_slots}
            </span>
          ` : ''}
        </div>
      </div>
    </div>
    <div class="event-actions">
      <button class="btn-copy" data-url="${escapeHtml(event.booking_url)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
        </svg>
        Copy Link
      </button>
      <a href="${escapeHtml(event.booking_url)}" target="_blank" class="btn-open">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        Open
      </a>
    </div>
    <div class="event-url">${escapeHtml(event.booking_url)}</div>
  `;

  // Add copy event listener
  const copyBtn = card.querySelector('.btn-copy');
  copyBtn.addEventListener('click', () => copyToClipboard(event.booking_url, copyBtn));

  return card;
}

function getMeetingTypeIcon(type) {
  switch (type) {
    case 'one_on_one':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>`;
    case 'group':
    case 'webinar':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/>
        <path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>`;
    case 'round_robin':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M23 4v6h-6"/>
        <path d="M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>`;
    case 'collective':
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M16 12a4 4 0 01-8 0"/>
        <path d="M9 9h.01"/>
        <path d="M15 9h.01"/>
      </svg>`;
    default:
      return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>`;
  }
}

function getMeetingTypeBadge(type) {
  const labels = {
    one_on_one: { label: '1:1', class: 'badge-one-on-one' },
    group: { label: 'Group', class: 'badge-group' },
    round_robin: { label: 'Round Robin', class: 'badge-round-robin' },
    collective: { label: 'Collective', class: 'badge-collective' },
    webinar: { label: 'Webinar', class: 'badge-group' },
  };

  const config = labels[type] || { label: type, class: '' };
  return `<span class="badge ${config.class}">${config.label}</span>`;
}

function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();

  if (!query) {
    renderEvents(allEvents);
    return;
  }

  const filtered = allEvents.filter(event =>
    event.name.toLowerCase().includes(query) ||
    event.slug.toLowerCase().includes(query) ||
    (event.subtitle && event.subtitle.toLowerCase().includes(query))
  );

  renderEvents(filtered);
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);

    // Update button state
    const originalHtml = button.innerHTML;
    button.classList.add('copied');
    button.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
      Copied!
    `;

    // Show toast
    showToast();

    // Reset after 2 seconds
    setTimeout(() => {
      button.classList.remove('copied');
      button.innerHTML = originalHtml;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function showToast() {
  toastEl.classList.remove('hidden');
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2000);
}

function openSettings(e) {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
