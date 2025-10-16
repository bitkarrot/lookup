# Lookup: an autonomous self-organizing self-governing directory using Nostr


## What was sent to the nostr mcp.json

Ok based on the Nostr MCP can you please design for me a directory with the following specifications: 

# Lookup: an autonomous self-organizing self-governing directory using Nostr

- top section of directory will have revolving advertising cards. each card can expand into a pop up with more detail.  nostr users can buy ads for X sats per month or day. Consider using the classified nostr kind for this.
- next section below the advertising section is a search bar for items in the directory. 
- below this search bar, we should see tabs for a nostr apps directory, nostr business directory, a bitcoin business directory, and a follow packs directory
- All directory items are originally sourced from a list located at nostr.net. However the items can each be transferred to the creator or owner as a nostr kind if they want to claim it. otherwise the entries are managed as as nostr data.
- Anyone can login as a nostr user and can create an entry which they own and add category tags, description, link, image etc. if a nostr user creates an entry then they are responsible for updating the nostr data. Entries can be owned and moderated by more than one nostr user. The ownership is controlled by the entry creator, and they can designate other moderators to update and edit the data.
- Allow a non-nostr user to submit data for an entry in the directory. If they are not a nostr user, the data will be owned by the directory's nostr pubkey.
- Any entry can be flagged as fraudulent and reported to nostr.net for removal if fake. If more than 5 nostr users flag an entry as fraud or fake, the entry is automatically removed and not visible in the directory. 
- The directory's categories are created by users and can be purchased for a fee if the category does not exist yet. 

## A Reference to a similar but different directory model 

- Nostr hub, located at  https://nostrhub.io,  is similar but different to our Lookup directory.  In the nostr hub case, we have specifications, applications but not businesses, nor is there a revenue model for advertising.  However, the existing template is a good starting point for a directory UI
- here is the source code for nostrhub https://gitlab.com/soapbox-pub/nostrhub

Do not make a code implementation just write out a design using nostr specifications. 

once we approve of the design using correct nostr NIPs for the implementation, then we will proceed to the coding portion. 


## summarize the OTHER files in this directory

- **NIP-68-extension.md**: Draft spec extending NIP-68 with threshold governance for shared replaceables, introducing editor lists, thresholds for content vs governance actions, and example tag structures/workflows.
- **nip68_threshold_governance.md**: Alternative draft of the same threshold governance proposal for NIP-68 with similar concepts and examples (editor tags, threshold tags, key distribution, and flow).
- **vitor_draft_68.md**: Original NIP-68 shared replaceables draft describing event-owned keys, encrypted sharing via `p` tags, and an encrypted shared replaceables model separating viewing and editing keys.
- **nostr.md**: Notes and analysis of SheetStr’s collaborative spreadsheet logic using Nostr (kind 35337), including relay usage, privacy modes (public vs encrypted), and permission model.
- **prototype.md**: Explanation of how SheetStr toggles public/private modes, detailing how tags/content are transformed, permissions updated, and implications during conversion.
- **prototype2.md**: Requirements brief for a directory prototype addressing issues like non‑Nostr submissions (relay-owned), max 5 editors, improved entry structure, and multiple WoT relays.
- **directory.html**: UI prototype for a Nostr Directory client (TailwindCSS) with entry creation, non‑Nostr mode, editor slot limits, relay selection (multi‑WoT), and category builder.
- **vitor_notes.md**: Short reference notes linking an RFC issue and relevant NIPs/NIP-68 draft sources.
