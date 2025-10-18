/**
 * Directory Entry Schema and Validation
 * Implements NIP-99 classified listings (kind 30402) for directory entries
 */

// Directory entry categories
export const DIRECTORY_CATEGORIES = {
  BUSINESS: 'business',
  SERVICE: 'service',
  COMMUNITY: 'community',
  EDUCATION: 'education',
  TECHNOLOGY: 'technology',
  HEALTH: 'health',
  ENTERTAINMENT: 'entertainment',
  OTHER: 'other'
};

// Payment configuration
export const PAYMENT_CONFIG = {
  ENTRY_PRICE_SATS: 1000, // 1000 sats = ~$0.30 at current rates
  CURRENCY: 'BTC',
  RELAY_PUBKEY: '9630f464cca6a5147aa8a35f0bcdd3ce485324e732fd39e09233b1d848238f31', // Replace with your relay's pubkey
  RELAYS: ['wss://relay.yourdomain.com', 'wss://backup-relay.com']
};

/**
 * Creates a NIP-99 compliant directory entry event
 */
export function createDirectoryEntry(formData, userPubkey) {
  const now = Math.floor(Date.now() / 1000);
  
  // Generate unique identifier for this entry
  const entryId = `directory-${userPubkey.slice(0, 8)}-${now}`;
  
  const event = {
    kind: 30402, // NIP-99 classified listing
    pubkey: userPubkey,
    created_at: now,
    content: formData.description,
    tags: [
      ['d', entryId], // Addressable event identifier
      ['title', formData.title],
      ['summary', formData.summary],
      ['published_at', now.toString()],
      ['location', formData.location || ''],
      ['t', formData.category], // Category tag
      ['status', 'pending'], // Will be changed to 'active' after payment
    ]
  };

  // Add optional tags
  if (formData.website) {
    event.tags.push(['r', formData.website]);
  }
  
  if (formData.contact) {
    event.tags.push(['contact', formData.contact]);
  }

  if (formData.images && formData.images.length > 0) {
    formData.images.forEach(img => {
      event.tags.push(['image', img.url, img.dimensions || '']);
    });
  }

  // Add hashtags
  if (formData.hashtags && formData.hashtags.length > 0) {
    formData.hashtags.forEach(tag => {
      event.tags.push(['t', tag.toLowerCase()]);
    });
  }

  return event;
}

/**
 * Creates a zap request for directory entry payment
 */
export function createDirectoryZapRequest(directoryEvent, userPubkey, amount = PAYMENT_CONFIG.ENTRY_PRICE_SATS) {
  const now = Math.floor(Date.now() / 1000);
  
  const zapRequest = {
    kind: 9734, // NIP-57 zap request
    pubkey: userPubkey,
    created_at: now,
    content: `Payment for directory entry: ${directoryEvent.tags.find(t => t[0] === 'title')?.[1] || 'Untitled'}`,
    tags: [
      ['relays', ...PAYMENT_CONFIG.RELAYS],
      ['amount', (amount * 1000).toString()], // Convert sats to millisats
      ['p', PAYMENT_CONFIG.RELAY_PUBKEY], // Relay receives the payment
      ['e', ''], // Will be filled with directory event ID after signing
      ['k', '30402'], // Kind of event being zapped
      ['description', 'Directory entry payment'],
    ]
  };

  return zapRequest;
}

/**
 * Validates directory entry form data
 */
export function validateDirectoryEntry(formData) {
  const errors = [];

  if (!formData.title || formData.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  }

  if (!formData.summary || formData.summary.trim().length < 10) {
    errors.push('Summary must be at least 10 characters long');
  }

  if (!formData.description || formData.description.trim().length < 20) {
    errors.push('Description must be at least 20 characters long');
  }

  if (!formData.category || !Object.values(DIRECTORY_CATEGORIES).includes(formData.category)) {
    errors.push('Please select a valid category');
  }

  if (formData.website && !isValidUrl(formData.website)) {
    errors.push('Please enter a valid website URL');
  }

  if (formData.contact && !isValidContact(formData.contact)) {
    errors.push('Please enter a valid contact (email, npub, or other identifier)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates zap receipt for directory entry payment
 */
export function validateZapReceipt(zapReceipt, originalZapRequest, directoryEventId) {
  try {
    // Basic structure validation
    if (zapReceipt.kind !== 9735) {
      return { isValid: false, error: 'Invalid zap receipt kind' };
    }

    // Check if zap receipt is from the relay
    if (zapReceipt.pubkey !== PAYMENT_CONFIG.RELAY_PUBKEY) {
      return { isValid: false, error: 'Zap receipt not from authorized relay' };
    }

    // Validate bolt11 tag exists
    const bolt11Tag = zapReceipt.tags.find(t => t[0] === 'bolt11');
    if (!bolt11Tag) {
      return { isValid: false, error: 'Missing bolt11 tag in zap receipt' };
    }

    // Validate description tag contains original zap request
    const descriptionTag = zapReceipt.tags.find(t => t[0] === 'description');
    if (!descriptionTag) {
      return { isValid: false, error: 'Missing description tag in zap receipt' };
    }

    // Parse and validate the embedded zap request
    let embeddedZapRequest;
    try {
      embeddedZapRequest = JSON.parse(descriptionTag[1]);
    } catch (e) {
      return { isValid: false, error: 'Invalid JSON in zap receipt description' };
    }

    // Verify the embedded zap request matches our original request
    if (embeddedZapRequest.pubkey !== originalZapRequest.pubkey) {
      return { isValid: false, error: 'Zap request pubkey mismatch' };
    }

    // Verify amount
    const amountTag = embeddedZapRequest.tags.find(t => t[0] === 'amount');
    const expectedAmount = (PAYMENT_CONFIG.ENTRY_PRICE_SATS * 1000).toString();
    if (!amountTag || amountTag[1] !== expectedAmount) {
      return { isValid: false, error: 'Payment amount mismatch' };
    }

    // Verify event reference
    const eventTag = embeddedZapRequest.tags.find(t => t[0] === 'e');
    if (!eventTag || eventTag[1] !== directoryEventId) {
      return { isValid: false, error: 'Directory event ID mismatch' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: `Validation error: ${error.message}` };
  }
}

// Helper functions
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

function isValidContact(contact) {
  // Basic validation for email, npub, or other contact formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const npubRegex = /^npub1[a-z0-9]{58}$/;
  
  return emailRegex.test(contact) || 
         npubRegex.test(contact) || 
         contact.length >= 5; // Basic fallback for other formats
}
