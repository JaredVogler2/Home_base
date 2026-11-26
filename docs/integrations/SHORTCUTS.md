# Siri and Apple Shortcuts: "Hey Siri, add to shopping list"

You can add things to the HOMEBASE shopping list by speaking to Siri on your iPhone. You build a small Shortcut
once, by hand, in Apple's Shortcuts app. After that, "Hey Siri, add to shopping list", then "milk, eggs and two
loaves of bread", puts each thing on the list, the same as if you had typed it on your phone. The list shows who
added it, as **Siri (your name)**.

It takes about five minutes to set up.

## What the shortcut key can and cannot do

The Shortcut uses a **shortcut key**: a long secret that starts with `hbs_`. Each grown-up makes their own, in
HOMEBASE.

It **can**:

- add things to your household's shopping lists — to the list you name, or else to your groceries list.

It **cannot**:

- sign in to HOMEBASE, open the app, or see anything: not the list, not the children, not the photos;
- tick things off, remove them, or change anything else;
- reach any other household.

Other things to know:

- HOMEBASE shows the key **once**, when you make it. It keeps only a fingerprint of it, so nobody can read your
  key back out of HOMEBASE later — not even you. If you lose it, take it back and make a new one.
- It stops working at once when you take it back, or when you leave the household (or are removed from it).
- Each grown-up can have up to 5 keys, one for each phone or Shortcut.
- A key can be used about once every ten seconds on average (60 times in ten minutes). That is plenty for
  speaking to Siri, and it stops anyone who has your key from filling the list with nonsense.
- Treat it like a password. Anyone who has it can add things to your list. Do not paste it into a message, a
  shared note or a screenshot.

## Step 1: make a shortcut key in HOMEBASE

1. On your phone, open HOMEBASE and sign in.
2. Go to **More → Siri & Shortcuts**.
3. Tap **New shortcut key** and give it a name you will recognise, such as "Sam's iPhone".
4. HOMEBASE shows the key, beginning `hbs_`. Tap **Copy**. Keep this screen open until you have pasted the key
   into the Shortcut in step 2.

You will also need your HOMEBASE address: the one you open in Safari, for example `https://our-home.example`.
The Shortcut sends to that address followed by `/api/shortcuts/add`, for example
`https://our-home.example/api/shortcuts/add`.

## Step 2: build the Shortcut

1. Open the **Shortcuts** app (it comes with every iPhone).
2. Tap **+** (top right) to start a new shortcut.
3. Tap **Add Action**, search for **Ask for Input**, and add it.
   - Leave the input type as **Text**.
   - Tap **Prompt** and type: `What should I add?`
   - Siri will ask this question out loud and listen to your answer. (You can use **Dictate Text** instead of
     **Ask for Input** if you prefer; it works the same way.)
4. Tap the search bar at the bottom, search for **Get Contents of URL**, and add it.
   - Tap **URL** and type your address followed by `/api/shortcuts/add`, for example
     `https://our-home.example/api/shortcuts/add`.
   - Tap the small arrow (**Show More**) to see the rest of the settings.
   - **Method**: choose **POST**.
   - **Headers**: tap **Add new header**.
     - Key: `Authorization`
     - Value: the word `Bearer`, a space, and then paste your key. It looks like `Bearer hbs_Q2x…` (all on one line,
       with exactly one space after `Bearer`).
   - **Request Body**: choose **JSON**.
     - Tap **Add new field**, choose **Text**.
     - Key: `text`
     - Value: tap the field, then choose **Provided Input** (the answer from the "Ask for Input" step) from the bar
       above the keyboard.
   - Optional: to always add to a particular list, add a second **Text** field with key `list` and the list's
     name as the value, for example `Hardware`. Without it, things go to your groceries list.
5. Search for **Get Dictionary Value** and add it.
   - Set it to get the **Value** for key `message` in **Contents of URL**.
6. Search for **Speak Text** and add it (it should speak the **Dictionary Value**). If you would rather read the
   answer than hear it, use **Show Result** instead.
7. Tap the name at the top (it says "New Shortcut"), choose **Rename**, and call it **Add to shopping list**.
8. Tap **Done**.

Now say: **"Hey Siri, add to shopping list."** Siri asks "What should I add?" Say, for example, "milk, eggs and
two bread". Siri answers with something like **"Added milk, eggs and 2 bread to Groceries."**

If something was already on the list, Siri says so: "Milk was already on Groceries." Nothing is added twice;
the line on the list notes that it was asked for again.

### Saying several things at once

Separate the things with "and" or with pauses that Siri writes as commas: "milk, eggs and bread". A number at
the front becomes the quantity: "2 bread", "3 lbs apples". Up to 20 things are added at once.

### If it does not work

Siri speaks whatever HOMEBASE answered:

| Siri says                                                     | What to do                                                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| "That shortcut key does not work any more…"                   | The key was taken back, mistyped, or you left the household. Make a new key and paste it again, with `Bearer ` in front. |
| "Too many tries. Please wait a little and try again."         | The key was used very often in the last ten minutes. Wait a few minutes.    |
| "There is no shopping list yet…"                              | Make a list in HOMEBASE first.                                              |
| Nothing, or an error about the URL                            | Check the address in step 4: it must start with `https://` and end with `/api/shortcuts/add`. |

## A second Shortcut: add from the Share Sheet

This one adds text you have selected anywhere — a recipe's ingredients in Safari, a message from the other
parent — through the **Share** button.

1. In the Shortcuts app, tap **+** to start a new shortcut.
2. Tap the **ⓘ** (details) button at the bottom and switch on **Show in Share Sheet**. Under **Share Sheet
   Types**, leave only **Text** selected. Tap **Done**.
3. At the top, the shortcut now says "Receive **Text** input from **Share Sheet**". Tap **If there's no input** and
   choose **Ask For** → **Text**, so you can also run it on its own.
4. Add **Get Contents of URL** exactly as in step 4 above, except that the value of the `text` field is
   **Shortcut Input** instead of Provided Input.
5. Add **Get Dictionary Value** (key `message`) and **Show Result**, as above.
6. Rename it **Add to HOMEBASE list** and tap **Done**.

Now select some text, tap **Share**, and choose **Add to HOMEBASE list**. Each line (or each thing separated by
commas) becomes one thing on the list, up to 20 at a time.

## Taking a key back

- On your phone, open HOMEBASE, go to **More → Siri & Shortcuts**, and tap **Remove** next to the key's name.
  It stops working immediately. The Shortcut on the phone will then say the key does not work.
- A parent can take back **anyone's** key in the household (a helper can take back only their own) — for
  example if a phone is lost.
- Removing someone from the household stops all of their keys at once.

## What HOMEBASE cannot do here, plainly

- **There is no "Share to HOMEBASE" button for the web app on iPhone.** iOS does not let a web app (one added to
  the Home Screen from Safari) appear in the Share Sheet. The Share Sheet Shortcut above is the way round it.
- **There is no two-way sync with Apple Notes.** Apple Notes has no supported way for another service to read
  or change a note, so HOMEBASE cannot keep a shared Note and the shopping list in step.
- **Sending a list to Notes or Reminders is something you do, not something HOMEBASE does in the background.** In
  HOMEBASE, open a list and tap **Share**: it hands the list to your phone as plain text, and you choose Notes,
  Reminders, Messages or anything else. It is a copy at that moment; later changes do not follow it.

## Verified and not verified

| What                                                                                              | Status |
| ------------------------------------------------------------------------------------------------- | ------ |
| `POST /api/shortcuts/add` with `Authorization: Bearer hbs_…`, a JSON body `{ "text": … }` or plain text, no cookie and no `Origin` header | Verified by the automated tests (`tests/server/shortcuts.test.ts`) |
| Several things in one sentence ("milk, eggs and 2 bread"), merging duplicates, naming a list       | Verified by the automated tests |
| A key taken back, an unknown key, or a key whose owner was removed from the household is refused   | Verified by the automated tests |
| The key is refused everywhere else in the API (it is not a session)                                 | Verified by the automated tests |
| Building and running the Shortcut on a physical iPhone, as described in steps 2 and the Share Sheet section | **Not verified** in this session — to verify on the owner's phone |
| The exact names of actions and buttons in the Shortcuts app, which Apple changes from one iOS version to the next | **Not verified** — to verify on the owner's phone |
| The "More → Siri & Shortcuts" page in HOMEBASE's parent app                                         | Being built alongside this guide; to check once it is in place |

## For developers

- Endpoint: `POST /api/shortcuts/add`. Body: `application/json` `{ "text": string (1–400), "list"?: string }`,
  or `text/plain`. Reply `200 { ok: true, list, added: string[], message }`; `401` for any key that does not
  work (one sentence for all), `429` with `Retry-After`, `409` when the household has no list.
- Keys: `GET/POST /api/shortcuts/tokens`, `DELETE /api/shortcuts/tokens/:id` (cookie session on a grown-up's
  own phone). Code: `server/http/routes/shortcuts.ts`.
- The key is looked up only by that route; sessions come only from the cookie, so no other route can accept it.
  Things are added through the same `addItem` as the `shopping.add` operation, with `via: 'voice'` and the actor
  `shortcut:<name>`, which the list shows as "Siri (name)".
