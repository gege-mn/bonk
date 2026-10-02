# Bonk

**Your site is down, bonk!**

Uptime monitoring and a public status page that run entirely on Cloudflare: one Worker, a one-minute Cron Trigger, and a D1 database. There's no server to babysit, and it fits the free plan.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/gege-mn/bonk)

- **Checks:** HTTP(s) with status and slow-response thresholds, keyword, JSON value, TCP port, DNS record, and push/heartbeat (a cron job pings Bonk; silence alerts).
- **Admin panel:** add and edit monitors in a form, test a check before saving, pause, see response-time charts and event logs. No config files, no redeploys.
- **Alerts** through 35 services: Telegram, Discord, Slack, Microsoft Teams, Google Chat, Mattermost, Rocket.Chat, Matrix, Zulip, Webex, ntfy, Gotify, Pushover, Pushbullet, Bark, LINE, Signal, Feishu/Lark, DingTalk, WeCom, PagerDuty, Opsgenie, Splunk On-Call, Home Assistant, Apprise, generic webhooks, email (Resend, Postmark, SendGrid, Mailgun, Brevo, SMTP2GO), Twilio SMS, PushDeer and ServerChan.
- **Status page** with 90-day history, incidents (opened and closed automatically, with manual updates) and scheduled maintenance.
- **Private monitors:** untick *Show on the public status page* and a monitor (with its automatic incidents) disappears from the public page and `/api/status.json`, but keeps checking and alerting. Signed-in admins see everything on one status page at `/private`.
- **Your brand:** logo, colors, fonts and corner style are editable from the admin, with a live preview and contrast checks. See [docs/design-system.md](docs/design-system.md).
- **Sign-in** with Cloudflare Access, or a password stored as a Worker secret.

## Deploy

### With the button

1. Click **Deploy to Cloudflare** above. Cloudflare copies this repo to your GitHub, creates the D1 database, runs the migrations and deploys.
2. When asked for secrets, set these (leave any you don't use blank):
   - `ADMIN_PASSWORD`: the admin password (skip it if you'll use Cloudflare Access; see below).
   - `ENCRYPTION_KEY`: any long random string, e.g. `openssl rand -base64 32`. It encrypts bot tokens and webhook URLs in the database. Don't change it later, or saved channels can't be decrypted.
3. Open `https://<your-worker>.workers.dev/admin`, sign in, and add a monitor.

Every push to your copy's main branch redeploys it, via Workers Builds.

### From your machine

```sh
pnpm install
pnpm wrangler login                         # browser OAuth; no API token needed
pnpm wrangler d1 create bonk                # paste the printed database_id into wrangler.jsonc
pnpm wrangler secret put ADMIN_PASSWORD
pnpm wrangler secret put ENCRYPTION_KEY
pnpm build && pnpm run deploy              # applies migrations, then deploys
```

### Checks aren't running yet? Read this first

Bonk checks your sites from a Cloudflare **Cron Trigger** that fires every minute. On a brand-new Worker, **Cloudflare can take up to 15 minutes to start firing it**. Until then, monitors show "Waiting for first check" and nothing is broken.

- **In the meantime:** the admin shows a banner saying the checker hasn't run yet. You can still check a single monitor with its **Check now** button.
- **If it's still silent after 15 minutes** (or it stops later), re-apply the trigger without redeploying code:

  ```sh
  pnpm wrangler triggers deploy
  ```

  For a Deploy-button install, you can instead open **Workers & Pages → bonk → Settings → Trigger Events**, delete the `* * * * *` cron and add it again.
- **To confirm it's firing:** run `pnpm wrangler tail bonk` and look for `tick: N checked` lines once a minute. The admin banner also disappears once a check has run in the last 3 minutes.
- **Plan limits:** the free plan allows 5 Cron Triggers per account. If other Workers already use them all, Bonk's trigger is rejected at deploy.

### Custom domain

In the dashboard go to **Workers & Pages → bonk → Settings → Domains & Routes → Add → Custom domain** and enter e.g. `status.example.com`. The zone must be on the same Cloudflare account. Cloudflare creates the DNS record and certificate for you; there's nothing to add by hand.

Then open **Admin → Settings** and set **Public URL** to that address, so alerts link back to the right place.

## Signing in with Cloudflare Access (recommended)

1. In Zero Trust, go to **Access → Applications → Add an application → Self-hosted**.
2. Set the domain to your status host with path `admin`, e.g. `status.example.com/admin`. Add `status.example.com/private` to the same application if you use private monitors. Add a policy for the people allowed in.
3. Copy the application's **Application Audience (AUD) Tag**.
4. On the Worker, set:
   - `CF_TEAM_DOMAIN`: `https://<your-team>.cloudflareaccess.com`
   - `CF_AUD_TOKEN`: the AUD tag

When both are set, Bonk verifies the Access JWT on every `/admin` and `/private` request (signature, issuer and audience) and ignores `ADMIN_PASSWORD`. A request that didn't come through Access, e.g. via the `workers.dev` URL, gets a 403.

Without Access, `/admin` uses `ADMIN_PASSWORD`. Sessions are signed with the password itself, so changing it signs everyone out. Failed sign-ins are rate-limited per IP.

## Configuration reference

| Name | Kind | Needed | What it does |
| --- | --- | --- | --- |
| `DB` | D1 binding | yes | Everything Bonk stores. |
| `ADMIN_PASSWORD` | secret | unless Access | Admin password. |
| `ENCRYPTION_KEY` | secret | strongly advised | AES-GCM key for notification credentials. Without it they're stored in plain text, and the admin warns you. |
| `CF_TEAM_DOMAIN` | secret or variable | for Access | e.g. `https://yourteam.cloudflareaccess.com` |
| `CF_AUD_TOKEN` | secret or variable | for Access | The Access application's AUD tag. |

## How it works

```
Cron (every minute) ─► worker/index.ts ─► tick()        src/lib/server/engine.ts
                                          ├─ runCheck()  checks.ts: fetch / TCP socket / DNS-over-HTTPS
                                          ├─ applyResult status.ts: N failures in a row → down; 1 success → up
                                          ├─ incidents   opened/closed automatically
                                          └─ deliver()   notify/*: send now, queue + retry on failure
Requests ─────────► SvelteKit (status page + /admin)
```

- **Alerting.** A monitor only turns *down* or *degraded* after **Alert after** failed checks in a row (default 3), so one blip doesn't wake anyone. It recovers on the first good check. Every change of state sends one alert per attached channel, optionally repeated every N minutes while still failing. Failed sends are retried with backoff (1, 2, 4, 8, 16 minutes) and every attempt lands in the monitor's event log. Maintenance windows keep checking but mute alerts and incidents.
- **Short blips.** Uptime totals only count a failed or slow check once the monitor is confirmed down or degraded, so a hiccup shorter than **Alert after** never touches the history. On top of that, **Admin → Settings → Short blips** (default 5 minutes) keeps brief trouble off the public page: automatic incidents that recover sooner are left out of the incident list, and a day's bar only changes color once its failed and slow checks add up to that long. They still alert you, still count toward the uptime percentage, and stay visible in the admin. Set it to 0 to show everything. Totals recorded before this behavior was added keep their old counts.
- **Storage budget.** Each check rewrites one row per monitor (the state row carries the last 90 checks and the current hour's totals). Hours are rolled into `hourly` and `daily` tables when they close. At one-minute checks that's about 1,440 row writes per monitor per day, so roughly 60 monitors fit D1's free 100k-writes/day allowance. History is kept for 35 days (hourly) and 400 days (daily).
- **Workers limits.** On the free plan a single invocation can make 50 outbound requests, which covers roughly 40 one-minute HTTP monitors plus their alerts. Use longer intervals or the paid plan beyond that.

### Caveats

- **Where checks run.** Checks run from Cloudflare's network, so a site that's down only for one region may look fine.
- **TCP checks** can't connect to Cloudflare's own IP ranges; that's a Workers restriction. Use HTTP checks for proxied hosts.
- **TLS certificate expiry** isn't visible to Workers `fetch`, so Bonk doesn't report it.

## Develop

```sh
pnpm install
pnpm db:migrate:local
cp .dev.vars.example .dev.vars           # set ADMIN_PASSWORD etc.
pnpm dev                                  # UI with hot reload (no cron)
pnpm preview                              # built Worker in workerd, cron testable:
curl "http://localhost:4173/__scheduled?cron=*+*+*+*+*"
pnpm test && pnpm check
```

Adding a notification service is one file in `src/lib/server/notify/providers/` implementing `Provider` from `notify/types.ts`. Its form in the admin is generated from `fields`. Register it in `notify/index.ts`.

## License

[Apache-2.0](LICENSE)
