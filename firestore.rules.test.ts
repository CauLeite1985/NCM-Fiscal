/**
 * Security Rules TDD specification verifying the Dirty Dozen attack payloads
 * against the Firestore rules contract defined in firestore.rules.
 */
export interface RuleTestCase {
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED' | 'ALLOW';
  payload?: Record<string, unknown>;
}

export const dirtyDozenSecurityCases: RuleTestCase[] = [
  {
    name: '1. Self-Admin Escalation on registration',
    collection: '/users/user123',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      uid: 'user123',
      name: 'Mallory',
      email: 'mallory@example.com',
      role: 'admin',
      status: 'approved',
    },
  },
  {
    name: '2. Email Spoofing without email_verified == true',
    collection: '/users/spoofUid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      uid: 'spoofUid',
      name: 'Claudio Spoof',
      email: 'claudio.softcom@gmail.com',
      role: 'admin',
      status: 'approved',
    },
  },
  {
    name: '3. Shadow Field Injection on user creation',
    collection: '/users/user123',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      uid: 'user123',
      name: 'Mallory',
      email: 'mallory@example.com',
      role: 'operator',
      status: 'pending',
      isSuperUser: true,
    },
  },
  {
    name: '4. Operator self-approval update',
    collection: '/users/user123',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'approved' },
  },
  {
    name: '5. Non-admin reading another user PII document',
    collection: '/users/otherUser',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. ID Poisoning on batch creation',
    collection: '/batches/' + 'a'.repeat(200),
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Orphan Batch Item without parent batch ownership',
    collection: '/batches/nonexistent/items/item1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Batch Owner Hijacking via update',
    collection: '/batches/batch1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payload: { ownerId: 'victimUid' },
  },
  {
    name: '9. Timestamp Forgery on batch create',
    collection: '/batches/batch1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
  },
  {
    name: '10. Pending user attempting to create a batch',
    collection: '/batches/batch1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Oversized description exhaustion on batch item',
    collection: '/batches/batch1/items/item1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: { description: 'x'.repeat(5000) },
  },
  {
    name: '12. Unrestricted list scraping across all batches',
    collection: '/batches',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
  },
];
