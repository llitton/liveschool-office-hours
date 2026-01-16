/**
 * LiveSchool Connect - Embed SDK
 * Embed booking widgets on any website
 */
(function() {
  'use strict';

  // Get the base URL from the script src
  var scripts = document.getElementsByTagName('script');
  var currentScript = scripts[scripts.length - 1];
  var scriptSrc = currentScript.src;
  var BASE_URL = scriptSrc.substring(0, scriptSrc.indexOf('/embed/liveschool-embed.js'));

  // Event callbacks registry
  var callbacks = {};

  /**
   * Build iframe URL with options
   */
  function buildEmbedUrl(slug, options) {
    var params = new URLSearchParams();
    params.set('parentOrigin', window.location.origin);

    if (options.hideHeader) params.set('hideHeader', 'true');
    if (options.hideBranding) params.set('hideBranding', 'true');
    if (options.primaryColor) params.set('primaryColor', options.primaryColor);
    if (options.prefill) {
      try {
        params.set('prefill', btoa(JSON.stringify(options.prefill)));
      } catch (e) {
        console.warn('LiveSchool: Failed to encode prefill data');
      }
    }
    if (options.host) params.set('host', options.host);

    return BASE_URL + '/embed/' + slug + '?' + params.toString();
  }

  /**
   * Create an iframe element
   */
  function createIframe(slug, options) {
    var iframe = document.createElement('iframe');
    iframe.src = buildEmbedUrl(slug, options);
    iframe.style.cssText = 'width:100%;border:none;min-height:400px;';
    iframe.setAttribute('allow', 'camera; microphone');
    iframe.setAttribute('loading', 'lazy');
    return iframe;
  }

  /**
   * Handle messages from embed iframe
   */
  function handleMessage(event) {
    // Verify origin (allow from same domain)
    if (!event.origin.includes(new URL(BASE_URL).host)) return;

    var data = event.data;
    if (!data || !data.type) return;

    switch (data.type) {
      case 'liveschool:resize':
        // Find the iframe that sent this message and resize it
        var iframes = document.querySelectorAll('iframe[src*="/embed/"]');
        iframes.forEach(function(iframe) {
          if (iframe.contentWindow === event.source && data.height) {
            iframe.style.height = data.height + 'px';
          }
        });
        break;

      case 'liveschool:bookingComplete':
        // Fire registered callbacks
        if (callbacks.onBookingComplete) {
          callbacks.onBookingComplete(data.data);
        }
        // Fire instance-specific callbacks
        if (window._liveschoolCallbacks) {
          window._liveschoolCallbacks.forEach(function(cb) {
            if (cb.onBookingComplete) cb.onBookingComplete(data.data);
          });
        }
        break;

      case 'liveschool:close':
        // Close popup if open
        closePopup();
        if (callbacks.onClose) {
          callbacks.onClose();
        }
        break;
    }
  }

  // Listen for messages from iframes
  window.addEventListener('message', handleMessage);

  /**
   * Initialize inline embed
   */
  function inline(targetId, options) {
    options = options || {};

    if (!options.slug) {
      console.error('LiveSchool: slug is required');
      return;
    }

    var target = document.getElementById(targetId);
    if (!target) {
      console.error('LiveSchool: Target element "' + targetId + '" not found');
      return;
    }

    // Store callbacks
    if (!window._liveschoolCallbacks) {
      window._liveschoolCallbacks = [];
    }
    window._liveschoolCallbacks.push({
      onBookingComplete: options.onBookingComplete,
      onClose: options.onClose
    });

    var iframe = createIframe(options.slug, options);
    target.innerHTML = '';
    target.appendChild(iframe);

    return {
      iframe: iframe,
      destroy: function() {
        target.innerHTML = '';
      }
    };
  }

  /**
   * Popup modal state
   */
  var popupOverlay = null;
  var popupContainer = null;

  /**
   * Close popup modal
   */
  function closePopup() {
    if (popupOverlay) {
      document.body.removeChild(popupOverlay);
      popupOverlay = null;
      popupContainer = null;
      document.body.style.overflow = '';
    }
  }

  /**
   * Open popup modal
   */
  function popup(options) {
    options = options || {};

    if (!options.slug) {
      console.error('LiveSchool: slug is required');
      return;
    }

    // Close any existing popup
    closePopup();

    // Store callbacks
    callbacks.onBookingComplete = options.onBookingComplete;
    callbacks.onClose = options.onClose;

    // Create overlay
    popupOverlay = document.createElement('div');
    popupOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';

    // Create container
    popupContainer = document.createElement('div');
    popupContainer.style.cssText = 'background:#fff;border-radius:12px;width:100%;max-width:500px;max-height:90vh;overflow:hidden;position:relative;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);';

    // Create close button
    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute;top:8px;right:8px;width:32px;height:32px;border:none;background:#f0f0f0;border-radius:50%;cursor:pointer;font-size:20px;line-height:1;z-index:10;color:#666;';
    closeBtn.onclick = closePopup;

    // Create iframe wrapper (for scroll)
    var iframeWrapper = document.createElement('div');
    iframeWrapper.style.cssText = 'max-height:calc(90vh - 40px);overflow-y:auto;';

    var iframe = createIframe(options.slug, options);
    iframe.style.minHeight = '500px';

    iframeWrapper.appendChild(iframe);
    popupContainer.appendChild(closeBtn);
    popupContainer.appendChild(iframeWrapper);
    popupOverlay.appendChild(popupContainer);

    // Close on overlay click
    popupOverlay.addEventListener('click', function(e) {
      if (e.target === popupOverlay) {
        closePopup();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', function onEscape(e) {
      if (e.key === 'Escape') {
        closePopup();
        document.removeEventListener('keydown', onEscape);
      }
    });

    document.body.appendChild(popupOverlay);
    document.body.style.overflow = 'hidden';

    return {
      close: closePopup
    };
  }

  /**
   * Register global event callback
   */
  function on(event, callback) {
    if (event === 'bookingComplete') {
      callbacks.onBookingComplete = callback;
    } else if (event === 'close') {
      callbacks.onClose = callback;
    }
  }

  // Expose API
  window.LiveSchool = {
    inline: inline,
    popup: popup,
    on: on,
    close: closePopup
  };

  // Auto-initialize elements with data attributes
  document.addEventListener('DOMContentLoaded', function() {
    // Auto-init inline embeds
    var inlineElements = document.querySelectorAll('[data-liveschool-inline]');
    inlineElements.forEach(function(el) {
      var slug = el.getAttribute('data-liveschool-inline');
      if (slug) {
        inline(el.id || 'liveschool-' + Math.random().toString(36).substr(2, 9), {
          slug: slug,
          hideHeader: el.getAttribute('data-hide-header') === 'true',
          hideBranding: el.getAttribute('data-hide-branding') === 'true'
        });
      }
    });

    // Auto-init popup triggers
    var popupTriggers = document.querySelectorAll('[data-liveschool-popup]');
    popupTriggers.forEach(function(el) {
      var slug = el.getAttribute('data-liveschool-popup');
      if (slug) {
        el.addEventListener('click', function(e) {
          e.preventDefault();
          popup({
            slug: slug,
            hideHeader: el.getAttribute('data-hide-header') === 'true',
            hideBranding: el.getAttribute('data-hide-branding') === 'true'
          });
        });
      }
    });
  });
})();
