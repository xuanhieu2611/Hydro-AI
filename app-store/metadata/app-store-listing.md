# Hydro AI — App Store Connect Listing (v1.0)

Paste-ready metadata for the App Store tab. Character counts noted; Apple's hard
limits are in (parentheses). The three **search-indexed** fields are App Name,
Subtitle, and Keywords — they're deliberately written to NOT repeat each other,
so every word buys new search coverage.

---

## Search-indexed fields (ASO)

### App Name  (30 max)
```
Hydro AI: Water Tracker
```
23 chars. Adds the two highest-volume terms — “water” + “tracker” — to the brand.

### Subtitle  (30 max)
```
Photo hydration & drink log
```
27 chars. Adds four fresh keywords not in the name: photo, hydration, drink, log.

### Keywords  (100 max, comma-separated, NO spaces)
```
reminder,intake,daily,goal,streak,habit,drinking,bottle,ounces,thirst,health,wellness,fluid,fitness
```
99 chars. Rules followed: no spaces (saves characters), no words repeated from
the name/subtitle, no “app”/“free” (wasted), no competitor trademarks (e.g. don’t
add “Waterllama”, “Plant Nanny”). Apple auto-combines these with the name +
subtitle into search phrases like “water reminder”, “hydration tracker”,
“daily intake goal”.

---

## Conversion fields

### Promotional Text  (170 max — editable anytime without a new build)
```
Snap a photo of any drink and let AI log your hydration — volume, type, and all. Set your goal, build your streak, and make staying hydrated effortless.
```
151 chars. Use this for seasonal/marketing tweaks later; changing it does NOT
require review.

### Description  (4000 max)
```
Staying hydrated should be the easiest healthy habit you have — not one more thing to remember. Hydro AI makes it effortless: just snap a photo of your drink and AI logs it for you.

No manual entry. No guessing cup sizes. No forgetting. Point your camera at a glass, mug, bottle, or can, and Hydro AI instantly estimates the volume, identifies the drink, and adds it to your day.

HOW IT WORKS
1. Snap — take a photo of any drink.
2. Confirm — AI estimates the volume and type; adjust in a tap if you want.
3. Done — watch your progress ring fill toward your daily goal.

WHY YOU'LL LOVE IT
• Photo-first logging — the fastest way to track water, coffee, tea, juice, and more
• Smart hydration math — every drink counts toward your goal by how hydrating it actually is
• A goal that fits you — set your daily target once and stay on track
• Streaks that stick — build the habit by hitting your goal day after day
• Gentle reminders — nudges timed around your day, only when you need them
• Your history at a glance — spot trends and celebrate your best streaks
• Accountability circle — connect with friends to stay motivated together (they see your progress, never your individual logs)
• Works in ml or oz — your units, your way

PRIVATE BY DESIGN
Your photos are processed and immediately discarded — full-resolution images never leave your device to be stored on our servers. We keep only the estimate and a small thumbnail. Export your data, clear your history, or delete your entire account anytime, right from the app.

Sign in securely with Apple or Google and start a hydration habit that finally sticks.

Download Hydro AI and make drinking enough water as easy as taking a photo.
```

### What's New (Version 1.0 release notes)
```
Welcome to Hydro AI! Snap a photo of any drink and let AI log your hydration automatically. Set a daily goal, build streaks, get gentle reminders, and stay motivated with friends. Have feedback? Reach us anytime — we read every message.
```

---

## Categories
- **Primary:** Health & Fitness
- **Secondary:** Food & Drink

## URLs
- **Support URL:** https://hieule.ca/hydro-ai/support
- **Marketing URL (optional):** https://hieule.ca/hydro-ai/support
- **Privacy Policy URL:** https://hieule.ca/hydro-ai/privacy

## Copyright
```
2026 Hieu Le
```

---

## Age Rating
Answer every content question **None / No** → results in **4+**. (No violence,
profanity, mature/suggestive themes, gambling, or unrestricted web access.)

---

## Build & Pricing
- **Price:** Free
- **Build:** select the NEW production build (the one just built via
  `eas build --profile production`) — it contains the working account-deletion +
  data-export code. Do NOT ship the older TestFlight build.

---

## App Review Notes
```
Sign-in: Hydro AI uses Sign in with Apple or Google only. No demo account is needed — the reviewer can sign in with a personal Apple ID to create a fresh account. Onboarding (name → goal → units → reminders) appears first; sign-in is the final onboarding step.

Core loop: From the Home tab, tap the camera button, take or pick a photo of any drink in a container, confirm the AI's estimate, and it logs toward the daily goal.

Account deletion (Guideline 5.1.1(v)): Profile tab → Data & account → Delete account. This permanently deletes the account and all associated data (profile, logs, thumbnails, connections) via a secure server-side function.

Note: the app estimates drink volume from a photo of a beverage in a container; any drink works for testing.
```

---

## Screenshots
Upload `app-store/screenshots/01-home … 05-profile.png` (1284×2778, iPhone 6.5").
ASC accepts the 6.5" set and scales it for smaller devices. Optional polish:
re-render at 1320×2868 (iPhone 6.9") via the `app-store/build/slide.html`
pipeline for pixel-perfect display on the largest phones.

---

## App Privacy questionnaire (the "nutrition label")

**Data used to track you:** None.
**Data linked to you:** everything below (first-party, stored in Supabase).
**Data not linked to you:** None.
**Third-party analytics:** None — analytics is console-only (`lib/analytics.ts`),
nothing is sent off-device.

For EVERY item below: **Linked to identity = Yes**, **Used for tracking = No**,
**Purpose = App Functionality** (only).

| Data type (Apple category) | Collected? | Why |
| --- | --- | --- |
| **Email Address** (Contact Info) | Yes | Account creation via Apple/Google sign-in |
| **Name** (Contact Info) | Yes | Display name / name from Google sign-in |
| **Photos or Videos** (User Content) | Yes | A small thumbnail per log is stored (the full-res photo is processed transiently and discarded — not "collected") |
| **Health** (Health & Fitness) | Yes | Your logged fluid/hydration intake |
| **User ID** (Identifiers) | Yes | Your account identifier |

Everything else (Location, Contacts, Browsing/Search History, Purchases,
Financial Info, Device ID, Advertising Data, Usage Data, Diagnostics, Sensitive
Info, etc.) → **Not Collected**.

> Consistency check: this label matches the hosted Privacy Policy exactly — email
> + name from sign-in, stored thumbnail, hydration logs, no tracking, no ads,
> no data sold. Apple cross-checks the two.
