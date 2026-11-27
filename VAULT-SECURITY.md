# Tiffo encrypted vault — security report (27 Nov 2026)

The vault is opt-in, under More → Settings → Encrypted vault. These choices were made by the owner:
- **End-to-end encrypted cloud copy.**
- **A recovery key.**

This report covers what was built, how it was tested, and what it does and does not protect. It is not a guarantee that Tiffo is secure.

## Before the vault (audit)
Backup encryption only ever protected **downloaded backup files**. Everything else was stored as plain text:
- the app's data in browser storage (every balance, entry, debt, investment, asset, bill, policy, document summary and household setting, plus the PIN hash)
- the Undo copy
- the sync fingerprint
- the Supabase sign-in session (refresh token)
- the cloud copy, which was readable by Supabase and the project admin (protected only by row-level security)

The PIN and fingerprint screens are locks, not encryption.

## Design
| Part | Choice |
|---|---|
| Crypto | Web Crypto only. No custom algorithms. |
| Data encryption | AES-GCM-256 with a random 256-bit data key. Fresh 12-byte IV for every save. The vault id and slot name are bound in as authenticated data, so one encrypted file can't be swapped in for another, or between vaults. |
| Password | PBKDF2-SHA-256, 600,000 iterations, random 16-byte salt. Wraps the data key with AES-GCM. About 100–120 ms on a desktop browser (measured). Phones are slower. |
| Recovery key | 130 random bits shown as 26 characters. PBKDF2 at 200,000 iterations wraps the same data key. Shown once; you confirm it by typing back its last group. |
| In memory | A non-extractable CryptoKey, only while unlocked. Locking reloads the page, which clears decrypted data from memory and from the screen. |
| Stored | Wrapped keys, salts and iteration counts, and ciphertext. Never the password, the recovery key or the data key (checked by scanning all of storage). |
| Encrypted | All financial data, the Undo copy, the sync fingerprint, the Supabase session token, and the cloud copy. |
| Not encrypted | Theme and tutorial flags; device-only account names and emails (with salted password hashes); a pointer to which vault to unlock (storage slot and email); household posts, which members must be able to read; files you export yourself (CSV, unencrypted backups). |
| Password change | Re-wraps the data key in one atomic write; the data isn't re-encrypted. The recovery key keeps working. Changes reach other devices on the next sync. |
| Unlocking | Vault password or recovery key. The PIN screen isn't used while the vault is on. Fingerprint/face can't decrypt the vault and is hidden while it's on. Sensitive actions ask for the vault password again. |
| Auto-lock | 1, 5 (default), 15, 30 or 60 minutes away. Wrong passwords add a growing wait after 5 tries (this is in the app, so it slows guessing on screen; it doesn't stop offline guessing against a copied file). |
| Cloud | The row contains only `{vault, kid, iv, ct, keys, savedAt}`. Devices decrypt, merge (three-way, as before) and re-encrypt on the device. A database trigger refuses any unencrypted write over an encrypted row unless it's an explicit "turn off the vault" write (`supabase/vault-guard.sql`). |
| Other devices | A device that hasn't unlocked the vault can't read the cloud copy and won't overwrite it. You enter the vault password there once; its own entries are merged and it becomes encrypted too. Two devices that made separate vaults are joined onto the cloud's vault without losing entries. |

## Safe migration and recovery
- **Turning on:**
  1. Keys are written as *pending*.
  2. The data is encrypted and written.
  3. It is read back from storage, a new key is derived from the password alone, and the result is decrypted and compared with the original.
  4. The recovery key is shown and confirmed.
  5. Only then do the plain copies get deleted.

  A crash before step 5 leaves the plain data as the real data, and the half-made vault is thrown away on the next load.
- **Older app versions:** if an older Tiffo version, or another tab, writes a newer plain copy after the vault is on, it's merged in at the next unlock, not dropped.
- **Turning off:** the plain copy is written and checked first, then the encrypted files are removed. For cloud accounts, a single plain copy marked "vault off" goes up, and other devices are told rather than silently re-encrypting.
- **Ways back in:** the vault password; the recovery key; an encrypted backup file and its own password.
- **If both the vault password and the recovery key are lost, nobody can decrypt the data, including Tiffo.** That's true on every device and in the cloud, because the cloud copy is end-to-end encrypted. Resetting your sign-in password by email does **not** recover it. The only escape hatch erases this device's encrypted copy after two confirmations, so you can start over or restore a backup file.

## Tests performed (all passing)
| File | Checks | Covers |
|---|---|---|
| `tests/vault_core.py` | 23 | Iteration count; no secrets in stored keys; password and recovery unwrap; wrong password; non-extractable key; 1.5 MB round trip; fresh IVs; tampered data, wrong slot and other vault all refused; password change (old fails, new and recovery work, data intact); reset via recovery key; replacing the recovery key revokes the old one |
| `tests/vault_flow.py` | 32 | Setup through the real screens (password rules, confirmation, recovery key, nothing deleted before confirming); no plain data, password or keys left in storage; restart locked with nothing on screen; wrong and right password; an entry saved just before closing survives; auto-lock; recovery key unlock then new password; tampered data refused without losing anything; two tabs; backup/restore/Undo stay encrypted; session token encrypted and restored; turning off; crash mid-setup; newer plain copy merged after a crash; "forgot both" cancel |
| `tests/vault_sync.py` | 19 | Cloud becomes ciphertext only; a second device can't read or overwrite it; wrong password refused; joining merges both devices; edits and deletes from both sides; server guard refuses plain overwrites; password change reaches other devices; recovery key still works; a device with its own vault switches over without losing entries; turning off (cloud marked, other device told, nothing lost) |
| Database | 6 | Guard trigger on a temporary table: allowed and refused transitions |
| Everything else | | Engine 106, notes 187, investments 26, net worth 20, cards/loans 19, bills 13, backup 12, sync 11, security 12, XSS (nothing ran) |

Sync and lock tests use real Web Crypto in Chrome. Cloud tests use a stand-in server that applies the same conditional-write rule and the same guard as the live database.

## What it protects against
- Someone reading browser storage, or copying the browser profile, while Tiffo is locked or closed: a lost or stolen laptop, a shared computer, synced or backed-up browser profiles, a family member opening developer tools.
- Anyone reading the cloud copy, including the database admin and Supabase, a leaked database backup, or someone with your sign-in session or password but not the vault password.
- Copying the stored sign-in session to download the cloud data.
- Undetected tampering with stored or cloud data. Changes are detected and refused, not silently accepted.

## What it does not protect against
- Malware, keyloggers, screen recorders or harmful browser extensions on your device (they can capture the password or read the page while it's unlocked).
- Anyone using Tiffo while it's unlocked, or a script-injection attack while it's unlocked.
- Weak or reused vault passwords: PBKDF2 slows offline guessing but doesn't stop it.
- Household posts you share, AI requests you consent to, and files you export unencrypted (CSV, unencrypted backups).
- Losing both the password and the recovery key.
- Network-level metadata: Supabase still sees that you have an account, when you sync, and how big the data is.

## Remaining limitations
- **Locked means locked:** while the vault is locked you can't add entries. Unlock first.
- **Lost saves:** a save still being encrypted at the exact moment a tab is closed could be lost (encryption takes milliseconds).
- **One account per device:** the vault pointer tracks one account per device. A second account signing in on the same device may need to sign in again after a restart.
- **No fingerprint/face unlock:** the WebAuthn PRF extension that would let it decrypt isn't widely supported yet.
- **Not tested live:** two real phones against the live database, and very large data sets on low-end phones. Browser storage limits also apply: encryption adds about a third to the stored size.
