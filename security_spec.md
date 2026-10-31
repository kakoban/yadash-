# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Strict Ownership**: Every document in `/entries/{entryId}` must belong to the authenticated user (`userId == request.auth.uid`) with a verified email (`request.auth.token.email_verified == true`).
2. **Path & Document ID Integrity**: `entryId` must match `^[a-zA-Z0-9_\-]+$` (max 128 chars) and equal `incoming().id`.
3. **Immutable Metadata**: `id`, `userId`, `entryTime`, and `createdAt` cannot be modified after creation.
4. **Temporal Integrity**: `createdAt` and `updatedAt` must match `request.time` on creation, and `updatedAt` must match `request.time` on update.
5. **Bounded Payloads**: `title` <= 500 chars, `body` 1..50000 chars, `tags` list <= 20 items, `type` in `['note', 'thought', 'idea', 'quote', 'list', 'link', 'code']`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating an entry -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `auth.token.email_verified = false` -> `PERMISSION_DENIED`.
3. **Identity Spoofing on Create**: `auth.uid = 'userA'`, payload has `userId: 'userB'` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Create**: Payload includes extra field `isAdmin: true` -> `PERMISSION_DENIED`.
5. **ID Mismatch**: Path is `/entries/abc`, payload has `id: 'xyz'` -> `PERMISSION_DENIED`.
6. **Invalid Enum Type**: Payload has `type: 'hacked'` -> `PERMISSION_DENIED`.
7. **Oversized Body (Denial of Wallet)**: Payload has `body` > 50,000 chars -> `PERMISSION_DENIED`.
8. **Unbounded Tags Array**: Payload has `tags` with 25 items -> `PERMISSION_DENIED`.
9. **Forged Timestamp on Create**: Payload has client-supplied past/future `createdAt != request.time` -> `PERMISSION_DENIED`.
10. **Immutable Field Mutation on Update**: Owner attempts to change `userId` or `createdAt` on update -> `PERMISSION_DENIED`.
11. **Cross-User Read/Delete**: `userB` attempts `get`, `list`, or `delete` on `userA`'s entry -> `PERMISSION_DENIED`.
12. **Shadow Field Injection on Update**: Owner attempts to add `role: 'admin'` during update -> `PERMISSION_DENIED`.
