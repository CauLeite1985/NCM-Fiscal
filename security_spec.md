# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Self-Registration Integrity**: A newly registered user can only create `/users/{userId}` where `userId == request.auth.uid`, `uid == request.auth.uid`, `role == 'operator'`, and `status == 'pending'`, unless the caller has a verified email matching the bootstrapped administrator `claudio.softcom@gmail.com`.
2. **Admin-Only Approval**: Only a verified administrator (`claudio.softcom@gmail.com` with `email_verified == true` or an approved user with `role == 'admin'`) can transition another user's `status` (`pending` -> `approved` / `rejected`) or `role` (`operator` / `admin`).
3. **PII Isolation**: User documents containing `email` and `name` can only be read (`get`) by the owning user or an administrator, and listed only by administrators.
4. **Batch Ownership & Master Gate**: A `/batches/{batchId}` document can only be created, read, updated, or deleted by its `ownerId` (who must be an approved, email-verified user or admin). Subcollection `/batches/{batchId}/items/{itemId}` enforces the Master Gate via `get()` on the parent batch and requires `ownerId == request.auth.uid` and `batchId == batchId`.
5. **Immutable Audit Fields & Server Timestamps**: `uid`, `ownerId`, `batchId`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
6. **NCM Metadata Integrity**: Only approved users or administrators can record NCM table sync metadata under `/ncmMetadata/{docId}`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Admin Escalation**: Creating `/users/{uid}` with `role: "admin", status: "approved"` as a non-admin email.
2. **Email Spoofing**: Signing in with `email: "claudio.softcom@gmail.com"` where `email_verified: false` to claim admin privileges.
3. **Shadow Field Injection**: Creating `/users/{uid}` with an unexpected key `isSuperUser: true`.
4. **Self-Approval Update**: Operator updating their own `/users/{uid}` document changing `status: "pending"` to `"approved"`.
5. **Cross-User PII Read**: Non-admin user calling `get(/users/{otherUid})` or `list(/users)`.
6. **ID Poisoning**: Creating `/batches/{1500-char-id}` or `/batches/bad$id` with invalid characters.
7. **Orphan Batch Item**: Creating `/batches/nonexistent/items/item1` without a valid parent batch owned by `request.auth.uid`.
8. **Batch Owner Hijacking**: Updating `/batches/{batchId}` with `ownerId: "victimUid"`.
9. **Timestamp Forgery**: Creating `/batches/{batchId}` with a backdated `createdAt` not equal to `request.time`.
10. **Pending User Batch Creation**: A `status: "pending"` user attempting to create a `/batches/{batchId}` document.
11. **Oversized String Exhaustion**: Creating `/batches/{batchId}/items/{itemId}` with a 5,000-character `description`.
12. **Unrestricted List Scraping**: Querying `/batches` without filtering `ownerId == request.auth.uid`.
