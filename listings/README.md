# Zap-Gated Nostr Directory Implementation

This directory contains the implementation for a payment-required Nostr directory using NIP-57 zaps and NIP-99 classified listings (kind 30402).

## Overview

The system allows users to submit directory entries that require payment via Lightning zaps if they're not part of the relay's web of trust network.

## Flow

1. **User Authentication**: User logs in with Nostr extension (NIP-07)
2. **Form Submission**: User fills out directory entry form
3. **Trust Check**: System checks if user is in web of trust network
4. **Payment Flow**: If not trusted, user must pay Lightning invoice via zap
5. **Entry Publication**: After payment verification, entry is published to relay

## Files

- `web-interface.html` - Frontend form for directory submissions
- `relay-payment-handler.js` - Server-side payment validation logic
- `zap-integration.js` - Client-side zap handling
- `directory-schema.js` - Data models and validation
- `example-usage.js` - Sample implementation code

## Key Features

- **NIP-57 Zap Integration**: Uses standard Lightning zaps for payments
- **NIP-99 Compliance**: Directory entries use kind 30402 classified listings
- **Web of Trust**: Trusted users can post without payment
- **Payment Verification**: Relay validates zap receipts before publishing entries
- **Modern UI**: Clean, responsive interface using modern web standards

## Technical Details

The implementation adapts NIP-57 zaps (typically used for kind 1 notes) to work with kind 30402 classified listings by:

1. Creating a zap request that references the directory entry event
2. Using the relay's pubkey as the zap recipient
3. Validating zap receipts before allowing entry publication
4. Storing payment proofs for audit purposes
