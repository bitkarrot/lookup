# NIP-68 Threshold Governance Extension

`draft` `optional`

This specification extends NIP-68 Shared Replaceables to support threshold-based governance for editor management, preventing unilateral changes to document structure while maintaining efficient content editing.

## Overview

Current NIP-68 allows any editor to unilaterally add or remove other editors. This extension introduces **threshold governance** where structural changes require M-of-N editor signatures, while content changes remain efficient (typically 1-of-N).

## Core Concepts

### Two-Tier Permission Model

1. **Content Operations**: Adding/editing document content (low threshold, typically 1-of-N)
2. **Governance Operations**: Adding/removing editors, changing thresholds (higher threshold, typically 2-of-N or majority)

### Cryptographic Foundation

Uses **Shamir's Secret Sharing** to distribute governance authority:
- **Content Key**: Full private key shared with all editors (for efficient content updates)
- **Governance Shares**: Threshold shares of a governance key (for structural changes)

## Event Structure

### Basic Threshold Governance Event

```json
{
  "pubkey": "<document_public_key>",
  "kind": 30000,
  "tags": [
    ["d", "<unique_identifier>"],
    ["editor", "<pubkey1>", "<relay>", "<encrypted_content_key>", "<encrypted_governance_share>"],
    ["editor", "<pubkey2>", "<relay>", "<encrypted_content_key>", "<encrypted_governance_share>"],
    ["editor", "<pubkey3>", "<relay>", "<encrypted_content_key>", "<encrypted_governance_share>"],
    ["threshold", "content", "1", "3"],
    ["threshold", "governance", "2", "3"],
    ["governance_pubkey", "<threshold_governance_public_key>"]
  ],
  "content": "<document_content>",
  "sig": "<signature_with_content_key>"
}
```

### Tag Specifications

#### `editor` Tag Format
```
["editor", <editor_pubkey>, <relay_hint>, <encrypted_content_key>, <encrypted_governance_share>]
```

- **editor_pubkey**: Editor's public key
- **relay_hint**: Suggested relay for this editor
- **encrypted_content_key**: NIP-44 encrypted document private key
- **encrypted_governance_share**: NIP-44 encrypted Shamir share of governance key

#### `threshold` Tag Format  
```
["threshold", <operation_type>, <required>, <total>]
```

- **operation_type**: "content" or "governance"
- **required**: Minimum signatures needed
- **total**: Total number of participants

#### `governance_pubkey` Tag
```
["governance_pubkey", <public_key>]
```

Public key derived from the governance private key used in threshold scheme.

## Key Generation Process

### 1. Initialize Document

```javascript
// Generate document identity
const contentKeyPair = generateKeyPair();

// Generate governance master key  
const governanceMasterKey = generatePrivateKey();
const governancePublicKey = getPublicKey(governanceMasterKey);

// Create Shamir shares for governance (2-of-3 example)
const governanceShares = shamirCreateShares(
  governanceMasterKey, // secret
  2,                   // threshold  
  3                    // total shares
);
```

### 2. Distribute Keys to Editors

```javascript
const editors = [alicePubkey, bobPubkey, charliePubkey];
const editorTags = [];

for (let i = 0; i < editors.length; i++) {
  const editorPubkey = editors[i];
  
  // Encrypt content key for this editor
  const encryptedContentKey = nip44Encrypt(
    contentKeyPair.privateKey,
    contentKeyPair.privateKey,
    editorPubkey
  );
  
  // Encrypt governance share for this editor  
  const encryptedGovernanceShare = nip44Encrypt(
    JSON.stringify({
      share: governanceShares[i],
      threshold: 2,
      participants: editors.length
    }),
    contentKeyPair.privateKey,
    editorPubkey
  );
  
  editorTags.push([
    "editor", 
    editorPubkey, 
    "wss://relay.example.com",
    encryptedContentKey,
    encryptedGovernanceShare
  ]);
}
```

## Operation Types

### Content Operations (Low Threshold)

Regular document edits use the standard NIP-68 flow:

```javascript
// Alice edits content (only needs content key)
const updatedEvent = {
  pubkey: contentKeyPair.publicKey,
  kind: 30000,
  tags: [...existingTags], // Same editor list
  content: "Updated content by Alice",
  created_at: Math.floor(Date.now() / 1000),
  sig: sign(eventHash, contentKeyPair.privateKey)
};
```

### Governance Operations (High Threshold)

Structural changes require threshold signatures:

#### Phase 1: Proposal Creation
```javascript
const governanceProposal = {
  kind: 9001, // Governance proposal
  pubkey: alicePubkey, // Proposer's personal key
  tags: [
    ["e", documentEventId],
    ["action", "remove_editor"],  
    ["target", charliePubkey],
    ["threshold_required", "2", "3"],
    ["expires", Math.floor(Date.now() / 1000) + 86400] // 24h expiry
  ],
  content: "Proposal to remove Charlie due to inactivity",
  sig: sign(eventHash, alicePrivateKey)
};
```

#### Phase 2: Threshold Approval
```javascript  
// Bob approves using his governance share
const approval = {
  kind: 9002, // Governance approval
  pubkey: bobPubkey,
  tags: [
    ["e", governanceProposal.id],
    ["approve"],
    ["governance_signature", thresholdPartialSign(
      governanceProposal.id,
      bobGovernanceShare,
      2, // threshold
      [1, 2] // Alice=1, Bob=2 participant IDs
    )]
  ],
  sig: sign(eventHash, bobPrivateKey)
};
```

#### Phase 3: Execution
```javascript
// Combine threshold signatures and execute
const thresholdSignature = combineThresholdSignatures([
  alicePartialSig,
  bobPartialSig  
]);

// Verify threshold signature
const isValid = verify(
  thresholdSignature,
  governanceProposal.id, 
  governancePublicKey
);

if (isValid) {
  // Execute the governance change
  const executedGovernance = {
    pubkey: contentKeyPair.publicKey,
    tags: [
      ["editor", alicePubkey, "relay", "...", "..."],
      ["editor", bobPubkey, "relay", "...", "..."],
      // Charlie removed
      ["threshold", "content", "1", "2"],
      ["threshold", "governance", "2", "2"], // Now 2-of-2!
      ["governance_pubkey", governancePublicKey],
      ["executed_proposal", governanceProposal.id],
      ["execution_proof", thresholdSignature]
    ],
    content: previousContent,
    created_at: Math.floor(Date.now() / 1000),
    sig: sign(eventHash, contentKeyPair.privateKey)
  };
}
```

## Implementation Requirements

### Cryptographic Libraries Needed

#### Option 1: Pure JavaScript Implementation

**Pros**: No external dependencies, works in browsers
**Cons**: Need to implement Shamir's Secret Sharing

```javascript
// Required functions to implement:
function shamirCreateShares(secret, threshold, numShares) {
  // Generate polynomial coefficients
  // Evaluate polynomial at different points
  // Return shares as (x, y) coordinates
}

function shamirCombineShares(shares, threshold) {
  // Use Lagrange interpolation
  // Reconstruct secret from threshold shares
}

function thresholdSign(message, share, threshold, participantIds) {
  // Create partial signature using share
  // Return partial signature for combination
}

function combineThresholdSignatures(partialSigs) {
  // Combine partial signatures into full signature
  // Use Lagrange coefficients
}
```

#### Option 2: External Libraries

**For Node.js environments:**
```bash
npm install shamirs-secret-sharing
npm install threshold-signature-schemes
```

**For browsers:**
```html
<script src="https://cdn.jsdelivr.net/npm/shamirs-secret-sharing@1.0.1/index.js"></script>
```

### Compatibility with Existing Nostr Libraries

#### What Works Out of the Box
- **Event creation/signing**: Standard nostr libraries
- **NIP-44 encryption**: Existing implementations  
- **Relay communication**: Standard WebSocket
- **Event validation**: Standard signature verification

#### What Needs Extension
- **Shamir's Secret Sharing**: Not in nostr libraries
- **Threshold signatures**: Requires new implementation
- **Governance workflow**: New event kinds and validation logic

### Reference Implementation Structure

```javascript
class ThresholdGovernanceNIP68 {
  constructor(threshold, totalEditors) {
    this.threshold = threshold;
    this.totalEditors = totalEditors;
  }
  
  // Create initial shared document
  async createDocument(editors, content) {
    const contentKeyPair = generateKeyPair();
    const governanceShares = this.createGovernanceShares();
    
    return this.buildEvent(contentKeyPair, editors, governanceShares, content);
  }
  
  // Content update (single signature)
  async updateContent(contentPrivateKey, newContent, existingEvent) {
    return {
      ...existingEvent,
      content: newContent,
      created_at: Math.floor(Date.now() / 1000),
      sig: sign(eventHash, contentPrivateKey)
    };
  }
  
  // Governance proposal
  async proposeGovernanceChange(proposerKey, action, target, documentId) {
    // Create governance proposal event
  }
  
  // Threshold approval
  async approveGovernanceProposal(participantShare, proposalId) {
    // Create partial threshold signature
  }
  
  // Execute governance change
  async executeGovernance(partialSignatures, originalEvent) {
    // Combine signatures and update document
  }
}
```

## Edge Case Handling

### Two-Editor Deadlock Prevention

```json
{
  "tags": [
    ["editor", "alice_pubkey", "relay", "...", "..."],
    ["editor", "bob_pubkey", "relay", "...", "..."],  
    ["threshold", "governance", "2", "2"],
    ["deadlock_resolution", "timeout", "2592000"], // 30 days
    ["deadlock_resolution", "degraded_threshold", "1", "2"]
  ]
}
```

After 30 days of inactivity, threshold drops to 1-of-2 for governance operations.

### Key Recovery Mechanism  

```json
{
  "tags": [
    ["recovery_threshold", "1", "2"], // 1 of 2 can initiate recovery
    ["recovery_delay", "604800"],     // 7 day delay
    ["recovery_shares", "3", "5"]     // 3 of 5 recovery shares needed
  ]
}
```

### Graceful Degradation

```json
{
  "tags": [
    ["threshold", "governance", "2", "3"],
    ["inactive_timeout", "5184000"], // 60 days  
    ["degraded_threshold", "1", "2"] // If 1 editor inactive for 60d
  ]
}
```

## Security Considerations

### Threat Model

**Protected Against:**
- Unilateral editor removal
- Single point of failure
- Governance key compromise (requires threshold)

**Not Protected Against:**  
- Majority collusion (by design)
- All editors losing governance shares
- Relay censorship

### Best Practices

1. **Share Distribution**: Use secure channels for initial share distribution
2. **Backup Strategy**: Implement recovery mechanisms before going live
3. **Threshold Selection**: Choose thresholds that balance security and liveness
4. **Regular Rotation**: Periodically refresh governance shares
5. **Audit Trail**: Maintain logs of all governance operations

## Migration from Standard NIP-68

### Upgrade Path

1. **Create new threshold event** with same content
2. **Migrate editors** by giving them both keys
3. **Announce migration** through standard channels  
4. **Sunset old event** after grace period

### Backward Compatibility

Threshold governance events remain valid NIP-68 events. Clients without threshold support can still:
- Read content
- See editor list  
- Participate in content editing

They simply won't participate in governance operations.

## Conclusion

This specification provides self-governing shared documents without third-party dependencies, using established cryptographic primitives. The two-tier permission model maintains NIP-68's efficiency for content while adding democratic governance for structural changes.

Implementation requires extending existing nostr libraries with Shamir's Secret Sharing and threshold signature capabilities, but leverages standard Nostr infrastructure for everything else.

## Complete Architecture

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   TypeScript    │    │   Primary Relay  │    │   TypeScript    │
│   Client A      │◄──►│   (Golang)       │◄──►│   Client B      │
│   (Alice)       │    │                  │    │   (Bob)         │
└─────────────────┘    │  - Governance    │    └─────────────────┘
                       │    Event Store   │
┌─────────────────┐    │  - Threshold     │    ┌─────────────────┐
│   TypeScript    │◄──►│    Tracking      │◄──►│   TypeScript    │
│   Client C      │    │  - Race Cond.    │    │   Client D      │
│   (Charlie)     │    │    Prevention    │    │   (Dave)        │
└─────────────────┘    └──────────────────┘    └─────────────────┘