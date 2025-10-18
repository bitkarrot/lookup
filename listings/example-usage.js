/**
 * Example Usage and Integration Code
 * Demonstrates how to set up and use the zap-gated directory system
 */

import express from 'express';
import WebSocket from 'ws';
import { RelayPaymentHandler, createTrustCheckMiddleware, createWebSocketHandler } from './relay-payment-handler.js';

// Example 1: Basic Relay Setup
export function createDirectoryRelay(options = {}) {
  const app = express();
  app.use(express.json());

  // Initialize payment handler
  const paymentHandler = new RelayPaymentHandler({
    relayPubkey: options.relayPubkey || 'your_relay_pubkey_here',
    lightningNode: options.lightningNode, // Your Lightning node interface
    entryPriceSats: options.entryPriceSats || 1000,
    webOfTrust: new Set(options.trustedUsers || [])
  });

  // Add trust check middleware
  app.use(createTrustCheckMiddleware(paymentHandler));

  // LNURL endpoint for zap payments
  app.get('/.well-known/lnurlp/relay', (req, res) => {
    res.json({
      callback: `${options.baseUrl}/lnurl/callback`,
      maxSendable: 100000000, // 100k sats
      minSendable: 1000, // 1 sat  
      allowsNostr: true,
      nostrPubkey: paymentHandler.relayPubkey,
      tag: 'payRequest',
      metadata: JSON.stringify([
        ['text/plain', 'Directory entry payment'],
        ['text/long-desc', 'Payment for submitting an entry to the Nostr directory']
      ])
    });
  });

  // LNURL callback endpoint
  app.get('/lnurl/callback', async (req, res) => {
    try {
      const { amount, nostr } = req.query;
      
      if (!nostr) {
        return res.status(400).json({
          status: 'ERROR',
          reason: 'Missing nostr parameter'
        });
      }

      // Decode and validate zap request
      const zapRequest = JSON.parse(decodeURIComponent(nostr));
      
      // Generate invoice
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

  // WebSocket server for Nostr relay
  const wss = new WebSocket.Server({ port: options.wsPort || 8080 });
  const wsHandler = createWebSocketHandler(paymentHandler);

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
      wsHandler(ws, message.toString());
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
    });
  });

  // Event listeners for logging
  paymentHandler.on('entryPublished', (data) => {
    console.log('Directory entry published:', {
      eventId: data.event.id,
      pubkey: data.event.pubkey,
      paymentStatus: data.paymentStatus,
      title: data.event.tags.find(t => t[0] === 'title')?.[1]
    });
  });

  paymentHandler.on('paymentCompleted', (data) => {
    console.log('Payment completed:', {
      entryId: data.entryId,
      amount: data.amount,
      timestamp: new Date().toISOString()
    });
  });

  // Start cleanup timer
  paymentHandler.startCleanupTimer();

  return {
    app,
    paymentHandler,
    wss
  };
}

// Example 2: Lightning Node Integration (LND)
export class LNDInterface {
  constructor(options) {
    this.lnd = options.lnd; // LND gRPC client
    this.macaroon = options.macaroon;
  }

  async createInvoice({ amount, description_hash, expiry, memo }) {
    try {
      const request = {
        value: amount,
        description_hash: Buffer.from(description_hash, 'hex'),
        expiry: expiry,
        memo: memo
      };

      const response = await this.lnd.addInvoice(request);
      
      return {
        payment_request: response.payment_request,
        payment_hash: response.r_hash.toString('hex'),
        expires_at: Date.now() + (expiry * 1000)
      };
    } catch (error) {
      console.error('LND createInvoice error:', error);
      throw error;
    }
  }

  async lookupInvoice(paymentHash) {
    try {
      const request = {
        r_hash_str: paymentHash
      };

      const response = await this.lnd.lookupInvoice(request);
      
      return {
        settled: response.settled,
        expired: response.expiry < Math.floor(Date.now() / 1000),
        payment_preimage: response.r_preimage?.toString('hex')
      };
    } catch (error) {
      console.error('LND lookupInvoice error:', error);
      throw error;
    }
  }
}

// Example 3: CLN (Core Lightning) Integration
export class CLNInterface {
  constructor(options) {
    this.cln = options.cln; // CLN client
  }

  async createInvoice({ amount, description_hash, expiry, memo }) {
    try {
      const msatAmount = amount * 1000;
      const label = `directory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await this.cln.invoice({
        amount_msat: msatAmount,
        label: label,
        description: memo,
        expiry: expiry
      });

      return {
        payment_request: response.bolt11,
        payment_hash: response.payment_hash,
        expires_at: Date.now() + (expiry * 1000)
      };
    } catch (error) {
      console.error('CLN createInvoice error:', error);
      throw error;
    }
  }

  async lookupInvoice(paymentHash) {
    try {
      const invoices = await this.cln.listinvoices({ payment_hash: paymentHash });
      
      if (invoices.invoices.length === 0) {
        throw new Error('Invoice not found');
      }

      const invoice = invoices.invoices[0];
      
      return {
        settled: invoice.status === 'paid',
        expired: invoice.expires_at < Math.floor(Date.now() / 1000),
        payment_preimage: invoice.payment_preimage
      };
    } catch (error) {
      console.error('CLN lookupInvoice error:', error);
      throw error;
    }
  }
}

// Example 4: Complete Server Setup
export async function startDirectoryServer() {
  // Lightning node setup (choose one)
  const lightningNode = new LNDInterface({
    lnd: null, // Your LND client
    macaroon: 'your_macaroon_here'
  });

  // Or use CLN
  // const lightningNode = new CLNInterface({
  //   cln: null // Your CLN client
  // });

  // Trusted users (web of trust)
  const trustedUsers = [
    'npub1trusted1...', // Convert to hex
    'npub1trusted2...', // Convert to hex
    // Add more trusted pubkeys
  ];

  // Create relay
  const relay = createDirectoryRelay({
    relayPubkey: 'your_relay_pubkey_hex',
    lightningNode: lightningNode,
    entryPriceSats: 1000,
    trustedUsers: trustedUsers,
    baseUrl: 'https://yourdomain.com',
    wsPort: 8080
  });

  // Start HTTP server
  const port = process.env.PORT || 3000;
  relay.app.listen(port, () => {
    console.log(`Directory relay HTTP server running on port ${port}`);
    console.log(`WebSocket server running on port 8080`);
  });

  return relay;
}

// Example 5: Client-side Integration
export class DirectoryClient {
  constructor(relayUrl) {
    this.relayUrl = relayUrl;
    this.ws = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.relayUrl);
      
      this.ws.onopen = () => {
        console.log('Connected to directory relay');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }

  async submitEntry(directoryEvent) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to relay');
    }

    const message = JSON.stringify(['EVENT', directoryEvent]);
    this.ws.send(message);
  }

  async sendZapRequest(zapRequest) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to relay');
    }

    const message = JSON.stringify(['EVENT', zapRequest]);
    this.ws.send(message);
  }

  handleMessage(data) {
    const [type, ...params] = data;
    
    switch (type) {
      case 'OK':
        console.log('Event accepted:', params);
        break;
      case 'NOTICE':
        console.log('Notice from relay:', params[0]);
        break;
      default:
        console.log('Unknown message type:', type);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Example 6: Database Schema (PostgreSQL)
export const DATABASE_SCHEMA = `
-- Directory entries table
CREATE TABLE directory_entries (
  id VARCHAR(64) PRIMARY KEY,
  pubkey VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  description TEXT,
  category VARCHAR(50),
  location VARCHAR(255),
  website VARCHAR(255),
  contact VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  payment_status VARCHAR(20) DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  event_json JSONB NOT NULL
);

-- Payment records table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  entry_id VARCHAR(64) REFERENCES directory_entries(id),
  payment_hash VARCHAR(64) UNIQUE NOT NULL,
  invoice VARCHAR(2000) NOT NULL,
  amount_sats INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  paid_at TIMESTAMP,
  zap_receipt_id VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Web of trust table
CREATE TABLE web_of_trust (
  pubkey VARCHAR(64) PRIMARY KEY,
  added_by VARCHAR(64),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

-- Indexes
CREATE INDEX idx_directory_entries_pubkey ON directory_entries(pubkey);
CREATE INDEX idx_directory_entries_category ON directory_entries(category);
CREATE INDEX idx_directory_entries_status ON directory_entries(status);
CREATE INDEX idx_payments_entry_id ON payments(entry_id);
CREATE INDEX idx_payments_payment_hash ON payments(payment_hash);
`;

// Example 7: Environment Configuration
export const EXAMPLE_ENV = `
# Relay Configuration
RELAY_PUBKEY=your_relay_private_key_hex
RELAY_NAME="Nostr Directory"
RELAY_DESCRIPTION="A paid directory for Nostr services"
RELAY_URL=wss://relay.yourdomain.com

# Lightning Configuration
LIGHTNING_TYPE=lnd  # or 'cln'
LND_HOST=localhost:10009
LND_MACAROON_PATH=/path/to/admin.macaroon
LND_TLS_CERT_PATH=/path/to/tls.cert

# Payment Configuration
ENTRY_PRICE_SATS=1000
PAYMENT_TIMEOUT_MS=300000

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost/directory

# Server Configuration
HTTP_PORT=3000
WS_PORT=8080
BASE_URL=https://yourdomain.com

# Trusted Users (comma-separated hex pubkeys)
TRUSTED_USERS=pubkey1,pubkey2,pubkey3
`;

// Example 8: Docker Compose Setup
export const DOCKER_COMPOSE = `
version: '3.8'

services:
  directory-relay:
    build: .
    ports:
      - "3000:3000"
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/directory
      - RELAY_PUBKEY=\${RELAY_PUBKEY}
      - LND_HOST=lnd:10009
    depends_on:
      - db
      - lnd
    volumes:
      - ./lnd-data:/lnd-data:ro

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=directory
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  lnd:
    image: lightninglabs/lnd:latest
    ports:
      - "9735:9735"
      - "10009:10009"
    volumes:
      - lnd_data:/root/.lnd
    command: >
      lnd
      --bitcoin.active
      --bitcoin.mainnet
      --debuglevel=info
      --bitcoin.node=bitcoind
      --bitcoind.rpchost=bitcoind:8332
      --bitcoind.rpcuser=bitcoin
      --bitcoind.rpcpass=password
      --bitcoind.zmqpubrawblock=tcp://bitcoind:28332
      --bitcoind.zmqpubrawtx=tcp://bitcoind:28333

volumes:
  postgres_data:
  lnd_data:
`;

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startDirectoryServer().catch(console.error);
}
