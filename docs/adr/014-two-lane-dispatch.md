# ADR-014: Two-lane dispatch (heartbeat scan and per-Job alarm)

![Status](https://img.shields.io/badge/status-Accepted-brightgreen) ![Date](https://img.shields.io/badge/date-2026--05--11-blue)

## Context

boop is a scheduler that fires HTTP requests on cron, interval, or webhook Triggers against Customer-owned Targets, with run history, retries, and alerting fan-out. Two Cloudflare platform limits constrain the dispatch design:

- [Cron Triggers cap at 250 per account](https://developers.cloudflare.com/workers/platform/limits/#account-plan-limits), and the cron expression syntax has a 1-minute floor. At MSP scale (270 customers, multiple Jobs each) one-Cron-Trigger-per-Job is impossible by an order of magnitude.
- Sub-minute health checks (e.g. 30-second IIS pings via Cloudflare Tunnel) are a real product requirement. Cron Triggers cannot express them.

The choice of dispatch mechanism is load-bearing: it determines how Runs are claimed, where state lives, how retries behave, and how cron / interval / webhook Triggers stay coherent in code.

## Decision

A two-lane dispatch architecture keyed on Trigger type, sharing one `dispatchRun()` module.

| Concern | Choice | Over |
|---|---|---|
| Cron-typed Jobs | **Queue lane.** A single [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) fires every minute as the heartbeat. An evaluator Worker scans D1 for due Jobs and enqueues each one to the dispatch [Queue](https://developers.cloudflare.com/queues/). A Consumer Worker claims via D1 row-level CAS and calls `dispatchRun()`. | One Cron Trigger per Job (impossible at 250/account); per-Job Durable Object alarms (over-tooled for ≥ 1-minute work). |
| Interval-typed Jobs (sub-minute) | **Alarm lane.** One [Durable Object](https://developers.cloudflare.com/durable-objects/api/alarms/) per Job (`id = ${customer_id}:${job_id}`) sets its own millisecond-precision alarm. The `alarm()` handler calls the same `dispatchRun()` module, then `setAlarm(now + interval_seconds * 1000)`. | Forcing every Job through DOs (uniform but costly and novel for ops); bucketing sub-minute fires into a per-minute heartbeat (degrades at uneven intervals and breaks at intervals ≤ 30s). |
| Webhook-typed Jobs | **Queue lane.** Route `/w/:customer/:job-slug` pushes `{job_id, scheduled_at: now}` to the dispatch Queue. Same Consumer, same `dispatchRun()`. | A separate webhook code path (duplicates dispatch logic). |
| Run claim / serialization | **D1 row-level CAS.** `UPDATE jobs SET fire_in_progress = 1 WHERE id = ? AND fire_in_progress = 0 RETURNING id;` Wins the claim atomically; duplicate Queue deliveries no-op. The DO lane is naturally single-owner per Job and skips the claim. | Using a DO purely as a distributed lock when D1 already serializes per row. |
| Retry semantics | **Queue-native retries** in the Queue lane (`message.retry({ delaySeconds })`, max_retries, optional DLQ). **`setAlarm(now + backoff)`** in the Alarm lane. | Implementing a hand-rolled retry scheduler. |
| State ownership | **D1 is canonical** for Jobs, Runs, Attempts. DO storage holds only the per-Job alarm cache (`last_fire_at`, `next_fire_at`). | Splitting state between D1 and DO storage. |
| Bodies and archive | **R2** for request/response bodies (always) and for Run/Attempt records older than the Hot window. | Storing bodies inline in D1 (size cap). |
| Shared dispatcher | **One `dispatchRun(env, jobId, scheduledAt)` module** imported by both the Queue Consumer and the DO. Performs claim (if Queue lane), template render, fetch the Target, write Run/Attempt, stream body to R2, evaluate terminal state, enqueue alert. | Two near-identical dispatchers per lane. |

Trigger type changes are explicit, operator-triggered transitions: cron→interval provisions the DO and seeds its first alarm; interval→cron tears the DO's alarm down so the scanner picks the Job up.

## Consequences

**Positive:**

- The hot path for cron and webhook Triggers is a textbook Cron-and-Queue scheduler. Onboarding engineers read it once and understand it.
- D1 is the single source of truth, which keeps the storage model from ADR-003 honest and makes the dashboard's "what is about to fire" view a trivial SQL query.
- Sub-minute precision exists where the product needs it (interval Jobs) without making every Job pay the DO operational cost.
- One dispatcher module means one place to evolve fetch logic, templating, body capture, and alert emission.
- Catching up after a Workers outage is automatic in the Queue lane (evaluator finds everything missed) and is bounded by `setAlarm()` survival in the Alarm lane.

**Negative:**

- Two dispatch code paths exist by definition (Queue Consumer and DO `alarm()`). The shared `dispatchRun()` mitigates duplication but the two invokers must stay coordinated on the dispatcher's contract.
- Trigger type changes are a one-time provision/teardown step, not a pure data mutation. Operators see this as a brief "applying change" state.
- Interval Jobs at high frequency are a real cost line. 270 customers x 5 health checks x 30-second interval projects to ~117M DO alarm invocations per month, on the order of $30/month at Workers Paid request pricing. The UI must surface "this Job will fire N times per day" so operators see the cost they are choosing.

**Neutral / trade-off:**

- D1 CAS gives correctness without a DO in the Queue lane, but it depends on D1's single-threaded per-database semantics ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/)). If D1 ever stops being our hot data store (per ADR-003's Neon-via-recipe escape hatch), the CAS pattern ports to Postgres without change.
- Cron Triggers usage stays at one (the heartbeat) plus a small handful reserved for housekeeping like nightly D1-to-R2 archive sweeps. We are nowhere near the 250 cap.
- Queue's default `max_retries = 3` is a starting point; per-Job overrides may be needed for flaky Targets and are recorded in the Job row, not in Queue config.
