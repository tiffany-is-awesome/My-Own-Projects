# Tiffo security verification audit — 27 Nov 2026

Scope: `tiffo.html` (current `main` + audit branches), its Supabase project (`hvhbygkgvxdpvwvclyns`, Tiffo tables), and the outside code it loads. This audit is not exhaustive and does not show that Tiffo is completely secure. It records what was checked, with evidence, and what is left.

Classifications: **Confirmed vulnerability** (shown to happen, with impact) · **Potential vulnerability** (plausible, not shown exploitable) · **Limitation** (comes with the current design) · **Recommendation**.

## Fixed

| # | Finding | Class | Impact | Fix | Evidence |
|---|---|---|---|---|---|
| 1 | Cloud sync was "last save wins" for the whole data set | Confirmed | Entries made offline on one device were silently replaced by another device's newer copy; a stale device could also overwrite another device's new entries. Loss of financial records. | Three-way merge per record (each device keeps a fingerprint of what it last synced), deletions carried over, conditional writes ("only if nobody saved since I read", re-merge otherwise; plain write of merged data on the last retry). | Reproduced on the old code: 2 offline entries lost. `tests/security_sync.py` 11/11: offline entries, deletes, edits, a write race, a new device, settings. |
| 2 | Puter (third-party AI code) loaded before the AI consent answer | Confirmed (privacy/consent) | Third-party code ran inside the page, which holds all local financial data and the sign-in session, even when the user said no. | Puter loads only after "Turn on AI". | `security_fixes.py`: no Puter request before or after saying no. |
| 3 | Password-reset link didn't let you set a new password | Confirmed (account access/recovery) | The link signed you in, but the password was never changed. | Handles Supabase `PASSWORD_RECOVERY`: asks for a new password (`updateUser`). | Form and validation tested; the full email round-trip wasn't tested (no test inbox). |
| 4 | Signed out elsewhere / expired session shown as "Offline… will sync later" | Confirmed (data recovery) | Changes stayed on one device indefinitely while the user believed they'd sync. | Auth errors (401, JWT/refresh token) and Supabase `SIGNED_OUT` show "Signed out of the cloud… sign in again", and the useless retries stop. | Status logic tested; a real token expiry wasn't reproduced live. |
| 5 | Supabase JS and Tesseract loaded at floating versions (`@2`, `@5`) without integrity checks; Chart.js without an integrity check | Potential (supply chain) | A compromised CDN file or package release would run with full access to the page's data. | Exact versions + SRI (`supabase-js@2.119.2`, `tesseract.js@5.1.1`, `chart.js@4.4.1`). Tailwind's CDN pinned to `3.4.17` (that CDN doesn't allow SRI). | Real browser: all three load with SRI, styling works. |
| 6 | Signed-out (`anon`) and signed-in roles held TRUNCATE/TRIGGER/REFERENCES on Tiffo tables | Potential | TRUNCATE ignores row-level security (it wipes every user's rows). Not reachable through the public REST API as far as could be verified. | Revoked (`supabase/least-privilege.sql`). The tables now hold only what the app uses. | Grants re-queried after the change. |
| 7 | Household posts from other accounts weren't validated | Potential | A member (or their compromised account) could post non-numbers or huge or negative amounts, which would corrupt totals for anyone who added the post. | Posts are checked (numbers, sizes, dates, text lengths) before showing or adding; every entry must have a finite amount. | `security_fixes.py`: 7 damaged posts refused, normal post accepted, NaN/Infinity/huge amounts refused. |

Fixed earlier today (brief 07, PR #51): "Replace" restore no longer takes the backup's PIN lock, AI consent or household link; account deletion removes household posts and membership; merge restore upgrades old formats and doesn't double up records.

## Checked: no problem found
- **RLS and data isolation.** `tiffo_data`: select/insert/update/delete all limited to `auth.uid() = user_id`; RLS is on for every public table. Household tables: 20/20 rule tests passed (outsiders, members, owner, removed members, signed-out visitors). The Supabase advisor shows only the 3 intended household-function warnings (each checks the caller) and leaked-password protection (see recommendations).
- **Credentials.** Searched the whole repository and all of its history: no secret keys, service-role keys, private keys or tokens. The only key in the app is the Supabase *publishable* key, which is meant to be public and is protected by RLS.
- **Stored XSS.** Script payloads were put into every stored text field (entries, people, accounts, categories, pockets, budgets, reminders, investments, assets, bills, policies, plans, documents and AI-style results, household names), plus a restored backup and a file name. Every screen and detail view was shown: payloads appeared as plain text 29–44 times per view and **none ran** (`tests/security_xss.py`).
- **Backups.** AES-GCM-256 with PBKDF2-SHA256 (250k iterations, random salt and IV); nothing readable inside; wrong password refused; damaged, foreign and newer-format files refused; bad entries skipped; full round-trip of every module with identical totals; undo works (`audit_backup.py`, 12 checks).
- **Device-only accounts.** Passwords are stored as salted PBKDF2-SHA256 hashes (150k iterations), never in plain text.
- **AI.** Every AI call checks consent first; the consent text names Puter and Google and says what's sent.
- **Uploads.** Files are read in the browser; text from photos, documents and AI is escaped when shown (see XSS); backups over 25 MB are refused.
- **Financial integrity.** All money, investment, debt, bill and backup checks pass (383 checks, `tests/`).

## Limitations of the current design (not fixed)
- **Data in the browser isn't encrypted.** localStorage is readable by anyone with access to the unlocked device or browser profile, by browser extensions, and by any script that runs on the page. The PIN and fingerprint lock are casual locks (the app says so). The Supabase session token is also in localStorage.
- **PIN attempt limits can be bypassed** by someone who edits browser storage.
- **Signing out keeps the data on the device** (useful offline, risky on shared devices).
- **Puter's code can't be pinned or integrity-checked** (vendor loader). Once AI is on, it runs with page access. Documents and photos go to Puter/Google whole, without redaction.
- **Tailwind's Play CDN** runs third-party code on every load, and that CDN can't be integrity-checked (version is pinned).
- **Sync conflicts:** if the same entry is edited on two devices before syncing, the more recent edit wins. An entry deleted on one device but edited on the other is kept. On a device's first sync, deletions made elsewhere before that can reappear once.
- **The sign-in email can't be deleted from the app** (needs a server function); the delete prompt says so.
- **Very old browsers without WebCrypto** fall back to a weak hash for device-only accounts.
- **Full browser storage** shows a warning, but a save can fail.

## Recommendations
1. Turn on **leaked-password protection** in Supabase (Authentication settings), and consider offering MFA.
2. Replace the Tailwind Play CDN with a built CSS file. That removes a third-party script from every page load and makes a **Content-Security-Policy** practical.
3. Add a server function to **delete the sign-in account itself**.
4. Offer **"remove my data from this device"** when signing out on a shared device.
5. **Redact long numbers** (card and account numbers) from text before it's sent to the AI.
6. The other apps in the same Supabase project (`pantry_*`, `wearwise_*`) have the same broad table grants. Not changed here (outside Tiffo's scope).

## Could not verify
- The end-to-end Supabase email flows (reset, confirmation) and real token expiry or global sign-out. There was no test account or inbox.
- Supabase Auth settings beyond the advisor (rate limits, email confirmation, MFA).
- Two real devices syncing against the live database. Sync was tested against a faithful stand-in server; a last-retry plain write prevents a format mismatch from stopping sync.
- How Puter and Google handle data that's sent to them.
- Browser extensions, the device's own security, and GitHub Pages hosting.
