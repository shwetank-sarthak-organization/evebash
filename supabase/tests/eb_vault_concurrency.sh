#!/usr/bin/env bash
# Fires 30 simultaneous 100-byte Vault reservations against a 1000-byte limit.
# Exactly 10 must succeed. Run against a disposable migrated database only:
#   DATABASE_URL=postgres://postgres@127.0.0.1:55432/postgres supabase/tests/eb_vault_concurrency.sh
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a disposable database}"
OWNER=00000000-0000-0000-0000-0000000000cc
q() { psql "$DATABASE_URL" -qtA -v ON_ERROR_STOP=1 -c "$1"; }

q "insert into auth.users (id) values ('$OWNER') on conflict do nothing;
   delete from public.vault_uploads where owner_id = '$OWNER';
   delete from public.vault_accounts where owner_id = '$OWNER';"

for i in $(seq 1 30); do
  ( q "select pg_sleep(0.2); select public.vault_reserve_upload('$OWNER', null, 'f$i.bin', 'bin',
        'application/octet-stream', 100, 'vault', 'concurrency/$i', 'single', now() + interval '1 hour', 1000, 0);" \
      >/dev/null 2>&1 && echo ok || echo rejected ) &
done > /tmp/eb_vault_concurrency.out
wait

accepted=$(grep -c '^ok$' /tmp/eb_vault_concurrency.out || true)
reserved=$(q "select reserved_bytes from public.vault_accounts where owner_id = '$OWNER';")
q "delete from public.vault_uploads where owner_id = '$OWNER'; delete from public.vault_accounts where owner_id = '$OWNER';
   delete from auth.users where id = '$OWNER';"

if [[ "$accepted" == 10 && "$reserved" == 1000 ]]; then
  echo "PASS: 10 of 30 concurrent reservations accepted, 1000 bytes reserved"
else
  echo "FAIL: accepted=$accepted reserved=$reserved"; exit 1
fi
