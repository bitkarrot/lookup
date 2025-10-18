/**
 * Relay-side Payment Validation Handler
 * Handles NIP-57 zap validation for directory entry payments
 */

import { EventEmitter } from 'events';
import { validateZapReceipt, PAYMENT_CONFIG } from './directory-schema.js';

/**
 * Main relay handler for zap-gated directory entries
 */
export class RelayPaymentHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.relayPubkey = options.relayPubkey || PAYMENT_CONFIG.RELAY_PUBKEY;
    this.lightningNode = options.lightningNode; // Lightning node interface
    this.webOfTrust = options.webOfTrust || new Set(); // Set of trusted pubkeys
    this.pendingPayments = new Map(); // Track pending payments
    this.paidEntries = new Map(); // Track paid entries
    
    // Configuration
    this.config = {
      entryPriceSats: options.entryPriceSats || PAYMENT_CONFIG.ENTRY_PRICE_SATS,
      paymentTimeoutMs: options.paymentTimeoutMs || 300000, // 5 minutes
      ...options
    };
  }

  /**
   * Handles incoming directory entry events
   */
  async handleDirectoryEntry(event, websocket) {
    try {
      // Validate event structure
      if (event.kind !== 30402) {
        return this.sendError(websocket, 'Invalid event kind for directory entry');
      }

      // Check if user is trusted
      if (this.isUserTrusted(event.pubkey)) {
        // Trusted user - publish immediately
        return this.publishDirectoryEntry(event, websocket, 'trusted');
      }

      // Untrusted user - require payment
      const entryId = this.getEntryId(event);
      
      // Check if already paid
      if (this.paidEntries.has(entryId)) {
        return this.publishDirectoryEntry(event, websocket, 'paid');
      }

      // Store pending entry and request payment
      this.pendingPayments.set(entryId, {
        event,
        websocket,
        timestamp: Date.now(),
        status: 'pending_payment'
      });

      return this.requestPayment(event, websocket);

    } catch (error) {
      console.error('Error handling directory entry:', error);
      return this.sendError(websocket, 'Internal server error');
    }
  }

  /**
   * Handles incoming zap requests for directory entries
   */
  async handleZapRequest(zapRequest, websocket) {
    try {
      // Validate zap request structure
      if (zapRequest.kind !== 9734) {
        return this.sendError(websocket, 'Invalid zap request kind');
      }

      // Extract directory event ID from zap request
      const eventTag = zapRequest.tags.find(t => t[0] === 'e');
      if (!eventTag || !eventTag[1]) {
        return this.sendError(websocket, 'Missing event reference in zap request');
      }

      const directoryEventId = eventTag[1];
      const entryId = this.getEntryIdFromEventId(directoryEventId);

      // Check if we have a pending payment for this entry
      const pendingPayment = this.pendingPayments.get(entryId);
      if (!pendingPayment) {
        return this.sendError(websocket, 'No pending payment found for this entry');
      }

      // Validate zap request amount
      const amountTag = zapRequest.tags.find(t => t[0] === 'amount');
      const expectedAmount = (this.config.entryPriceSats * 1000).toString();
      
      if (!amountTag || amountTag[1] !== expectedAmount) {
        return this.sendError(websocket, `Invalid payment amount. Expected ${expectedAmount} millisats`);
      }

      // Generate Lightning invoice
      const invoice = await this.generateInvoice(zapRequest, directoryEventId);
      
      if (invoice) {
        // Store zap request for later validation
        pendingPayment.zapRequest = zapRequest;
        pendingPayment.invoice = invoice;
        pendingPayment.status = 'invoice_generated';

        // Start monitoring for payment
        this.monitorPayment(invoice.payment_hash, entryId);

        return this.sendInvoiceResponse(websocket, invoice);
      } else {
        return this.sendError(websocket, 'Failed to generate invoice');
      }

    } catch (error) {
      console.error('Error handling zap request:', error);
      return this.sendError(websocket, 'Failed to process zap request');
    }
  }

  /**
   * Handles incoming zap receipts
   */
  async handleZapReceipt(zapReceipt, websocket) {
    try {
      // Validate zap receipt
      if (zapReceipt.kind !== 9735) {
        return;
      }

      // Extract directory event ID from zap receipt
      const descriptionTag = zapReceipt.tags.find(t => t[0] === 'description');
      if (!descriptionTag) {
        return;
      }

      let originalZapRequest;
      try {
        originalZapRequest = JSON.parse(descriptionTag[1]);
      } catch (e) {
        return;
      }

      const eventTag = originalZapRequest.tags.find(t => t[0] === 'e');
      if (!eventTag) {
        return;
      }

      const directoryEventId = eventTag[1];
      const entryId = this.getEntryIdFromEventId(directoryEventId);

      // Find pending payment
      const pendingPayment = this.pendingPayments.get(entryId);
      if (!pendingPayment) {
        return;
      }

      // Validate zap receipt
      const validation = validateZapReceipt(zapReceipt, originalZapRequest, directoryEventId);
      if (!validation.isValid) {
        console.error('Invalid zap receipt:', validation.error);
        return;
      }

      // Mark as paid and publish directory entry
      this.paidEntries.set(entryId, {
        zapReceipt,
        timestamp: Date.now()
      });

      // Update directory entry status to active
      const directoryEvent = { ...pendingPayment.event };
      const statusTag = directoryEvent.tags.find(t => t[0] === 'status');
      if (statusTag) {
        statusTag[1] = 'active';
      }

      // Publish the directory entry
      await this.publishDirectoryEntry(directoryEvent, pendingPayment.websocket, 'paid');

      // Clean up pending payment
      this.pendingPayments.delete(entryId);

      // Emit event for logging/analytics
      this.emit('paymentCompleted', {
        entryId,
        directoryEvent,
        zapReceipt,
        amount: this.config.entryPriceSats
      });

    } catch (error) {
      console.error('Error handling zap receipt:', error);
    }
  }

  /**
   * Generates Lightning invoice for directory entry payment
   */
  async generateInvoice(zapRequest, directoryEventId) {
    try {
      if (!this.lightningNode) {
        throw new Error('Lightning node not configured');
      }

      const amountSats = this.config.entryPriceSats;
      const description = JSON.stringify(zapRequest);
      
      // Generate invoice with description hash
      const invoice = await this.lightningNode.createInvoice({
        amount: amountSats,
        description_hash: this.sha256(description),
        expiry: 300, // 5 minutes
        memo: `Directory entry payment: ${directoryEventId.slice(0, 8)}...`
      });

      return {
        payment_request: invoice.payment_request,
        payment_hash: invoice.payment_hash,
        expires_at: invoice.expires_at
      };

    } catch (error) {
      console.error('Error generating invoice:', error);
      return null;
    }
  }

  /**
   * Monitors Lightning payment status
   */
  monitorPayment(paymentHash, entryId) {
    if (!this.lightningNode) {
      return;
    }

    const checkPayment = async () => {
      try {
        const invoice = await this.lightningNode.lookupInvoice(paymentHash);
        
        if (invoice.settled) {
          // Payment confirmed - generate zap receipt
          const pendingPayment = this.pendingPayments.get(entryId);
          if (pendingPayment) {
            await this.generateZapReceipt(pendingPayment, invoice);
          }
        } else if (invoice.expired) {
          // Payment expired - clean up
          this.pendingPayments.delete(entryId);
          this.emit('paymentExpired', { entryId, paymentHash });
        } else {
          // Still pending - check again in 5 seconds
          setTimeout(checkPayment, 5000);
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    };

    // Start monitoring
    setTimeout(checkPayment, 5000);
  }

  /**
   * Generates and publishes zap receipt
   */
  async generateZapReceipt(pendingPayment, invoice) {
    try {
      const { zapRequest, event: directoryEvent } = pendingPayment;
      const now = Math.floor(Date.now() / 1000);

      const zapReceipt = {
        kind: 9735,
        pubkey: this.relayPubkey,
        created_at: now,
        content: '',
        tags: [
          ['p', zapRequest.pubkey], // Zap sender
          ['P', this.relayPubkey], // Zap recipient (relay)
          ['e', directoryEvent.id], // Directory event being zapped
          ['k', '30402'], // Kind of event being zapped
          ['bolt11', invoice.payment_request],
          ['description', JSON.stringify(zapRequest)],
          ['preimage', invoice.payment_preimage || '']
        ]
      };

      // Sign the zap receipt
      const signedZapReceipt = await this.signEvent(zapReceipt);

      // Publish zap receipt to relays
      await this.publishToRelays(signedZapReceipt);

      // Handle the zap receipt locally
      await this.handleZapReceipt(signedZapReceipt);

    } catch (error) {
      console.error('Error generating zap receipt:', error);
    }
  }

  /**
   * Publishes directory entry to relay
   */
  async publishDirectoryEntry(event, websocket, paymentStatus) {
    try {
      // Validate event before publishing
      if (!this.validateDirectoryEvent(event)) {
        return this.sendError(websocket, 'Invalid directory event');
      }

      // Store in relay database
      await this.storeEvent(event);

      // Send success response
      this.sendOK(websocket, event.id, true, 'Directory entry published');

      // Emit event for logging
      this.emit('entryPublished', {
        event,
        paymentStatus,
        timestamp: Date.now()
      });

      return true;

    } catch (error) {
      console.error('Error publishing directory entry:', error);
      return this.sendError(websocket, 'Failed to publish directory entry');
    }
  }

  /**
   * Requests payment for directory entry
   */
  requestPayment(event, websocket) {
    const entryId = this.getEntryId(event);
    const amountSats = this.config.entryPriceSats;

    // Send payment required response
    return this.sendError(websocket, 
      `Payment required: ${amountSats} sats. Send a zap request to proceed.`,
      'payment-required'
    );
  }

  /**
   * Checks if user is in web of trust
   */
  isUserTrusted(pubkey) {
    return this.webOfTrust.has(pubkey);
  }

  /**
   * Adds user to web of trust
   */
  addToWebOfTrust(pubkey) {
    this.webOfTrust.add(pubkey);
    this.emit('trustAdded', { pubkey });
  }

  /**
   * Removes user from web of trust
   */
  removeFromWebOfTrust(pubkey) {
    this.webOfTrust.delete(pubkey);
    this.emit('trustRemoved', { pubkey });
  }

  /**
   * Gets entry ID from directory event
   */
  getEntryId(event) {
    const dTag = event.tags.find(t => t[0] === 'd');
    return dTag ? dTag[1] : event.id;
  }

  /**
   * Gets entry ID from event ID (reverse lookup)
   */
  getEntryIdFromEventId(eventId) {
    // In a real implementation, you'd query your database
    // For now, we'll use the event ID as entry ID
    return eventId;
  }

  /**
   * Validates directory event structure
   */
  validateDirectoryEvent(event) {
    if (event.kind !== 30402) return false;
    if (!event.pubkey || !event.content) return false;
    if (!event.tags || !Array.isArray(event.tags)) return false;

    // Check required tags
    const requiredTags = ['d', 'title', 'summary'];
    for (const tagName of requiredTags) {
      if (!event.tags.find(t => t[0] === tagName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sends error response to client
   */
  sendError(websocket, message, type = 'error') {
    const response = JSON.stringify(['NOTICE', `${type.toUpperCase()}: ${message}`]);
    websocket.send(response);
  }

  /**
   * Sends OK response to client
   */
  sendOK(websocket, eventId, accepted, message = '') {
    const response = JSON.stringify(['OK', eventId, accepted, message]);
    websocket.send(response);
  }

  /**
   * Sends invoice response to client
   */
  sendInvoiceResponse(websocket, invoice) {
    const response = JSON.stringify({
      pr: invoice.payment_request,
      routes: []
    });
    websocket.send(response);
  }

  /**
   * SHA256 hash function
   */
  sha256(data) {
    // In a real implementation, use a proper crypto library
    // This is a placeholder
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }

  /**
   * Signs an event (placeholder - implement with your signing method)
   */
  async signEvent(event) {
    // Implement event signing with relay's private key
    // This is a placeholder
    return {
      ...event,
      id: this.sha256(JSON.stringify(event)),
      sig: 'placeholder_signature'
    };
  }

  /**
   * Stores event in relay database (placeholder)
   */
  async storeEvent(event) {
    // Implement database storage
    console.log('Storing event:', event.id);
  }

  /**
   * Publishes event to other relays (placeholder)
   */
  async publishToRelays(event) {
    // Implement relay broadcasting
    console.log('Broadcasting event:', event.id);
  }

  /**
   * Cleanup expired payments
   */
  cleanupExpiredPayments() {
    const now = Date.now();
    const timeout = this.config.paymentTimeoutMs;

    for (const [entryId, payment] of this.pendingPayments.entries()) {
      if (now - payment.timestamp > timeout) {
        this.pendingPayments.delete(entryId);
        this.emit('paymentExpired', { entryId });
      }
    }
  }

  /**
   * Starts periodic cleanup of expired payments
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredPayments();
    }, 60000); // Clean up every minute
  }
}

/**
 * Express.js middleware for handling trust status checks
 */
export function createTrustCheckMiddleware(paymentHandler) {
  return (req, res, next) => {
    if (req.path === '/api/trust-check' && req.method === 'POST') {
      const { pubkey } = req.body;
      
      if (!pubkey) {
        return res.status(400).json({ error: 'Missing pubkey' });
      }

      const trusted = paymentHandler.isUserTrusted(pubkey);
      return res.json({ trusted });
    }
    
    next();
  };
}

/**
 * WebSocket handler factory
 */
export function createWebSocketHandler(paymentHandler) {
  return async (websocket, message) => {
    try {
      const data = JSON.parse(message);
      const [type, ...params] = data;

      switch (type) {
        case 'EVENT':
          const event = params[0];
          if (event.kind === 30402) {
            await paymentHandler.handleDirectoryEntry(event, websocket);
          } else if (event.kind === 9734) {
            await paymentHandler.handleZapRequest(event, websocket);
          } else if (event.kind === 9735) {
            await paymentHandler.handleZapReceipt(event, websocket);
          }
          break;

        case 'REQ':
          // Handle subscription requests
          // Implementation depends on your relay architecture
          break;

        case 'CLOSE':
          // Handle subscription closures
          break;

        default:
          paymentHandler.sendError(websocket, 'Unknown message type');
      }

    } catch (error) {
      console.error('WebSocket message error:', error);
      paymentHandler.sendError(websocket, 'Invalid message format');
    }
  };
}
