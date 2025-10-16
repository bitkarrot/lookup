# Lookup Directory Design: Nostr-Based Autonomous Directory System

## Overview

The Lookup directory will be a decentralized, self-organizing directory built on Nostr protocol, featuring advertising, multiple directory categories, user ownership, and community moderation. This design leverages existing Nostr NIPs to create a comprehensive, autonomous directory system.

## Core Event Kinds & NIPs Used

### 1. **Advertising System** 
- **NIP-99 (Classified Listings)** - `kind:30402` for active ads, `kind:30403` for draft/inactive ads
- **NIP-57 (Lightning Zaps)** - For payment processing
- **NIP-40 (Expiration Timestamp)** - For time-based ad expiration

### 2. **Directory Entries**
- **NIP-99 (Classified Listings)** - `kind:30402` for directory entries
- **NIP-32 (Labeling)** - `kind:1985` for categorization and tagging
- **NIP-51 (Lists)** - Various list types for organization

### 3. **User Management & Authentication**
- **NIP-01 (Basic Protocol)** - `kind:0` for user metadata
- **NIP-07 (Browser Extension)** - For Nostr key management
- **NIP-05 (DNS Identifiers)** - For verified identities

### 4. **Moderation & Reporting**
- **NIP-56 (Reporting)** - `kind:1984` for fraud/fake reports
- **NIP-32 (Labeling)** - For community-driven content classification

### 5. **Categories & Organization**
- **NIP-51 (Lists)** - Custom category sets using `kind:30015` (Interest sets)
- **NIP-32 (Labeling)** - For hierarchical categorization

## Detailed System Design

### 1. Advertising Cards System

The top section features revolving advertising cards that users can purchase with Lightning payments.

**Event Structure for Ads:**
```json
{
  "kind": 30402,
  "content": "Premium Nostr client with advanced features...",
  "tags": [
    ["d", "ad-unique-id-123"],
    ["title", "Damus Pro - Premium Nostr Client"],
    ["summary", "Advanced Nostr client with premium features"],
    ["published_at", "1703980800"],
    ["location", "Global"],
    ["price", "21000", "sats", "month"],
    ["status", "active"],
    ["t", "advertising"],
    ["t", "nostr-app"],
    ["L", "lookup.directory"],
    ["l", "advertisement", "lookup.directory"],
    ["l", "featured", "lookup.directory"],
    ["image", "https://example.com/ad-image.jpg", "400x300"],
    ["expiration", "1706659200"],
    ["zap", "advertiser-pubkey", "wss://relay.example.com", "1"]
  ],
  "pubkey": "advertiser-pubkey",
  "created_at": 1703980800
}
```

**Payment Integration:**
- Advertisers pay via Lightning using NIP-57 zaps
- Payment amounts determine ad placement priority and duration
- Automatic expiration using NIP-40 expiration timestamps
- Cards can expand into popups with detailed information

### 2. Directory Entry Structure

Each directory entry uses NIP-99 classified listings with enhanced metadata for the directory system.

**Main Directory Entry (NIP-99):**
```json
{
  "kind": 30402,
  "content": "Comprehensive Bitcoin and Lightning development tools...",
  "tags": [
    ["d", "entry-bitcoin-dev-kit"],
    ["title", "Bitcoin Development Kit"],
    ["summary", "Rust Bitcoin library for building wallets"],
    ["published_at", "1703980800"],
    ["location", "Global"],
    ["status", "active"],
    ["t", "bitcoin"],
    ["t", "development"],
    ["t", "rust"],
    ["L", "lookup.directory"],
    ["l", "bitcoin-business", "lookup.directory"],
    ["l", "verified", "lookup.directory"],
    ["image", "https://bitcoindevkit.org/logo.png"],
    ["r", "https://bitcoindevkit.org"],
    ["r", "https://github.com/bitcoindevkit/bdk"],
    ["zap", "owner-pubkey", "wss://relay.example.com", "1"],
    ["owner", "owner-pubkey"],
    ["moderator", "mod1-pubkey"],
    ["moderator", "mod2-pubkey"],
    ["source", "nostr.net", "imported"],
    ["claimed", "1703980800"]
  ],
  "pubkey": "owner-or-directory-pubkey"
}
```

**Entry Ownership Model:**
- Entries can be owned by individual users or the directory
- Multiple moderators can be assigned to manage entries
- Original nostr.net entries start as directory-owned until claimed
- Ownership transfers require moderator consensus

### 3. Category Management System

Categories are user-created and can be purchased for a fee if they don't exist yet.

**Category Creation (NIP-51 Interest Sets):**
```json
{
  "kind": 30015,
  "content": "Bitcoin-related applications and services",
  "tags": [
    ["d", "bitcoin-category"],
    ["title", "Bitcoin Applications"],
    ["description", "Apps and services in the Bitcoin ecosystem"],
    ["t", "bitcoin"],
    ["t", "lightning"],
    ["t", "wallet"],
    ["t", "exchange"],
    ["price", "100000", "sats"],
    ["creator", "category-creator-pubkey"],
    ["L", "lookup.directory"],
    ["l", "category", "lookup.directory"]
  ],
  "pubkey": "category-creator-pubkey"
}
```

**Category Purchase System:**
- New categories require Lightning payment (e.g., 100k sats)
- Category creators become initial moderators
- Categories can have multiple moderators added over time
- Revenue from category sales funds directory operations

### 4. Directory Tabs Structure

The directory is organized into four main tabs, each implemented using NIP-51 lists.

#### Nostr Apps Directory (`kind:30004` - Curation Sets)
```json
{
  "kind": 30004,
  "tags": [
    ["d", "nostr-apps"],
    ["title", "Nostr Applications"],
    ["description", "Curated list of Nostr applications"],
    ["a", "30402:pubkey1:damus-app"],
    ["a", "30402:pubkey2:amethyst-app"],
    ["a", "30402:pubkey3:iris-app"],
    ["L", "lookup.directory"],
    ["l", "nostr-apps", "lookup.directory"]
  ]
}
```

#### Nostr Business Directory
```json
{
  "kind": 30004,
  "tags": [
    ["d", "nostr-business"],
    ["title", "Nostr Businesses"],
    ["description", "Businesses built on or supporting Nostr"],
    ["a", "30402:pubkey1:nostr-service1"],
    ["a", "30402:pubkey2:nostr-merchant1"],
    ["L", "lookup.directory"],
    ["l", "nostr-business", "lookup.directory"]
  ]
}
```

#### Bitcoin Business Directory
```json
{
  "kind": 30004,
  "tags": [
    ["d", "bitcoin-business"],
    ["title", "Bitcoin Businesses"],
    ["description", "Bitcoin-accepting businesses and services"],
    ["a", "30402:pubkey1:btc-merchant1"],
    ["a", "30402:pubkey2:btc-service1"],
    ["L", "lookup.directory"],
    ["l", "bitcoin-business", "lookup.directory"]
  ]
}
```

#### Follow Packs Directory (`kind:30000` - Follow Sets)
```json
{
  "kind": 30000,
  "tags": [
    ["d", "bitcoin-devs"],
    ["title", "Bitcoin Developers"],
    ["description", "Key Bitcoin developers to follow"],
    ["p", "dev1-pubkey", "wss://relay.example.com", "Bitcoin Core Dev"],
    ["p", "dev2-pubkey", "wss://relay.example.com", "Lightning Dev"],
    ["L", "lookup.directory"],
    ["l", "follow-pack", "lookup.directory"]
  ]
}
```

### 5. Search Implementation

The search bar supports multiple search strategies for comprehensive discovery.

**Search Strategy:**
- Use NIP-50 (Search Capability) where available on relays
- Fallback to tag-based filtering for broader compatibility
- Client-side search for enhanced user experience
- Search across: titles, descriptions, tags, categories

**Search Query Examples:**
```javascript
// Search for Bitcoin apps
{
  "kinds": [30402],
  "#t": ["bitcoin", "app"],
  "#l": ["nostr-apps"]
}

// Search by category
{
  "kinds": [30402],
  "#l": ["bitcoin-business"]
}

// Full-text search (NIP-50)
{
  "kinds": [30402],
  "search": "lightning wallet"
}
```

### 6. Fraud Reporting & Moderation System

Community-driven moderation using NIP-56 reporting with automatic removal thresholds.

**Fraud Report (NIP-56):**
```json
{
  "kind": 1984,
  "content": "This entry appears to be a scam impersonating a legitimate service",
  "tags": [
    ["e", "fraudulent-entry-id", "impersonation"],
    ["p", "entry-owner-pubkey"],
    ["L", "lookup.directory"],
    ["l", "fraud-report", "lookup.directory"],
    ["reporter", "reporter-pubkey"]
  ],
  "pubkey": "reporter-pubkey"
}
```

**Automatic Removal Logic:**
- Query for reports: `{"kinds": [1984], "#e": ["entry-id"]}`
- Count unique reporter pubkeys
- If ≥5 unique reporters flag an entry, automatically hide it
- Entry owners can appeal through dispute process
- Reports to nostr.net for permanent removal consideration

### 7. Non-Nostr User Submissions

Support for users without Nostr keys to submit directory entries.

**Directory-Owned Entry:**
```json
{
  "kind": 30402,
  "content": "Submitted by non-Nostr user via web form",
  "tags": [
    ["d", "non-nostr-submission-123"],
    ["title", "Local Bitcoin Meetup"],
    ["summary", "Weekly Bitcoin meetup in San Francisco"],
    ["L", "lookup.directory"],
    ["l", "non-nostr-submission", "lookup.directory"],
    ["l", "pending-claim", "lookup.directory"],
    ["submitted_by", "email@example.com"],
    ["submission_method", "web-form"],
    ["claim_code", "ABC123XYZ"]
  ],
  "pubkey": "lookup-directory-pubkey"
}
```

**Non-Nostr Submission Process:**
1. User submits via web form without Nostr key
2. Directory creates entry owned by directory pubkey
3. Unique claim code generated and provided to submitter
4. Submitter can later claim ownership with Nostr key + claim code

### 8. Entry Claiming Process

Allow users to claim ownership of directory entries, especially those imported from nostr.net.

**Claim Request Event:**
```json
{
  "kind": 1,
  "content": "I am claiming ownership of this directory entry",
  "tags": [
    ["e", "entry-to-claim-id"],
    ["claim_code", "ABC123XYZ"],
    ["L", "lookup.directory"],
    ["l", "ownership-claim", "lookup.directory"]
  ],
  "pubkey": "claiming-user-pubkey"
}
```

**Claiming Process:**
1. User finds unclaimed entry (imported from nostr.net or non-Nostr submission)
2. User provides claim code or verification method
3. Directory validates claim and transfers ownership
4. Entry is updated with new owner pubkey
5. User gains full control over entry updates

### 9. Multi-Moderator Ownership

Entries can be managed by multiple users with different permission levels.

**Moderator Management:**
- Entry creators can add/remove moderators via `moderator` tags
- Moderators can update entry content and metadata
- Ownership transfers require majority moderator approval
- Use NIP-26 (Delegated Event Signing) for moderator permissions

**Moderator Actions:**
- Update entry content and tags
- Add/remove other moderators (with creator approval)
- Respond to fraud reports
- Transfer ownership (consensus required)

### 10. Revenue Model Integration

Multiple revenue streams to sustain directory operations.

**Payment Flows:**
1. **Ad Purchases:** NIP-57 zaps to directory pubkey for advertising slots
2. **Category Creation:** Lightning payment for creating new categories  
3. **Premium Listings:** Enhanced visibility for paid entries
4. **Verification Badges:** Paid verification for businesses and apps

**Revenue Distribution:**
- Directory operations and development
- Relay hosting and infrastructure
- Community moderator incentives
- Feature development fund

### 11. Data Sources & Migration

Seamless integration with existing nostr.net directory data.

**nostr.net Integration:**
- Import existing entries as directory-owned events
- Provide claim codes for original submitters
- Gradual migration to user-owned entries
- Maintain compatibility with existing data structure
- Preserve historical data and relationships

**Migration Strategy:**
1. Bulk import nostr.net entries as `kind:30402` events
2. Generate claim codes for each entry
3. Notify original submitters via available contact methods
4. Allow gradual claiming and ownership transfer
5. Maintain unclaimed entries under directory ownership

### 12. Relay Strategy

Distributed relay architecture for resilience and performance.

**Multi-Relay Architecture:**
- Primary relays for core directory data
- Specialized relays for different categories
- User-chosen relays for personal entries
- Backup/archive relays for data persistence
- Geographic distribution for global access

**Relay Selection:**
- Users can choose preferred relays for their entries
- Directory maintains list of recommended relays
- Automatic failover for high availability
- Relay quality scoring based on performance

## Implementation Phases

### Phase 1: Core Directory (MVP)
- Basic entry creation and viewing
- Simple categorization system
- Search functionality
- Non-Nostr user submissions
- Basic UI with four main tabs

### Phase 2: User Ownership & Claims
- Entry claiming system for nostr.net imports
- Multi-moderator support
- User authentication via NIP-07
- Ownership transfer mechanisms

### Phase 3: Monetization & Advertising
- Advertising card system with Lightning payments
- Category purchase system
- Premium listing features
- Revenue distribution mechanisms

### Phase 4: Advanced Features & Governance
- Fraud reporting and community moderation
- Advanced search with NIP-50 support
- Follow packs and social features
- Community governance mechanisms
- Analytics and insights

## Technical Considerations

### Security
- All user actions require valid Nostr signatures
- Multi-signature requirements for sensitive operations
- Rate limiting for spam prevention
- Content validation and sanitization

### Performance
- Efficient event querying and caching
- Client-side search for responsive UX
- Lazy loading for large directories
- Optimized relay selection

### Scalability
- Horizontal scaling via multiple relays
- Category-based data partitioning
- Efficient indexing strategies
- CDN integration for media content

### User Experience
- Progressive web app for cross-platform access
- Offline capability with local caching
- Intuitive onboarding for non-Nostr users
- Mobile-responsive design

## Conclusion

This design creates a comprehensive, decentralized directory system that leverages the Nostr protocol's strengths while addressing the specific requirements for advertising, user ownership, community moderation, and economic sustainability. The system is designed to be autonomous, self-organizing, and economically viable through its built-in monetization mechanisms.

The phased implementation approach allows for iterative development and user feedback incorporation, ensuring the final product meets community needs while maintaining technical excellence and decentralization principles.
