/**
 * Simplified Relay Integration for WoT-Relay
 * Integrates with existing bitvora/wot-relay instead of using separate database
 */

import { EventEmitter } from 'events';
import { validateZapReceipt, PAYMENT_CONFIG } from './directory-schema.js';

/**
 * Simplified payment handler that integrates with existing wot-relay
 */
export class WoTRelayPaymentHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.relayPubkey = options.relayPubkey || PAYMENT_CONFIG.RELAY_PUBKEY;
    this.lightningNode = options.lightningNode;
    this.wotRelayUrl = options.wotRelayUrl || 'ws://localhost:3334'; // Your wot-relay WebSocket
    this.wotRelayHttpUrl = options.wotRelayHttpUrl || 'http://localhost:3334'; // HTTP endpoint
    
    // In-memory storage (no PostgreSQL needed)
    this.pendingPayments = new Map();
    this.paidEntries = new Map();
    
    this.config = {
      entryPriceSats: options.entryPriceSats || PAYMENT_CONFIG.ENTRY_PRICE_SATS,
      paymentTimeoutMs: options.paymentTimeoutMs || 300000,
      ...options
    };
  }

  /**
   * Checks if user is trusted by querying the wot-relay
   */
  async isUserTrusted(pubkey) {
    try {
      // The wot-relay maintains trustNetworkMap in memory
      // We can check this by trying to publish a test event or checking debug stats
      const response = await fetch(`${this.wotRelayHttpUrl}/debug/stats`);
      
      if (response.ok) {
        // For now, we'll implement a simple HTTP endpoint to check trust
        // You could modify the wot-relay to add a /api/trust-check endpoint
        return await this.checkTrustViaWebSocket(pubkey);
      }
      
      return false;
    } catch (error) {
      console.error('Error checking trust status:', error);
      return false;
    }
  }

  /**
   * Check trust status via WebSocket (alternative method)
   */
  async checkTrustViaWebSocket(pubkey) {
    return new Promise((resolve) => {
      const ws = new WebSocket(this.wotRelayUrl);
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve(false); // Default to untrusted if check fails
        }
      }, 5000);

      ws.onopen = () => {
        // Send a test event to see if it gets rejected
        const testEvent = {
          kind: 1,
          pubkey: pubkey,
          created_at: Math.floor(Date.now() / 1000),
          content: "trust-check-test",
          tags: [],
          id: "test-" + Math.random().toString(36),
          sig: "test-signature"
        };

        ws.send(JSON.stringify(['EVENT', testEvent]));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const [type, eventId, accepted, message] = data;
          
          if (type === 'OK') {
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              ws.close();
              // If accepted = true, user is trusted
              // If rejected with "not in web of trust", user is not trusted
              resolve(accepted);
            }
          } else if (type === 'NOTICE' && message.includes('not in web of trust')) {
            clearTimeout(timeout);
            if (!resolved) {
              resolved = true;
              ws.close();
              resolve(false);
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      };
    });
  }

  /**
   * Handles directory entry submission
   */
  async handleDirectoryEntry(event, websocket) {
    try {
      if (event.kind !== 30402) {
        return this.sendError(websocket, 'Invalid event kind for directory entry');
      }

      // Check trust status with wot-relay
      const isTrusted = await this.isUserTrusted(event.pubkey);
      
      if (isTrusted) {
        // Trusted user - forward to wot-relay directly
        return this.forwardToWotRelay(event, websocket);
      }

      // Untrusted user - require payment
      const entryId = this.getEntryId(event);
      
      if (this.paidEntries.has(entryId)) {
        return this.forwardToWotRelay(event, websocket);
      }

      // Store pending entry
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
   * Forwards event to wot-relay for storage
   */
  async forwardToWotRelay(event, websocket) {
    try {
      const ws = new WebSocket(this.wotRelayUrl);
      
      return new Promise((resolve) => {
        ws.onopen = () => {
          ws.send(JSON.stringify(['EVENT', event]));
        };

        ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            const [type, eventId, accepted, reason] = data;
            
            if (type === 'OK') {
              if (accepted) {
                this.sendOK(websocket, event.id, true, 'Directory entry published');
                this.emit('entryPublished', { event, paymentStatus: 'trusted' });
              } else {
                this.sendError(websocket, reason || 'Event rejected by relay');
              }
              ws.close();
              resolve();
            }
          } catch (e) {
            this.sendError(websocket, 'Error processing response');
            ws.close();
            resolve();
          }
        };

        ws.onerror = () => {
          this.sendError(websocket, 'Error connecting to relay');
          resolve();
        };
      });

    } catch (error) {
      console.error('Error forwarding to wot-relay:', error);
      this.sendError(websocket, 'Failed to forward to relay');
    }
  }

  /**
   * Handles zap receipts and publishes paid entries
   */
  async handleZapReceipt(zapReceipt, websocket) {
    try {
      if (zapReceipt.kind !== 9735) return;

      const descriptionTag = zapReceipt.tags.find(t => t[0] === 'description');
      if (!descriptionTag) return;

      let originalZapRequest;
      try {
        originalZapRequest = JSON.parse(descriptionTag[1]);
      } catch (e) {
        return;
      }

      const eventTag = originalZapRequest.tags.find(t => t[0] === 'e');
      if (!eventTag) return;

      const directoryEventId = eventTag[1];
      const entryId = this.getEntryIdFromEventId(directoryEventId);

      const pendingPayment = this.pendingPayments.get(entryId);
      if (!pendingPayment) return;

      // Validate zap receipt
      const validation = validateZapReceipt(zapReceipt, originalZapRequest, directoryEventId);
      if (!validation.isValid) {
        console.error('Invalid zap receipt:', validation.error);
        return;
      }

      // Mark as paid
      this.paidEntries.set(entryId, {
        zapReceipt,
        timestamp: Date.now()
      });

      // Update directory event status
      const directoryEvent = { ...pendingPayment.event };
      const statusTag = directoryEvent.tags.find(t => t[0] === 'status');
      if (statusTag) {
        statusTag[1] = 'active';
      }

      // Forward to wot-relay
      await this.forwardToWotRelay(directoryEvent, pendingPayment.websocket);

      // Clean up
      this.pendingPayments.delete(entryId);

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
   * Gets entry ID from directory event
   */
  getEntryId(event) {
    const dTag = event.tags.find(t => t[0] === 'd');
    return dTag ? dTag[1] : event.id;
  }

  /**
   * Gets entry ID from event ID
   */
  getEntryIdFromEventId(eventId) {
    return eventId;
  }

  /**
   * Requests payment for directory entry
   */
  requestPayment(event, websocket) {
    const amountSats = this.config.entryPriceSats;
    return this.sendError(websocket, 
      `Payment required: ${amountSats} sats. Send a zap request to proceed.`,
      'payment-required'
    );
  }

  /**
   * Sends error response
   */
  sendError(websocket, message, type = 'error') {
    const response = JSON.stringify(['NOTICE', `${type.toUpperCase()}: ${message}`]);
    websocket.send(response);
  }

  /**
   * Sends OK response
   */
  sendOK(websocket, eventId, accepted, message = '') {
    const response = JSON.stringify(['OK', eventId, accepted, message]);
    websocket.send(response);
  }

  // Lightning methods remain the same as in the full implementation
  async generateInvoice(zapRequest, directoryEventId) {
    // Same implementation as relay-payment-handler.js
    try {
      if (!this.lightningNode) {
        throw new Error('Lightning node not configured');
      }

      const amountSats = this.config.entryPriceSats;
      const description = JSON.stringify(zapRequest);
      
      const invoice = await this.lightningNode.createInvoice({
        amount: amountSats,
        description_hash: this.sha256(description),
        expiry: 300,
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

  sha256(data) {
    return require('crypto').createHash('sha256').update(data).digest('hex');
  }
}

/**
 * Simplified server setup that works with wot-relay
 */
export function createSimplifiedDirectoryRelay(options = {}) {
  const express = require('express');
  const WebSocket = require('ws');
  
  const app = express();
  app.use(express.json());

  // Initialize payment handler
  const paymentHandler = new WoTRelayPaymentHandler({
    relayPubkey: options.relayPubkey,
    lightningNode: options.lightningNode,
    wotRelayUrl: options.wotRelayUrl || 'ws://localhost:3334',
    wotRelayHttpUrl: options.wotRelayHttpUrl || 'http://localhost:3334',
    entryPriceSats: options.entryPriceSats || 1000
  });

  // Trust check endpoint (simplified)
  app.post('/api/trust-check', async (req, res) => {
    const { pubkey } = req.body;
    
    if (!pubkey) {
      return res.status(400).json({ error: 'Missing pubkey' });
    }

    try {
      const trusted = await paymentHandler.isUserTrusted(pubkey);
      res.json({ trusted });
    } catch (error) {
      console.error('Trust check error:', error);
      res.json({ trusted: false });
    }
  });

  // LNURL endpoints (same as before)
  app.get('/.well-known/lnurlp/relay', (req, res) => {
    res.json({
      callback: `${options.baseUrl}/lnurl/callback`,
      maxSendable: 100000000,
      minSendable: 1000,
      allowsNostr: true,
      nostrPubkey: paymentHandler.relayPubkey,
      tag: 'payRequest',
      metadata: JSON.stringify([
        ['text/plain', 'Directory entry payment'],
        ['text/long-desc', 'Payment for submitting an entry to the Nostr directory']
      ])
    });
  });

  app.get('/lnurl/callback', async (req, res) => {
    try {
      const { amount, nostr } = req.query;
      
      if (!nostr) {
        return res.status(400).json({
          status: 'ERROR',
          reason: 'Missing nostr parameter'
        });
      }

      const zapRequest = JSON.parse(decodeURIComponent(nostr));
      const invoice = await paymentHandler.generateInvoice(zapRequest, zapRequest.id);
      
      if (invoice) {
        res.json({
          pr: invoice.payment_request,
          routes: []
        });
      } else {
        res.status(500).json({
          status: 'ERROR',
          reason: 'Failed to generate invoice'
        });
      }
    } catch (error) {
      res.status(400).json({
        status: 'ERROR',
        reason: 'Invalid request'
      });
    }
  });

  // WebSocket server for directory entries (separate from wot-relay)
  const wss = new WebSocket.Server({ port: options.wsPort || 8081 });

  wss.on('connection', (ws) => {
    console.log('New directory WebSocket connection');
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        const [type, ...params] = data;

        switch (type) {
          case 'EVENT':
            const event = params[0];
            if (event.kind === 30402) {
              await paymentHandler.handleDirectoryEntry(event, ws);
            } else if (event.kind === 9734) {
              await paymentHandler.handleZapRequest(event, ws);
            } else if (event.kind === 9735) {
              await paymentHandler.handleZapReceipt(event, ws);
            }
            break;

          default:
            paymentHandler.sendError(ws, 'Unknown message type');
        }

      } catch (error) {
        console.error('WebSocket message error:', error);
        paymentHandler.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      console.log('Directory WebSocket connection closed');
    });
  });

  return {
    app,
    paymentHandler,
    wss
  };
}

/**
 * Example usage with existing wot-relay
 */
export async function startSimplifiedDirectoryServer() {
  const relay = createSimplifiedDirectoryRelay({
    relayPubkey: process.env.RELAY_PUBKEY,
    lightningNode: null, // Your Lightning node interface
    wotRelayUrl: 'ws://localhost:3334', // Your wot-relay WebSocket
    wotRelayHttpUrl: 'http://localhost:3334', // Your wot-relay HTTP
    entryPriceSats: 1000,
    baseUrl: 'https://yourdomain.com',
    wsPort: 8081 // Different port from wot-relay (3334)
  });

  const port = process.env.DIRECTORY_PORT || 3001;
  relay.app.listen(port, () => {
    console.log(`📁 Directory service running on port ${port}`);
    console.log(`🔌 Directory WebSocket on port 8081`);
    console.log(`🌐 Integrating with wot-relay on port 3334`);
  });

  return relay;
}

// No database schema needed!
export const NO_DATABASE_NEEDED = `
# No PostgreSQL Required! 

This simplified version uses:
- Your existing wot-relay for trust checking
- Your existing wot-relay for event storage  
- In-memory payment tracking (or simple file storage)
- Lightning node for payment processing

## Architecture:

User -> Directory Service (port 3001) -> WoT-Relay (port 3334)
                    |
                Lightning Node (payment validation)

## Benefits:
- No separate database
- Leverages existing wot-relay infrastructure
- Simpler deployment
- Automatic trust network integration
`;

if (import.meta.url === `file://${process.argv[1]}`) {
  startSimplifiedDirectoryServer().catch(console.error);
}
