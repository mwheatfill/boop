# Meraki Switch-Port Security Drift Monitoring - Build Spec

Status: design complete, ready to build. Host/auth is the one open decision (see below).
Validated end-to-end against live data on 2026-06-11.

## Goal

A daily email to the network team listing access ports that have drifted from the
locked-down 802.1x/MAC baseline (i.e. left "Open"), with **who** unlocked each and **when**.

Origin: the team locked down all sites' access ports last year; ports were being
re-opened during ongoing work and not restored. Debra Levario wants visibility into
ports left open and accountability for who opened them.

## Requirement (from Debra)

- Catch switch ports that should be locked but are open ("...and not locked back up").
- Identify who unlocked each, and when.
- Scoped to **switch ports** (not all-config-change), across **all locations**.
- Recipients: Debra Levario, Albert Pepe, Kenneth Nash.

## Tenant facts

- Meraki org: `STS-SD-WAN`, id `1068314`.
- 149 switches across ~30 sites.
- Locked standard = any real access policy on the port: `MacAuth_802.1x` / `MAC_Auth_802.1X` /
  `MAC allow list` / `Sticky MAC allow list` / `DFCU-CloudPKI-Wired-Pilot`.
- Unlocked = `accessPolicyType == "Open"` (live state) == `"[none]"` (change log).

## Data sources

1. **Live state (authoritative "what is open now")**
   `GET /organizations/1068314/switch/ports/bySwitch?perPage=50`
   - RFC5988 Link-header pagination; follow `rel=next`. **Strip `\r` from the header URL** or the
     client hangs. Prefer an official Meraki SDK (`total_pages='all'`) over hand-rolling.
   - 149 switches = 3 pages, ~4s total.
   - Shape per switch: `{name, serial, network:{name}, ports:[{portId, type, accessPolicyType, vlan, ...}]}`.

2. **Attribution (who / when)**
   `GET /organizations/1068314/configurationChanges?timespan=<window>&perPage=1000`
   - **Paginate fully** - 1000-row page cap; a 90-day window already exceeds it.
   - Filter `page == "Switch ports"`. `label` = `"{switch} / {portId}"` (note switch names can
     contain `/`, so split on the trailing ` / {digits}`). `oldValue`/`newValue` are JSON strings,
     e.g. `{"Access policy":"MacAuth_802.1x"}` -> `{"Access policy":"[none]"}`.
   - **Unlock event** = new `Access policy` == `"[none]"`.

## Baseline - which ports "should be locked"

A port is in-scope (expected locked) if:
- `type == "access"`, AND
- it sits on a switch where **>= 50% of access ports already have a policy** (`accessPolicyType != "Open"`).

This auto-excludes all-open infrastructure switches and keeps managed edge switches.
Self-calibrating; no manual classification, naming heuristics, or change-log history needed.
New switches classify themselves by their own port profile.

Empirical split (2026-06-11), which makes the rule robust (bimodal -> threshold insensitive):

| Bucket | Switches | Open access ports |
|---|---|---|
| 100% locked (compliant edge) | 108 | 0 |
| 50-99% locked (edge WITH drift) | 27 | **65 (the signal)** |
| 0% / all-open (infrastructure) | 11 | 395 (excluded - legit) |

Optional precision overrides (add only if the auto-rule misfires): a Debra-maintained list of
switches pinned exempt/enforced, plus a per-port exception list for legit uplink-as-access ports.

## Detection logic

1. Pull live state (`bySwitch`). Compute each switch's locked fraction.
2. Drift set = access ports with `accessPolicyType == "Open"` on switches with locked-fraction `>= 0.5`.
3. Pull change log (`Switch ports` unlock events). Keep the **latest** unlock per `(switch, portId)`.
4. For each drift port, attach `who`/`when` from its latest unlock event if present; else
   `unlocked: unknown / before window`.
5. Emit the drift set.

Funnel: `460 open -> -395 infra -> 65 drift -> 3 attributable to a recent unlock (rest pre-window)`.

## Output - email

- Recipients: Debra Levario, Albert Pepe, Kenneth Nash.
- Subject: `[Meraki] {N} switch ports open vs baseline - review`
- Body: one intro line + table, sorted by site/switch:

  | Switch | Port | Site | Unlocked by | When | Was (prior policy) |
  |---|---|---|---|---|---|

- Footer: source (org STS-SD-WAN) + method (change log reconciled against live port state).
- `N == 0`: send a brief "all clear" or suppress (team preference).

### Deep links (make each row one-click)

Each finding links directly to the port's config page in the dashboard:
```
portUrl = deviceUrl.split("/manage/")[0] + "/manage/switches/" + serial + "/ports/" + portId
```
- `deviceUrl` = the `url` field from `GET /organizations/{org}/devices` (one call, join by serial).
  This carries the per-network shard/slug/eid prefix (e.g. `https://n1017.dashboard.meraki.com/Papago-SD-WAN-sw/n/8XHeQcYb`), so links are correct per network.
- The `bySwitch` ports payload has no `url`; the device list is the source.
- Example: `.../manage/switches/Q2KW-XG4N-JT9A/ports/20`.
- Change-log rows also carry `networkUrl` + `adminEmail`/`adminId` (network-level link + richer
  attribution); Meraki has no per-entry permalink.

## Cadence

- **Daily digest** (e.g. 07:00 local). A left-open port is a standing condition; daily is timely
  for this risk and naturally de-noises transient unlocks that were re-locked the same day.
- **Phase 2 (optional): near-real-time event alert.** Poll the change log every 15-30 min, but
  **debounce** - re-check state after a grace period (30-60 min) and only alert if still open -
  to drop the team's normal migration churn. Start without this.

Do NOT alert on raw unlock events: the team unlocks ports constantly as legitimate work
(42 unlocks in 90d, all Debra + Kenny). Persistence (still-open), not the act, is the signal.

## Host / auth - the one open decision

**Option A - boop on Cloudflare + Meraki OAuth (Cloudflare-native).**
Meraki OAuth tokens **bypass the org approved-subnet IP allowlist** (confirmed via Cisco docs;
the allowlist applies to API keys + logins only). So boop polls from Cloudflare's any-IP egress
with no dedicated egress IP and no relay. Requires:
- Build an OAuth2 (`authorization_code` + refresh) credential type in boop: one-time admin
  consent at a redirect URL (boop hosts the callback), store the refresh token, refresh the
  60-min access token (refresh token dies after 90d idle). Meraki is the auth server
  (`as.meraki.com/oauth`). Entra cannot issue/refresh Meraki tokens - it only federates the
  consent login.
- Build boop's response-evaluation/transform capability (boop outcome is HTTP-status-only today;
  this job needs to parse JSON, apply the baseline rule, and template the digest).

**Option B - Azure/corp host + API key (simpler now).**
API key is IP-restricted, so run from an approved egress IP: an Azure VM/Function behind the S2S
VPN, or a PowerShell scheduled task on an approved corp host (matches the Windows team's skillset).
Add that one egress IP to Meraki approved subnets - precedent exists (3 AWS `/32`s are already
whitelisted). Note: a dedicated Cloudflare egress IP is **grayed out** on the current Zero Trust
plan, so the Cloudflare path depends on the OAuth bypass, not a dedicated IP.

## Gotchas

- **Pagination CRLF**: strip `\r` from the Link-header `next` URL or the HTTP client hangs
  (this cost us two ~20-min hangs). Use an SDK if possible.
- **configurationChanges 1000-row cap**: paginate fully for complete attribution.
- **API key minting**: SAML/SSO admins cannot generate keys - use a read-only local service admin.
  Dashboard login is also IP-restricted (SAML exempt, local logins not).
- **Account**: boop runs in the SwitchThink Solutions Cloudflare account, not Stel Global.

## Flag for Debra

A switch literally named **`bad`** (26 access ports, 15 locked, 11 open) - confirm what it is
(junk/test switch vs real drift) before it shows up in the digest.
