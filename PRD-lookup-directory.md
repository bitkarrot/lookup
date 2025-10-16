# Product Requirements Document: Lookup Nostr Directory

## Executive Summary

The Lookup Directory is a decentralized, autonomous directory system built on the Nostr protocol. It features advertising revenue, user-owned entries, community moderation, and multi-category organization. This PRD breaks down the implementation into discrete coding tasks for systematic development.

## Project Overview

### Vision
Create a self-organizing, economically sustainable directory that leverages Nostr's decentralized architecture for content ownership, moderation, and monetization.

### Success Metrics
- **User Adoption**: 1000+ directory entries within 6 months
- **Revenue**: $1000+ monthly from ads and category purchases
- **Community Health**: <2% fraud reports, 95% user satisfaction
- **Technical Performance**: <2s load times, 99.9% uptime

## Implementation Phases & Coding Tasks

## Phase 1: Core Infrastructure (Weeks 1-4)

### 1.1 Project Setup & Architecture
**Estimated Time**: 3 days

**Tasks**:
- [ ] Initialize Next.js 14 project with TypeScript
- [ ] Configure TailwindCSS and shadcn/ui components
- [ ] Set up project structure with proper folder organization
- [ ] Configure ESLint, Prettier, and TypeScript strict mode
- [ ] Set up environment variables and configuration management

**Deliverables**:
- Working Next.js application with proper tooling
- Component library setup with shadcn/ui
- Development environment configuration

### 1.2 Nostr Integration Foundation
**Estimated Time**: 5 days

**Tasks**:
- [ ] Install and configure nostr-tools library
- [ ] Create Nostr client wrapper with connection management
- [ ] Implement relay connection pool with failover
- [ ] Create event publishing and subscription utilities
- [ ] Add NIP-07 browser extension integration for key management
- [ ] Implement event validation and signature verification

**Code Components**:
```typescript
// lib/nostr/client.ts
export class NostrClient {
  connect(relays: string[]): Promise<void>
  publish(event: NostrEvent): Promise<void>
  subscribe(filters: Filter[]): Subscription
}

// lib/nostr/events.ts
export function createEvent(kind: number, content: string, tags: string[][]): NostrEvent
export function validateEvent(event: NostrEvent): boolean
```

**Deliverables**:
- Nostr client library with relay management
- Event creation and validation utilities
- Browser extension integration

### 1.3 Database Schema & Storage
**Estimated Time**: 4 days

**Tasks**:
- [ ] Design SQLite/PostgreSQL schema for local caching
- [ ] Create database models for entries, categories, users
- [ ] Implement event storage and indexing system
- [ ] Add full-text search capabilities
- [ ] Create data migration system
- [ ] Set up backup and sync mechanisms

**Database Schema**:
```sql
-- Directory entries cache
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  event_id TEXT UNIQUE,
  title TEXT NOT NULL,
  content TEXT,
  category TEXT,
  owner_pubkey TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  status TEXT DEFAULT 'active'
);

-- Categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE,
  creator_pubkey TEXT,
  price_sats INTEGER,
  created_at INTEGER
);
```

**Deliverables**:
- Database schema and migrations
- ORM/query layer setup
- Search indexing system

## Phase 2: Core Directory Features (Weeks 5-8)

### 2.1 Directory Entry System
**Estimated Time**: 6 days

**Tasks**:
- [ ] Create entry creation form with validation
- [ ] Implement NIP-99 classified listing event generation
- [ ] Add image upload and IPFS/media server integration
- [ ] Create entry display components with responsive design
- [ ] Implement entry editing for owners/moderators
- [ ] Add entry status management (active/inactive/draft)

**Components**:
```typescript
// components/EntryForm.tsx
export function EntryForm({ onSubmit, initialData? }: EntryFormProps)

// components/EntryCard.tsx
export function EntryCard({ entry, showActions? }: EntryCardProps)

// lib/entries/create.ts
export function createDirectoryEntry(data: EntryData): Promise<NostrEvent>
```

**Deliverables**:
- Entry CRUD operations
- Form validation and UI components
- Media handling system

### 2.2 Category Management System
**Estimated Time**: 4 days

**Tasks**:
- [ ] Create category creation interface
- [ ] Implement category purchase flow with Lightning
- [ ] Add category browsing and filtering
- [ ] Create category moderation tools
- [ ] Implement hierarchical category structure
- [ ] Add category search and autocomplete

**Components**:
```typescript
// components/CategoryManager.tsx
export function CategoryManager({ userPubkey }: CategoryManagerProps)

// lib/categories/purchase.ts
export function purchaseCategory(name: string, priceSats: number): Promise<string>
```

**Deliverables**:
- Category management interface
- Purchase flow integration
- Category hierarchy system

### 2.3 Search Implementation
**Estimated Time**: 5 days

**Tasks**:
- [ ] Create search bar component with autocomplete
- [ ] Implement client-side search with Fuse.js
- [ ] Add NIP-50 relay search integration
- [ ] Create advanced search filters (category, date, owner)
- [ ] Implement search result pagination
- [ ] Add search analytics and popular queries

**Components**:
```typescript
// components/SearchBar.tsx
export function SearchBar({ onSearch, placeholder }: SearchBarProps)

// lib/search/engine.ts
export class SearchEngine {
  search(query: string, filters?: SearchFilters): Promise<SearchResult[]>
}
```

**Deliverables**:
- Comprehensive search system
- Filter and pagination UI
- Search performance optimization

### 2.4 Tab Organization System
**Estimated Time**: 4 days

**Tasks**:
- [ ] Create tab navigation component
- [ ] Implement NIP-51 list management for each tab
- [ ] Add drag-and-drop entry organization
- [ ] Create tab-specific filtering and sorting
- [ ] Implement tab customization for users
- [ ] Add tab analytics and usage tracking

**Components**:
```typescript
// components/DirectoryTabs.tsx
export function DirectoryTabs({ activeTab, onTabChange }: DirectoryTabsProps)

// lib/tabs/manager.ts
export function updateTabContents(tabId: string, entries: string[]): Promise<void>
```

**Deliverables**:
- Tab navigation system
- List management integration
- User customization features

## Phase 3: User Authentication & Ownership (Weeks 9-12)

### 3.1 User Authentication System
**Estimated Time**: 5 days

**Tasks**:
- [ ] Implement NIP-07 extension authentication
- [ ] Create user profile management (NIP-01 kind:0)
- [ ] Add NIP-05 DNS identifier verification
- [ ] Implement session management and persistence
- [ ] Create user onboarding flow
- [ ] Add backup key management options

**Components**:
```typescript
// components/AuthProvider.tsx
export function AuthProvider({ children }: AuthProviderProps)

// hooks/useAuth.ts
export function useAuth(): AuthState

// lib/auth/nostr.ts
export function authenticateWithExtension(): Promise<UserProfile>
```

**Deliverables**:
- Complete authentication system
- User profile management
- Session persistence

### 3.2 Entry Ownership & Claims
**Estimated Time**: 6 days

**Tasks**:
- [ ] Create entry claiming interface for nostr.net imports
- [ ] Implement ownership transfer mechanisms
- [ ] Add multi-moderator support with permissions
- [ ] Create ownership verification system
- [ ] Implement claim code generation and validation
- [ ] Add ownership dispute resolution tools

**Components**:
```typescript
// components/ClaimEntry.tsx
export function ClaimEntry({ entryId, claimCode }: ClaimEntryProps)

// lib/ownership/claims.ts
export function claimEntry(entryId: string, claimCode: string): Promise<boolean>
```

**Deliverables**:
- Entry claiming system
- Ownership management tools
- Multi-moderator support

### 3.3 Non-Nostr User Support
**Estimated Time**: 4 days

**Tasks**:
- [ ] Create web form for non-Nostr submissions
- [ ] Implement email notification system
- [ ] Add claim code generation and distribution
- [ ] Create conversion flow from non-Nostr to Nostr user
- [ ] Implement temporary entry management
- [ ] Add user education and onboarding materials

**Components**:
```typescript
// components/NonNostrSubmission.tsx
export function NonNostrSubmissionForm({ onSubmit }: NonNostrFormProps)

// lib/submissions/nonNostr.ts
export function createNonNostrEntry(data: SubmissionData): Promise<ClaimCode>
```

**Deliverables**:
- Non-Nostr submission system
- Claim code management
- User conversion flow

## Phase 4: Monetization & Advertising (Weeks 13-16)

### 4.1 Lightning Integration
**Estimated Time**: 6 days

**Tasks**:
- [ ] Integrate Lightning wallet (LND/CLN) or service (Strike/ZBD)
- [ ] Implement NIP-57 zap functionality
- [ ] Create invoice generation and payment verification
- [ ] Add payment status tracking and notifications
- [ ] Implement automatic payment processing
- [ ] Create payment history and analytics

**Components**:
```typescript
// lib/lightning/client.ts
export class LightningClient {
  createInvoice(amountSats: number, description: string): Promise<Invoice>
  verifyPayment(paymentHash: string): Promise<PaymentStatus>
}

// components/PaymentModal.tsx
export function PaymentModal({ invoice, onPayment }: PaymentModalProps)
```

**Deliverables**:
- Lightning payment system
- Invoice management
- Payment verification

### 4.2 Advertising System
**Estimated Time**: 7 days

**Tasks**:
- [ ] Create advertising card components with animations
- [ ] Implement ad purchase flow with Lightning payments
- [ ] Add ad scheduling and rotation system
- [ ] Create ad performance analytics dashboard
- [ ] Implement ad approval and moderation tools
- [ ] Add ad targeting and placement optimization

**Components**:
```typescript
// components/AdCard.tsx
export function AdCard({ ad, onExpand }: AdCardProps)

// components/AdPurchase.tsx
export function AdPurchaseFlow({ onComplete }: AdPurchaseProps)

// lib/ads/scheduler.ts
export class AdScheduler {
  scheduleAd(ad: Advertisement, duration: number): Promise<void>
}
```

**Deliverables**:
- Advertising display system
- Ad purchase and management
- Analytics dashboard

### 4.3 Revenue Management
**Estimated Time**: 4 days

**Tasks**:
- [ ] Create revenue tracking and reporting system
- [ ] Implement automatic revenue distribution
- [ ] Add financial analytics and forecasting
- [ ] Create invoicing and accounting integration
- [ ] Implement revenue sharing for moderators
- [ ] Add tax reporting and compliance tools

**Components**:
```typescript
// lib/revenue/tracker.ts
export class RevenueTracker {
  trackPayment(payment: Payment): Promise<void>
  generateReport(period: DateRange): Promise<RevenueReport>
}
```

**Deliverables**:
- Revenue tracking system
- Financial reporting tools
- Compliance features

## Phase 5: Community & Moderation (Weeks 17-20)

### 5.1 Fraud Reporting System
**Estimated Time**: 5 days

**Tasks**:
- [ ] Create fraud reporting interface (NIP-56)
- [ ] Implement automatic entry removal at 5+ reports
- [ ] Add report validation and spam prevention
- [ ] Create moderation dashboard for administrators
- [ ] Implement appeal and dispute resolution system
- [ ] Add reporter reputation and trust scoring

**Components**:
```typescript
// components/ReportModal.tsx
export function ReportModal({ entryId, onReport }: ReportModalProps)

// lib/moderation/reports.ts
export function submitReport(entryId: string, reason: string): Promise<void>
export function checkReportThreshold(entryId: string): Promise<boolean>
```

**Deliverables**:
- Fraud reporting system
- Automatic moderation tools
- Appeal process

### 5.2 Community Features
**Estimated Time**: 6 days

**Tasks**:
- [ ] Create follow packs system (NIP-51)
- [ ] Implement user reputation and trust networks
- [ ] Add community voting and governance tools
- [ ] Create discussion and comment system
- [ ] Implement social features (likes, shares, bookmarks)
- [ ] Add community guidelines and enforcement

**Components**:
```typescript
// components/FollowPack.tsx
export function FollowPackCard({ pack, onFollow }: FollowPackProps)

// lib/community/reputation.ts
export function calculateUserReputation(pubkey: string): Promise<ReputationScore>
```

**Deliverables**:
- Follow pack system
- Community engagement tools
- Reputation system

### 5.3 Analytics & Insights
**Estimated Time**: 4 days

**Tasks**:
- [ ] Create user analytics dashboard
- [ ] Implement entry performance tracking
- [ ] Add community health metrics
- [ ] Create business intelligence reports
- [ ] Implement A/B testing framework
- [ ] Add user behavior analytics

**Components**:
```typescript
// components/AnalyticsDashboard.tsx
export function AnalyticsDashboard({ userPubkey }: AnalyticsProps)

// lib/analytics/tracker.ts
export function trackEvent(event: AnalyticsEvent): Promise<void>
```

**Deliverables**:
- Analytics dashboard
- Performance metrics
- Business intelligence tools

## Phase 6: Advanced Features & Polish (Weeks 21-24)

### 6.1 Performance Optimization
**Estimated Time**: 5 days

**Tasks**:
- [ ] Implement lazy loading and virtualization
- [ ] Add service worker for offline functionality
- [ ] Optimize bundle size and code splitting
- [ ] Implement caching strategies (Redis/memory)
- [ ] Add CDN integration for media assets
- [ ] Optimize database queries and indexing

**Deliverables**:
- Performance optimizations
- Offline functionality
- Caching system

### 6.2 Mobile & PWA Features
**Estimated Time**: 6 days

**Tasks**:
- [ ] Create responsive mobile design
- [ ] Implement PWA manifest and service worker
- [ ] Add push notifications for important events
- [ ] Create mobile-specific UI components
- [ ] Implement touch gestures and interactions
- [ ] Add app store deployment preparation

**Deliverables**:
- Mobile-optimized interface
- PWA functionality
- Push notification system

### 6.3 Integration & Migration
**Estimated Time**: 4 days

**Tasks**:
- [ ] Create nostr.net data import tools
- [ ] Implement backup and export functionality
- [ ] Add API endpoints for third-party integrations
- [ ] Create migration scripts and tools
- [ ] Implement data validation and cleanup
- [ ] Add integration testing suite

**Deliverables**:
- Data migration tools
- API integration
- Backup systems

## Technical Requirements

### Frontend Stack
- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS + shadcn/ui components
- **State Management**: Zustand or React Context
- **Forms**: React Hook Form + Zod validation
- **Animations**: Framer Motion

### Backend & Infrastructure
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for session and data caching
- **File Storage**: IPFS or S3-compatible storage
- **Lightning**: LND/CLN node or ZBD/Strike API
- **Deployment**: Vercel/Netlify with Docker containers

### Nostr Libraries
- **Core**: nostr-tools for event handling
- **Relay**: nostr-relay-pool for connection management
- **Extensions**: NIP-07 browser extension integration
- **Validation**: Custom validation for NIP compliance

## Quality Assurance

### Testing Strategy
- **Unit Tests**: Jest + React Testing Library (80% coverage)
- **Integration Tests**: Playwright for E2E testing
- **Performance Tests**: Lighthouse CI integration
- **Security Tests**: OWASP compliance checking

### Code Quality
- **Linting**: ESLint with strict TypeScript rules
- **Formatting**: Prettier with consistent configuration
- **Type Safety**: Strict TypeScript with no any types
- **Documentation**: JSDoc comments for all public APIs

## Risk Mitigation

### Technical Risks
- **Nostr Relay Reliability**: Implement multi-relay failover
- **Lightning Payment Issues**: Add payment retry and fallback
- **Scalability Concerns**: Design for horizontal scaling
- **Security Vulnerabilities**: Regular security audits

### Business Risks
- **Low User Adoption**: Implement referral and incentive programs
- **Revenue Shortfall**: Diversify monetization strategies
- **Community Toxicity**: Strong moderation and governance tools
- **Regulatory Issues**: Legal compliance and terms of service

## Success Criteria

### Phase 1 Success
- [ ] Working Nostr integration with 3+ relays
- [ ] Basic entry creation and display
- [ ] Search functionality working
- [ ] Mobile-responsive design

### Phase 2 Success
- [ ] 100+ directory entries created
- [ ] Category system with 10+ categories
- [ ] User authentication working
- [ ] Basic moderation tools functional

### Phase 3 Success
- [ ] Lightning payments processing
- [ ] Advertising system generating revenue
- [ ] Community features active
- [ ] Performance targets met (<2s load time)

### Final Success
- [ ] 1000+ active entries
- [ ] $1000+ monthly recurring revenue
- [ ] 95%+ user satisfaction score
- [ ] 99.9% uptime achieved

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1 | 4 weeks | Core infrastructure, Nostr integration |
| Phase 2 | 4 weeks | Directory features, search, categories |
| Phase 3 | 4 weeks | Authentication, ownership, claims |
| Phase 4 | 4 weeks | Lightning, advertising, revenue |
| Phase 5 | 4 weeks | Moderation, community features |
| Phase 6 | 4 weeks | Polish, optimization, launch prep |

**Total Timeline**: 24 weeks (6 months)
**Team Size**: 2-3 developers + 1 designer
**Budget Estimate**: $150,000 - $200,000

This PRD provides a comprehensive roadmap for implementing the Lookup Nostr Directory with clear, actionable coding tasks that can be tackled systematically by development teams or AI coding assistants.
