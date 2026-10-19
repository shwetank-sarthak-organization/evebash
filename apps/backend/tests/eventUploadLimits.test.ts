import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkEventUpload, isEventUploadLimitEnabled } from '../src/services/eventUploadLimits.js';

const GB = 1024 * 1024 * 1024;

// Just what getStorageContext reads from the Vault repository
function fakeRepo(profile: { role: string; planEndDate?: string | null }, eventBytes: number, vaultBytes = 0) {
  return {
    getProfile: async () => ({ role: profile.role, planEndDate: profile.planEndDate ?? null }),
    getEventStorageBytes: async () => eventBytes,
    getAccount: async () => ({ usedBytes: vaultBytes, reservedBytes: 0 }),
    getRetainedItemIds: async () => new Set<string>(),
  } as never;
}
const owner = { id: 'host', email: 'host@example.com', phone: null };
const findOwner = async () => owner;
const now = new Date('2026-10-10T12:00:00+05:30');

test('the switch is off unless EVENT_UPLOAD_LIMITS=true', () => {
  delete process.env.EVENT_UPLOAD_LIMITS;
  assert.equal(isEventUploadLimitEnabled(), false);
  process.env.EVENT_UPLOAD_LIMITS = ' TRUE ';
  assert.equal(isEventUploadLimitEnabled(), true);
  delete process.env.EVENT_UPLOAD_LIMITS;
});

test('uploads count against the gallery owner\'s plan, events and Vault together', async () => {
  // Free plan (1 GB): 0.5 GB in galleries + 0.3 GB in Vault leaves 0.2 GB
  const repo = fakeRepo({ role: 'free' }, 0.5 * GB, 0.3 * GB);
  const check = (uploaderId: string, bytes: number, isVideo = false) =>
    checkEventUpload({ eventId: 'wedding', uploaderId, bytes, isVideo }, { repo, findOwner, now });

  assert.deepEqual(await check('host', 0.1 * GB), { allowed: true });
  assert.deepEqual(await check('guest', 0.1 * GB), { allowed: true }, 'a guest upload uses the host\'s plan, not the guest\'s');

  const tooBig = await check('host', 0.25 * GB);
  assert.equal(tooBig.allowed, false);
  assert.match((tooBig as { error: string }).error, /more storage than your plan has left \(0\.20 GB\)/);

  // A 0.16 GB video needs 0.216 GB with its streaming copies: refused; the same size as a photo fits
  assert.equal((await check('host', 0.16 * GB, true)).allowed, false);
  assert.equal((await check('host', 0.16 * GB, false)).allowed, true);

  const guestRefused = await check('guest', 0.25 * GB);
  assert.deepEqual(guestRefused, {
    allowed: false,
    code: 'storage_full',
    error: 'This gallery is out of storage. Ask the host to free up space or upgrade their plan.',
  });
});

test('a full plan refuses even a size-less request', async () => {
  const decision = await checkEventUpload(
    { eventId: 'wedding', uploaderId: 'host', bytes: 0, isVideo: false },
    { repo: fakeRepo({ role: 'free' }, 1 * GB), findOwner, now },
  );
  assert.equal(decision.allowed, false);
  assert.match((decision as { error: string }).error, /reached your plan's storage limit/);
});

test('an expired paid plan pauses uploads; admins and unknown galleries are not limited', async () => {
  const expired = fakeRepo({ role: 'standard', planEndDate: '2026-09-01' }, 0.1 * GB);
  const asHost = await checkEventUpload({ eventId: 'wedding', uploaderId: 'host', bytes: 1, isVideo: false }, { repo: expired, findOwner, now });
  assert.equal((asHost as { code: string }).code, 'plan_expired');
  const asGuest = await checkEventUpload({ eventId: 'wedding', uploaderId: 'guest', bytes: 1, isVideo: false }, { repo: expired, findOwner, now });
  assert.match((asGuest as { error: string }).error, /Ask the host to renew/);

  const active = fakeRepo({ role: 'standard', planEndDate: '2026-12-31' }, 20 * GB);
  assert.equal((await checkEventUpload({ eventId: 'w', uploaderId: 'host', bytes: GB, isVideo: false }, { repo: active, findOwner, now })).allowed, true);

  const admin = fakeRepo({ role: 'admin' }, 5000 * GB);
  assert.deepEqual(await checkEventUpload({ eventId: 'w', uploaderId: 'host', bytes: GB, isVideo: true }, { repo: admin, findOwner, now }), { allowed: true });

  assert.deepEqual(
    await checkEventUpload({ eventId: 'gone', uploaderId: 'x', bytes: GB, isVideo: false }, { repo: admin, findOwner: async () => null, now }),
    { allowed: true },
  );
});
