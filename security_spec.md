# Security Specification for Crosslink Knowledge Graph RAG

## 1. Data Invariants
1. **Identity & Ownership Integrity**: A user can only create, update, and delete documents, chunks, entities, relationships, and conversations tagged with their authenticated UID (`userId == request.auth.uid`).
2. **Path Hardening**: All document IDs must be alphanumeric strings with hyphens/underscores under 128 characters (`isValidId`).
3. **No Blanket Queries**: All `list` operations enforce `resource.data.userId == request.auth.uid` or restricted scope.
4. **Immutability of Ownership & Timestamps**: The `userId` and initial `createdAt` cannot be changed during an update.
5. **Bounded Sizes**: String fields and array bounds are strictly enforced (e.g. document name <= 256, chunk text <= 10000, snippet <= 2000).
6. **No Ghost Fields**: Document create requires all mandatory fields and restricts unknown arbitrary keys.

## 2. Dirty Dozen Malicious Payloads
1. **Ghost Field Injection**: Adding `isAdmin: true` or `role: 'superadmin'` to document metadata.
2. **Identity Spoofing**: Setting `userId: 'victim_uid'` while authenticated as `attacker_uid`.
3. **Denial of Wallet (Giant String)**: Attempting to upload a 5MB payload in a single entity title or chunk text.
4. **Path Traversal / ID Poisoning**: Using `../../etc/passwd` or `%00` as documentId.
5. **Orphaned Write**: Creating a chunk or relationship pointing to an invalid entity ID.
6. **Update Hijack**: Changing the `userId` on existing document to take ownership.
7. **Type Confusion**: Passing a boolean or array where a string title or numeric chunkIndex is expected.
8. **Invalid Enum**: Passing `type: 'MaliciousExecutable'` instead of recognized entity types.
9. **Blanket Query Scraping**: Attempting an unrestricted `collection('documents')` query without user filter.
10. **Tampering with CreatedAt**: Overwriting `createdAt` with a timestamp from 10 years ago to manipulate order.
11. **Negative Sizes**: Setting size or chunkCount to `-999`.
12. **Unauthenticated Write**: An unauthenticated user attempting to write to `/entities` or `/documents`.
