# Lookup: an autonomous self-organizing self-governing directory using Nostr

## directory general summary

- top section revolving advertising people can buy X sats per month or day, could use the classified kind
- next section is search bar for items
- nostr apps directory, nostr and bitcoin business directory
- All items are content that is originally sourced from nostr.net, however the items can each be transferred to the creator or owner as a nostr kind if they want to claim it. otherwise its just managed by nostr.net
- Anyone can create an entry which they own as a nostr data kind and add category tags, description, link, image etc.
- Any entry can be flagged as fraudulent and reported to nostr.net for removal if fake
- categories are created by users and can be voted? on by users

## reference existing model 

- see https://nostrhub.io

- Nostr hub is similar but different, in the nostr hub case, we have specifications, applications but not businesses, nor is there a revenue model for advertising. 
However, the existing template is a good starting point for a directory


## summarize files in this directory

- **NIP-68-extension.md**: Draft spec extending NIP-68 with threshold governance for shared replaceables, introducing editor lists, thresholds for content vs governance actions, and example tag structures/workflows.
- **nip68_threshold_governance.md**: Alternative draft of the same threshold governance proposal for NIP-68 with similar concepts and examples (editor tags, threshold tags, key distribution, and flow).
- **vitor_draft_68.md**: Original NIP-68 shared replaceables draft describing event-owned keys, encrypted sharing via `p` tags, and an encrypted shared replaceables model separating viewing and editing keys.
- **nostr.md**: Notes and analysis of SheetStr’s collaborative spreadsheet logic using Nostr (kind 35337), including relay usage, privacy modes (public vs encrypted), and permission model.
- **prototype.md**: Explanation of how SheetStr toggles public/private modes, detailing how tags/content are transformed, permissions updated, and implications during conversion.
- **prototype2.md**: Requirements brief for a directory prototype addressing issues like non‑Nostr submissions (relay-owned), max 5 editors, improved entry structure, and multiple WoT relays.
- **directory.html**: UI prototype for a Nostr Directory client (TailwindCSS) with entry creation, non‑Nostr mode, editor slot limits, relay selection (multi‑WoT), and category builder.
- **vitor_notes.md**: Short reference notes linking an RFC issue and relevant NIPs/NIP-68 draft sources.

## prototype ideas. 

summarize files in this directory