// Configuration
const API_BASE_URL = 'https://liveschoolhelp.com';
// const API_BASE_URL = 'http://localhost:3000'; // For development

// DOM Elements
const connectedCard = document.getElementById('connectedCard');
const setupCard = document.getElementById('setupCard');
const tokenInput = document.getElementById('tokenInput');
const saveBtn = document.getElementById('saveBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const messageEl = document.getElementById('message');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Set up event listeners
  saveBtn.addEventListener('click', handleSave);
  disconnectBtn.addEventListener('click', handleDisconnect);
  tokenInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSave();
  });

  // Check if already connected
  await checkConnection();
}

async function checkConnection() {
  const { quickLinksToken } = await chrome.storage.sync.get('quickLinksToken');

  if (quickLinksToken) {
    // Verify token is still valid
    try {
      const response = await fetch(`${API_BASE_URL}/api/my-links/${quickLinksToken}`);
      if (response.ok) {
        showConnected();
        return;
      }
    } catch (err) {
      console.error('Error verifying token:', err);
    }

    // Token is invalid, clear it
    await chrome.storage.sync.remove('quickLinksToken');
  }

  showSetup();
}

function showConnected() {
  connectedCard.classList.remove('hidden');
  setupCard.classList.add('hidden');
}

function showSetup() {
  connectedCard.classList.add('hidden');
  setupCard.classList.remove('hidden');
}

async function handleSave() {
  const token = tokenInput.value.trim();

  if (!token) {
    showMessage('Please enter your token', 'error');
    return;
  }

  if (token.length < 20) {
    showMessage('Token seems too short. Please check and try again.', 'error');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Connecting...';
  hideMessage();

  try {
    // Verify token by calling the API
    const response = await fetch(`${API_BASE_URL}/api/my-links/${token}`);

    if (!response.ok) {
      if (response.status === 404) {
        showMessage('Invalid token. Please check your token and try again.', 'error');
      } else {
        showMessage('Failed to verify token. Please try again.', 'error');
      }
      return;
    }

    const data = await response.json();

    // Save token
    await chrome.storage.sync.set({ quickLinksToken: token });

    showMessage(`Connected as ${data.admin.name || data.admin.email}!`, 'success');

    // Switch to connected view after a moment
    setTimeout(() => {
      showConnected();
    }, 1500);

  } catch (err) {
    console.error('Error saving token:', err);
    showMessage('Failed to connect. Please check your internet connection.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Connect Account';
  }
}

async function handleDisconnect() {
  if (!confirm('Are you sure you want to disconnect your account?')) {
    return;
  }

  await chrome.storage.sync.remove('quickLinksToken');
  tokenInput.value = '';
  showSetup();
}

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.classList.remove('hidden');
}

function hideMessage() {
  messageEl.classList.add('hidden');
}
