# Provider facts, as read on 2026-11-26

What the manufacturers' and providers' own pages said on the day this was written. Every design decision that leans
on an outside service leans on a line here. Where a page did not say, this says **not documented** or
**unconfirmed** rather than guessing. Re-read the sources before relying on any of it later: these things change.

How it was gathered: three research passes fetched the pages named below. Apolosign's help centre answers a plain
fetch with 403, so its articles were read through the site's public JSON route
(`/api/v2/help_center/en-us/articles/<id>.json`); `H/<id>` below means
`https://support.apolosign.com/hc/en-us/articles/<id>`.

## 1. The wall display: Apolosign 27-inch 4K

| Fact | Source |
| --- | --- |
| 3840×2160, 16:9, 10-point touch LCD; RK3576 octa-core; 4 GB RAM; 64 GB storage; two 3 W speakers; four microphones; Wi-Fi 6; VESA 100×100; "Android EDLA Licensed" | product page `apolosign.com/products/apolosign-27-4k-digital-calendar` |
| Android version: not on the product page or in the manual. The company blog says "Android 15" for a line-up that includes the "27" UHD 4K (2nd Gen)" | `apolosign.com/blogs/discover/apolosign-digital-calendar-gets-smarter-multi-page-widgets-coming-soon` |
| No camera, and none can be connected | H/63945575430937 |
| No battery; Wi-Fi only, no Ethernet | H/56303886389657 |
| Wall bracket included, no desk stand at this size; landscape and portrait both supported | H/54087809004441, H/54710011509913 |
| Google Play is available in Android Mode | user manual (rev A1.0, 2025) |
| Chrome is referred to ("Open the Chrome browser on the calendar"); whether it is pre-installed is not documented for the calendars | H/60391730449945 |
| **Modes.** "Default home screen: Switch your landing page between Android Mode (standard tablet interface) and Calendar Mode (dedicated calendar interface)". In Android Mode the calendar is still reachable as an app | H/62474241065753, H/54233946858009 |
| **Switching.** Calendar settings → "Go to Section" → "Default Launcher" → Calendar Mode or Android Mode. No button or gesture is documented. Whether it restarts: not documented | H/54586764561177 |
| **Launching the calendar from an app or a web page: not documented.** No intent, deep link, URL scheme or package name appears anywhere. The calendar "does not support web access directly" | H/54712690547481 |
| A swipe up from the bottom edge shows the navigation bar | H/56557973536793 |
| **Screen saver.** Android Mode: the "ScreenSaver" app. Styles: "Scene, Picture, Clock, Dashboard, Apolosign Calendar, Google Calendar, or Google Photos". Local pictures can include video; "video files are not supported when using Google Photos". Starts after a chosen idle time, default Off | H/56804488060825 |
| The screen saver "will only activate if the device does not have a password or screen lock enabled (except when using Google Photos)" | H/56804488060825 |
| Sleep schedule: Calendar Mode sidebar → Sleep Mode; Android Mode Settings → Sleep Mode. With a screen lock set, the screen stays dark after the scheduled wake until Power is long-pressed | manual; H/63918062149657 |
| Whether the screen saver starts over a browser or another app in Android Mode: **not documented** | — |
| **Calendar sync.** Two-way with Google Calendar and iCloud Calendar; the direction is chosen at the first import and cannot be changed later. Outlook is one-way only, through a published ICS link | H/54713276072345, H/60353667501209, H/54620229107737 |
| Google Workspace accounts require a device screen lock (which collides with the screen-saver rule above) | H/54620361482905 |
| Kiosk mode, start on boot, app pinning, other launchers, the browser's viewport and pixel ratio: **not documented** | help-centre search returns nothing |
| Third-party only, one report: with Fully Kiosk, "when you turn off the screen, the WiFi turns off" | Home Assistant forum, July 2026 |

**What follows for HOMEBASE.** A web page cannot open the native calendar; the calendar door shows how to get there
and nothing pretends otherwise. The bottom edge of the screen belongs to Android's navigation bar, so child
controls keep clear of the last strip. The graphics chip is modest, so the wall is drawn as vector art with a
handful of moving layers, never a 4K 3D scene. Everything about the browser itself is a thing to measure on the
device (`docs/DEVICE-CHECKLIST.md`).

## 2. Hosting: Vercel

| Fact | Source |
| --- | --- |
| Hobby, per month: 1M function invocations; 4 hours active CPU and 360 GB-hours memory; 100 GB transfer; 1M edge requests | `vercel.com/docs/plans/hobby` |
| Function time limit 300 s on Hobby; 4.5 MB request body; at most 12 functions per deployment outside Next.js | `vercel.com/docs/functions/limitations` |
| Hobby is for "personal or non-commercial use". Over a limit there is no paid overage: the feature stops until 30 days pass, and compute overuse can pause the deployment | `vercel.com/legal/terms`, `vercel.com/pricing` |
| Cron jobs: on Hobby once a day, at some point in the scheduled hour; UTC; production only; no retries. Sent with `Authorization: Bearer <CRON_SECRET>`. "Schedules" (beta) allow every 15 minutes on Hobby | `vercel.com/docs/cron-jobs/usage-and-pricing`, `vercel.com/docs/schedules/limits` |
| New projects start with Vercel Authentication on previews; production domains are public. Since 2026-09-09 it can cover every deployment, production included, free on every plan | `vercel.com/docs/deployments/environments`, changelog |
| Password protection is not on Hobby | `vercel.com/docs/deployment-protection/usage-and-pricing` |
| Blob has private stores (read through the SDK or a signed URL); Hobby includes 1 GB | `vercel.com/docs/vercel-blob/private-storage` |
| A `pg` pool is made at module scope and passed to `attachDatabasePool` from `@vercel/functions` | `vercel.com/docs/functions/functions-api-reference/vercel-functions-package` |
| Functions in `api/`: a `tsconfig.json` at the root, "Path Mappings" and "Project References" unsupported; one entry with a `fetch` export and rewrites is the advised shape | `vercel.com/docs/functions/runtimes/node-js` |
| Node 26 is the default for new projects since 2026-10-29; 24 and 22 are available; an `engines` range resolves to the newest | `vercel.com/docs/functions/runtimes/node-js/node-js-versions` |

## 3. Postgres

| Fact | Source |
| --- | --- |
| Neon free: 1 GB per project, 100 compute-hours per project per month, sleeps after 5 minutes idle and wakes in a few hundred milliseconds; pooled host has `-pooler`; `SET LOCAL` inside a transaction is the documented way | `neon.com/docs/introduction/plans`, `neon.com/docs/connect/connection-pooling` |
| Supabase free: 500 MB database, 1 GB files, two projects, paused after about a week without activity; Realtime 200 connections and 2M messages a month | `supabase.com/docs/guides/platform/billing-on-supabase` |
| Supabase's pooler in transaction mode (port 6543) does not support named prepared statements; settings last for the transaction only. Direct connections on the free plan are IPv6 only, so Vercel must use the pooler | `supabase.com/docs/guides/database/connecting-to-postgres` |

**What follows.** A wall that asks "anything new?" every few seconds keeps a database awake. On Neon's free plan
that alone would spend the month's compute, so the wall asks only every 15 minutes in quiet hours (and while the
photos show) and every 30 seconds when idle in the daytime; Supabase's free plan has no such meter.
`docs/COSTS.md` does the arithmetic.

## 4. Kiosk: Fully Kiosk Browser

| Fact | Source |
| --- | --- |
| Free: start URL, URL allow-list, reload on idle (back to the start URL after a time), launch on boot | `fully-kiosk.com/docs/en/features/all` |
| PLUS licence (8.90 EUR / 10.99 USD per device, once): kiosk lock-down, screen saver, motion detection, scheduled sleep and wake, remote admin, the JavaScript interface | `fully-kiosk.com/docs/en/legal/fully-plus-license` |
| Kiosk mode needs: default Home app, usage access, draw over apps, accessibility service, notification access; device administrator for screen off and schedules | `fully-kiosk.com/docs/en/features/permissions` |
| Other apps can be started from a page with `intent:` URLs or, with PLUS, `fully.startApplication(packageName)` — which needs a package name Apolosign does not publish | `fully-kiosk.com/docs/en/faq/otherapps` |

## 5. Google Photos

| Fact | Source |
| --- | --- |
| Since 2025-03-31 the Library API reaches only what the app itself created | `developers.google.com/photos/support/updates` |
| Picker API: create a session, send the person to `pickerUri` (it cannot be framed), poll until `mediaItemsSet`, list the picks (2000 at most), delete the session. Scope `photospicker.mediaitems.readonly` | `developers.google.com/photos/picker/guides/sessions` |
| A picked item's `baseUrl` lasts 60 minutes and needs the OAuth bearer token | `developers.google.com/photos/picker/guides/media-items` |
| An unverified app in Testing: 100 test users, and consent expires after 7 days. A "Personal" app type exists for the creator's own account | `support.google.com/cloud/answer/15549945` |
| Keeping the picked bytes for good: allowed in substance (the picker expects the bytes to be fetched), explicit permission unconfirmed; policy asks for encryption at rest and honouring deletion | `developers.google.com/photos/support/api-policy` |

**What follows.** No album can be followed automatically. The native Google Photos screen saver is the first
choice; HOMEBASE's own slideshow takes photos a parent uploads.

## 6. Apple

| Fact | Source |
| --- | --- |
| iCloud calendars for third-party apps: an app-specific password (needs two-factor; all are revoked when the password changes). The sign-in route for "supported" apps is a pilot | `support.apple.com/en-us/121539`, developer forum 825772 |
| A calendar can be shared by a public link: "a read-only version that anyone can view but not change" | iPhone user guide, "Share iCloud calendars" |
| Google Calendar has a "Secret address in iCal format": read-only, and resettable if it leaks | `support.google.com/calendar/answer/37648` |
| Apple Notes has no API: an Apple engineer answers "No." | `developer.apple.com/forums/thread/813810` |
| Shortcuts has Create Note, Append to Note and Find Notes actions; Get Contents of URL sends GET/POST/PUT/PATCH/DELETE with a JSON, form or file body; a shortcut runs by saying its name to Siri or from the share sheet; `shortcuts://run-shortcut?name=…&input=text&text=…` runs one from a link. No secret store is offered | Shortcuts user guide |
| Web apps on iPhone: Share → Add to Home Screen; push notifications and badges for Home Screen web apps (iOS 16.4+, after a tap); **no Web Share Target; no Background Sync**; storage of a Home Screen web app is exempt from the seven-day cap | `webkit.org/blog/13878`, `webkit.org/tracking-prevention`, WebKit bug 194593 |
| Sound on iPhone needs a tap first | `webkit.org/blog/6784` |

## 7. Chrome on Android

| Fact | Source |
| --- | --- |
| An installed web app that goes to another site keeps its window and shows a bar naming the other site, which can be closed to come back | `web.dev/learn/pwa/windows`, `developer.chrome.com/docs/capabilities/scope-extensions` |
| Screen Wake Lock is supported, and is released when the app is left | `developer.chrome.com/docs/capabilities/web-apis/wake-lock` |
