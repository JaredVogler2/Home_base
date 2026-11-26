# The wall display: what to check on the real thing

HOMEBASE was built and tested in desktop browsers at the wall's likely sizes. **None of it has been run on the
Apolosign 27-inch display itself** — that needs the device in your hands. This page is the list of things to
try, in order, with a place to write what you find. Until a line is filled in, treat it as *not verified*.

What the manufacturer's own pages say is in [`research/PROVIDER-FACTS.md`](research/PROVIDER-FACTS.md) §1; the
important parts are repeated here where they shape a step.

## Before you start

- The display in **Android Mode** (Calendar settings → *Go to Section* → *Default Launcher*), on your Wi-Fi.
- Your HOMEBASE address, and a parent's phone signed in to it. (Nothing hosted yet? A computer on the same
  Wi-Fi can serve the demo to the display for a first look: [`DEPLOYMENT.md`](DEPLOYMENT.md) §0.)
- Ten minutes for part A; half an hour for the rest.

## A. Does it run? (do these first)

| # | Try | Expect | Found |
| --- | --- | --- | --- |
| A1 | Open Chrome on the display (install it from Google Play if it is not there) and go to your address | The front door, then "This is the screen on the wall" shows a code and a square | |
| A2 | On your phone: *Family → Screens*, type or scan the code, name it | Within a few seconds the display shows the house | |
| A3 | Go to `/studio` on the display's browser | Every drawing is sharp, none is a question mark | |
| A4 | On the display, open `/studio/device` | A page of facts about this screen. Copy them into the table below | |
| A5 | Back at the house: are all six rooms, the boat and the faces on screen without scrolling? | Yes, in landscape | |
| A6 | Tap a child's face, the missions room, a mission, the big tick | It answers every tap at once; the mission shows as sent or done | |
| A7 | Tap the loudspeaker | Tock speaks. On `/studio/device`, "Try" each voice and note the nicest; a parent can then choose it in *Family → The wall → The wall's voice* | |
| A8 | Turn the display to portrait, if you mount it that way | The tall layout: three floors of two rooms | |

**From `/studio/device`** (they decide later steps):

| Fact | Found |
| --- | --- |
| The page is (CSS pixels) | |
| Sharpness (device pixel ratio) | |
| So the page draws at (real pixels) — is it 3840 × 2160? | |
| Memory it reports | |
| Browser (the line beginning "Mozilla…": it names the Android and Chrome versions) | |
| Can keep the app for offline use / Kept for offline use | |
| Drawing speed, at rest | |
| Voices it has | |

## B. Reach, touch and sound

| # | Try | Expect | Found |
| --- | --- | --- | --- |
| B1 | With the display mounted where it will live, have each child reach for the ground-floor rooms and the faces | Everything a child uses is on the ground floor or the path; the grown-ups' window under the roof is out of reach | |
| B2 | Swipe up from the bottom edge | Android's navigation bar appears (the manufacturer documents this). Check it does not cover the faces: they sit above the last strip of the screen on purpose | |
| B3 | Ten quick taps on one mission's tick | One mission done, stars given once | |
| B4 | Two fingers at once, a palm resting on the glass | Nothing odd happens | |
| B5 | Sound: is the volume right for the room? Does anything play in quiet hours (after 7:30 pm by default)? | Silent and dimmed in quiet hours | |
| B6 | Glare: look at the house from where the children stand, in daylight and with the lights on | Rooms are tellable apart; try *Family → The wall → Stronger contrast* if not | |

## C. Staying on, sleeping and waking

The manufacturer does not document how the browser behaves with the screen saver or sleep, so these need
watching over a day.

| # | Try | Expect | Found |
| --- | --- | --- | --- |
| C1 | Leave the house open for ten minutes untouched | HOMEBASE goes back to the house after 90 seconds and to its own photo slideshow after ten minutes (both adjustable) — *unless* the display's own screen saver starts first | |
| C2 | Set the display's **ScreenSaver** app to Google Photos with a short idle time. Does it start *over the browser*? | Not documented. If it does: is the house still there when you touch the screen? | |
| C3 | The screen saver "will only activate if the device does not have a password or screen lock enabled (except when using Google Photos)". Is a screen lock set? | Note it; a Google Workspace calendar account forces a screen lock | |
| C4 | Set **Sleep Mode** for the night. In the morning: is the house back by itself? | With a screen lock set, the manufacturer says the screen stays dark until Power is long-pressed | |
| C5 | Turn the Wi-Fi off for a minute while using a room, then on | A small cloud says "out of touch"; taps are kept and sent when it returns; nothing is lost or doubled | |
| C6 | Unplug the display and plug it in again | Does Chrome come back to the house by itself? Almost certainly not — see D | |
| C7 | Leave it running for 24 hours, used normally | Still responsive; no blank page. Note anything strange and the time | |
| C8 | After the screen saver (or Calendar Mode) has covered the house for a few minutes, come back to it | The house is as it was and carries on moving from where it stopped, with nothing said into an empty room meanwhile. HOMEBASE holds still while the browser says the page is hidden; whether this display's browser says so under its screen saver is the thing to find out (open `/studio/device` first, let the screen saver cover it, come back: does "Hidden just now" say *yes: for…*?) | |

## D. Making it come back to the house by itself (choose one)

**D1. Plain Chrome (no extra app).** Add HOMEBASE to the home screen (*⋮ → Add to Home screen → Install*): it
then opens without the address bar. After a restart someone taps its icon. Simplest; nothing is locked.

**D2. Fully Kiosk Browser (free features).** From Google Play. Set the *Start URL* to your address, *Launch on
boot*, and *Reload on idle*. These are free. It does not lock the display: a child can still leave with the
navigation bar.

**D3. Fully Kiosk PLUS (a one-off licence per device).** Adds real kiosk lock-down, scheduled sleep and wake,
and its own screen saver. It needs to be the default Home app and several Android permissions (usage access,
draw over other apps, accessibility, device administrator for screen-off). **This replaces the display's own
home screen**: check you can still reach Calendar Mode and Android settings before you rely on it (there is a
gesture and PIN to leave kiosk mode — set and remember it). One owner reported that with Fully Kiosk "when you
turn off the screen, the WiFi turns off" — test C4 again after installing.

HOMEBASE does not require any of these and will not ask to be a device administrator. Do not lock the display
in a way you cannot undo.

| # | Try | Found |
| --- | --- | --- |
| D-a | Which option did you choose? | |
| D-b | After a power cut, how does the house come back, and how long does it take? | |
| D-c | Can you still get to Calendar Mode, the screen saver settings and Android settings? How? | |

## E. The family calendar (the display's own Calendar Mode)

HOMEBASE does not show your calendar and **cannot open Calendar Mode for you**: the manufacturer documents no
way for a web page or another app to start it. The calendar room in the house says so, and shows a child only
the pictures you choose for each day.

| # | Try | Found |
| --- | --- | --- |
| E1 | Make a **shared family calendar** in iCloud (or Google) with only household events, so that work and medical appointments never appear on the wall | |
| E2 | Connect it in Calendar Mode. Note: two-way sync for iCloud and Google; **the direction is chosen at the first import and cannot be changed**; Outlook is one-way through a published link | |
| E3 | Add, change and delete an event on each parent's phone and on the display; check each appears on the others | |
| E4 | From the house, how do you get to Calendar Mode and back? (*Calendar settings → Go to Section → Default Launcher*, or the Calendar app in Android Mode.) Write the shortest route down for the family | |
| E5 | Is Calendar Mode still usable when HOMEBASE or the Wi-Fi is down? | It should be: it is the display's own |

## F. Photos (the display's own screen saver)

| # | Try | Found |
| --- | --- | --- |
| F1 | ScreenSaver app → Google Photos → a shared album you are happy to have on the wall | |
| F2 | Picture quality on the 4K panel; cropping (fill or fit); do new photos in the album appear, and how soon? | |
| F3 | Videos are not supported with Google Photos (manufacturer) — confirm nothing odd happens with an album that has some | |
| F4 | Touch during the screen saver: does it return to the house, or to Android's home? | |
| F5 | If the screen saver will not start over the browser, use HOMEBASE's own slideshow instead: *Family → Photos → Add photos* | |

## G. The Training Academy

| # | Try | Found |
| --- | --- | --- |
| G1 | *Family → Training Academy*: save the Academy's address, switch "The boat sails" on | |
| G2 | On the wall, tap the boat, then "Sail to the Academy" | The Academy opens in the same window | |
| G3 | **Coming home** — the thing most likely to need help. Try: the swipe-up navigation bar's Back; in an installed web app, the bar naming the other site and its close button; in Fully Kiosk, its home gesture or "Reload on idle" | Which one can your child do alone? | |
| G4 | Does the Academy keep its own progress on the display between visits? | It should (its own storage) | |
| G5 | Sound in the Academy after coming from HOMEBASE | |

## H. How it feels (performance)

The display's chip is modest (RK3576, 4 GB). The house is flat vector art with a few slowly moving layers.

| # | Try | Found |
| --- | --- | --- |
| H0 | Watch the house for fifteen seconds after it appears. Do the clouds and the chimney smoke keep moving? | Either is fine. If they stop after a few seconds, the wall judged that the display could not draw them smoothly and chose "light" motion by itself — write that down | |
| H1 | Open and close each room a few times | Opening is smooth; no stutter longer than a blink | |
| H2 | Leave the house on the rain or snow sky (`/wall?sky=rain` works only in the demo; otherwise wait for weather) | Still smooth; the display does not get hot | |
| H3 | If anything stutters: *Family → The wall → Calm mode* stops all movement | Smooth with calm mode on? | |
| H4 | After a day: is the browser still quick? (C7) | |

On a computer, `npm run measure` records frame times and memory for the same scenes in a headless browser
(see [`TEST_RESULTS.md`](TEST_RESULTS.md)); that is a guide, not a substitute for H1–H4.

## I. Ten minutes with a child (when you can arrange it)

Nothing in HOMEBASE has been tried by a real child yet. The automated tests walk the wall by pictures alone,
but a test is not a four-year-old. If a child is willing — and stops being willing the moment it is not fun —
stand beside them, say only what is in the "Say" column, and write down what happened. Do not film or
photograph the child; a pencil is enough.

| # | Say | Fewest taps | What to note |
| --- | --- | :-: | --- |
| I1 | Nothing. Let the house sit for a moment on a screen that has not been used | — | Did Tock's showing-round help, or get in the way? What did they tap first? |
| I2 | "Can you find your missions?" | 2 | Found their own face? The right room? How many taps, and where did they stop to think? |
| I3 | "Can you do one?" (a real one — shoes in the basket) | 2 more | Did they understand the picture? Go and do it? Come back and tap the tick? |
| I4 | "How many stars have you got?" | 2 | Did they go to the pig? Could they tell you without a number? |
| I5 | "Is there something you'd like to save up for?" | 2 more | Did they understand they were asking, not buying? |
| I6 | "Can you go back to the house?" | 1 | From any room. Did they find the house button by themselves? |
| I7 | "What did the bird say?" | 1 | Did they find the loudspeaker to hear it again? Could they hear and understand the voice? |
| I8 | (If it suits) "We need milk — can you tell the house?" | 3 or 4 | The pantry, the plus, the picture — and their own face, if the house does not know yet who is asking |

Afterwards: what did they try to do that the wall could not? What did they reach for and could not reach?
Those two answers are worth more than everything else on this page.

## When you have filled this in

Send it back (or open an issue with the findings — **no photos of the family, no addresses, no calendar
contents**). The answers to C2, C4, D and G3 decide whether anything in HOMEBASE should change for this display.
