# Simplified Setup with Existing WoT-Relay

Since you already have the **bitvora/wot-relay** running, we can eliminate the PostgreSQL database and integrate directly with your existing infrastructure.

## Architecture Overview

```
Directory Service (Port 3001)  ←→  WoT-Relay (Port 3334)
        ↓
Lightning Node (Payment Processing)
```

## What We Eliminate

❌ **PostgreSQL Database** - Use wot-relay's existing storage  
❌ **Separate Web of Trust** - Use wot-relay's trust network  
❌ **Complex Database Schema** - Store in memory or simple files  

## What We Keep

✅ **Payment Processing** - Lightning zaps for directory entries  
✅ **NIP-57 Compliance** - Standard zap implementation  
✅ **NIP-99 Compliance** - Kind 30402 classified listings  
✅ **Modern Web Interface** - Same great UI  

## Quick Setup

### 1. Your Existing WoT-Relay (Port 3334)
```bash
# Already running at /Users/bitcarrot/github/mkstack/wot-relay
cd /Users/bitcarrot/github/mkstack/wot-relay
# Your wot-relay handles trust checking and event storage
```

### 2. Directory Service (Port 3001)
```bash
cd /Users/bitcarrot/github/mkstack/lookup/listings
node simplified-relay-integration.js
```

### 3. Environment Variables
```bash
# Directory service config
export RELAY_PUBKEY="your_relay_pubkey_hex"
export DIRECTORY_PORT=3001
export WOT_RELAY_URL="ws://localhost:3334"
export WOT_RELAY_HTTP="http://localhost:3334"

# Lightning config (same as before)
export LND_HOST="localhost:10009"
export ENTRY_PRICE_SATS=1000
```

## How It Works

### 1. Trust Checking
```javascript
// Instead of database query:
const trusted = await checkDatabase(pubkey);

// We check with your wot-relay:
const trusted = await paymentHandler.isUserTrusted(pubkey);
// This sends a test event to wot-relay to see if it's accepted
```

### 2. Event Storage
```javascript
// Instead of PostgreSQL:
await database.store(directoryEvent);

// We forward to your wot-relay:
await paymentHandler.forwardToWotRelay(directoryEvent);
// Your wot-relay stores it in its BadgerDB
```

### 3. Payment Tracking
```javascript
// Simple in-memory storage (no database):
this.pendingPayments = new Map();
this.paidEntries = new Map();
```

## Integration Flow

### For Trusted Users
```
1. User submits directory entry
2. Directory service checks trust with wot-relay  
3. If trusted → forward directly to wot-relay
4. Wot-relay stores and broadcasts event
```

### For Untrusted Users  
```
1. User submits directory entry
2. Directory service checks trust with wot-relay
3. If not trusted → request Lightning payment
4. User pays zap → directory service validates
5. After payment → forward to wot-relay
6. Wot-relay stores and broadcasts event
```

## File Structure (Simplified)

```
/Users/bitcarrot/github/mkstack/lookup/listings/
├── simplified-relay-integration.js  ← Main integration code
├── directory-schema.js              ← Data models (unchanged)
├── zap-integration.js              ← Client zap handling (unchanged)  
├── web-interface.html              ← Frontend (unchanged)
├── SIMPLIFIED_SETUP.md             ← This file
└── example-usage.js                ← Full examples (reference)
```

## Benefits

### ✅ **Simpler Deployment**
- No PostgreSQL setup required
- No database migrations
- No additional database maintenance

### ✅ **Leverages Existing Infrastructure**  
- Uses your wot-relay's trust network
- Uses your wot-relay's event storage (BadgerDB)
- Uses your wot-relay's relay infrastructure

### ✅ **Reduced Complexity**
- Fewer moving parts
- Less configuration
- Easier debugging

### ✅ **Same Functionality**
- All payment features work the same
- Same web interface
- Same NIP compliance

## Testing the Integration

### 1. Check WoT-Relay Status
```bash
curl http://localhost:3334/debug/stats
# Should show trust network size and statistics
```

### 2. Test Trust Checking
```bash
curl -X POST http://localhost:3001/api/trust-check \
  -H "Content-Type: application/json" \
  -d '{"pubkey": "your_test_pubkey_hex"}'
# Returns: {"trusted": true/false}
```

### 3. Test Directory Submission
- Open `web-interface.html`
- Connect Nostr extension
- Submit a directory entry
- Check if payment is required based on trust status

## Monitoring

### WoT-Relay Logs
```bash
# Your wot-relay shows:
🌐 trust network map updated with X keys
📦 archived Y trusted notes
```

### Directory Service Logs  
```bash
# Directory service shows:
📁 Directory service running on port 3001
🔌 Directory WebSocket on port 8081  
🌐 Integrating with wot-relay on port 3334
```

## Optional: Add Trust Check Endpoint to WoT-Relay

If you want to make trust checking more efficient, you could add this endpoint to your wot-relay's `main.go`:

```go
// Add to your wot-relay main.go
mux.HandleFunc("POST /api/trust-check", func(w http.ResponseWriter, r *http.Request) {
    var req struct {
        Pubkey string `json:"pubkey"`
    }
    
    if err := json.NewDecoder(r.body).Decode(&req); err != nil {
        http.Error(w, "Invalid JSON", http.StatusBadRequest)
        return
    }
    
    trustNetworkMutex.RLock()
    trusted := trustNetworkMap[req.Pubkey]
    trustNetworkMutex.RUnlock()
    
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(map[string]bool{"trusted": trusted})
})
```

But the WebSocket-based trust checking in `simplified-relay-integration.js` works fine without modifying your wot-relay.

## Summary

This simplified approach gives you the same zap-gated directory functionality while:
- **Eliminating PostgreSQL** dependency
- **Using your existing wot-relay** for trust and storage
- **Maintaining all payment features** 
- **Keeping the same user experience**

The directory service becomes a lightweight payment gateway that sits in front of your wot-relay, handling Lightning payments for untrusted users while passing trusted users through directly.
