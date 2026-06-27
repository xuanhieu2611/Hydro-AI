# Product Requirements Document

## Hydro AI — AI-Powered Daily Water Intake Tracker

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** June 25, 2026

---

## 1. Overview

### 1.1 Product Summary

Hydro AI is a mobile application that uses AI-powered image recognition to help users effortlessly track their daily water and fluid intake. Rather than manually logging volumes, users simply take a photo of any beverage container — a glass of water, coffee cup, water bottle, or tea mug — and the AI estimates the fluid volume and logs it automatically.

### 1.2 Problem Statement

Staying properly hydrated is a well-established health priority, yet most people underestimate or don't track their daily intake. Existing hydration apps require users to manually input volumes, which introduces friction, inaccurate self-reporting, and low long-term retention. Users need a habit that fits naturally into their day with near-zero cognitive load.

### 1.3 Goal

Build a delightful, frictionless mobile experience where taking a photo of your drink is all it takes to log hydration — making the habit as easy as snapping a photo.

### 1.4 Success Metrics

| Metric                        | Target (90-day post-launch) |
| ----------------------------- | --------------------------- |
| Day 7 retention               | ≥ 45%                       |
| Day 30 retention              | ≥ 25%                       |
| Average logs per user per day | ≥ 3                         |
| AI volume estimation accuracy | ≥ 85% within ±50ml          |
| Onboarding completion rate    | ≥ 80%                       |
| App Store rating              | ≥ 4.3 stars                 |

---

## 2. Target Users

### 2.1 Primary Personas

**The Health-Conscious Millennial (25–38)**

- Tracks sleep, steps, and nutrition but finds hydration logging tedious
- Already comfortable with photo-first apps (e.g., Snapchat, BeReal)
- Wants effortless data, not manual entry

**The Desk Worker (28–45)**

- Drinks coffee and water throughout the workday, often forgets to hydrate
- Values quick actions; no time for complex UI during a busy schedule
- Benefits from midday reminders tied to actual logged intake

**The Fitness Enthusiast (20–40)**

- Tracks macros and workouts; wants hydration data alongside health metrics
- Interested in how intake correlates with performance or recovery
- May have custom daily targets (e.g., 1 gallon/day goals)

### 2.2 Out of Scope Users (v1)

- Children under 13
- Clinical or medical hydration monitoring
- Users requiring highly precise medical-grade volume measurement

---

## 3. User Stories & Requirements

### 3.1 Capture & Log (Core Flow)

| ID    | User Story                                                                                                                | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| US-01 | As a user, I want to take a photo of my drink so that the app can identify and log the volume without me typing anything. | P0       |
| US-02 | As a user, I want to see the AI's estimated volume before it's logged, so I can confirm or adjust it.                     | P0       |
| US-03 | As a user, I want to quickly edit the estimated volume if I think the AI got it wrong.                                    | P0       |
| US-04 | As a user, I want to log multiple drinks throughout the day and see them accumulate toward my daily goal.                 | P0       |
| US-05 | As a user, I want to add a drink from my camera roll if I forgot to log it in the moment.                                 | P1       |
| US-06 | As a user, I want to manually log a drink by type and volume if I can't or don't want to take a photo.                    | P1       |

### 3.2 Goals & Personalization

| ID    | User Story                                                                                               | Priority |
| ----- | -------------------------------------------------------------------------------------------------------- | -------- |
| US-07 | As a user, I want to set a personalized daily hydration goal in ml or oz.                                | P0       |
| US-08 | As a user, I want the app to recommend a daily goal based on my weight, activity level, and climate.     | P1       |
| US-09 | As a user, I want to set beverage-specific preferences (e.g., whether to count coffee toward hydration). | P2       |

### 3.3 Progress & Dashboard

| ID    | User Story                                                                               | Priority |
| ----- | ---------------------------------------------------------------------------------------- | -------- |
| US-10 | As a user, I want to see today's intake at a glance on a home screen dashboard.          | P0       |
| US-11 | As a user, I want to view my hydration history over the past 7 and 30 days.              | P1       |
| US-12 | As a user, I want a breakdown of beverage types I consumed (water, coffee, juice, etc.). | P2       |

### 3.4 Reminders & Notifications

| ID    | User Story                                                                           | Priority |
| ----- | ------------------------------------------------------------------------------------ | -------- |
| US-13 | As a user, I want to receive smart reminders if I haven't logged a drink in a while. | P1       |
| US-14 | As a user, I want to customize the frequency and timing of hydration reminders.      | P1       |
| US-15 | As a user, I want a congratulatory notification when I hit my daily goal.            | P2       |

---

## 4. Feature Specifications

### 4.1 Camera Capture Flow

**Entry Point:** A prominent camera button on the home screen (bottom center, always visible).

**Flow:**

1. User taps the camera button.
2. Camera opens in full-screen mode.
3. User frames their drink and taps capture (or uses the shutter button).
4. A brief loading state (< 2 seconds) shows while the AI processes the image.
5. A result card slides up showing:
   - Identified beverage type (e.g., "Coffee — Ceramic Mug")
   - Estimated volume (e.g., "~240 ml")
   - Volume type (hydrating / partially hydrating / non-hydrating)
   - A simple slider or +/- buttons for quick volume adjustment
6. User taps "Log It" to confirm, or "Adjust" to edit.
7. The progress ring on the home screen animates to reflect the new total.

**Edge Cases:**

- Non-drink photo detected → Show prompt: "That doesn't look like a drink. Try again?"
- Low-confidence estimate → Show a wider range (e.g., "~200–280 ml") and prompt user to confirm
- Dark or blurry photo → Prompt user to retake in better lighting

### 4.2 AI Volume Estimation Engine

**Input:** RGB image from the device camera.

**Processing Pipeline:**

1. **Object detection** — Identify whether a drink container is present; classify the container type (glass, mug, bottle, tumbler, can, etc.)
2. **Beverage classification** — Identify the liquid type (water, coffee, juice, soda, tea, smoothie, etc.)
3. **Volume estimation** — Use container geometry, fill level, and reference scale cues to estimate volume in ml.
4. **Hydration coefficient** — Apply a multiplier based on beverage type to calculate "effective hydration" (e.g., plain water = 1.0, coffee = 0.8, soda = 0.6).

**Accuracy Requirement:**

- ≥ 85% of estimates within ±50 ml of true volume for standard containers (glass, mug, standard water bottle)
- Clearly flagged low-confidence estimates for unusual containers or fill levels

**Supported Container Types (v1):**

- Standard drinking glass (200–400 ml)
- Coffee mug / ceramic cup (200–350 ml)
- Disposable coffee cup (small/medium/large — 240/350/480 ml)
- Standard plastic water bottle (500 ml, 750 ml, 1L)
- Stainless steel tumbler / insulated bottle (350 ml, 500 ml, 750 ml)
- Standard aluminum can (330 ml, 355 ml)
- Tall glass / pint glass (400–600 ml)

**Out of Scope (v1):** Bowls, pots, bathtubs, IV bags, any non-standard vessel without reference cues.

### 4.3 Home Dashboard

**Components:**

- **Progress Ring** — Circular progress indicator showing today's intake vs. daily goal (e.g., "1,240 / 2,000 ml"). Animates on each new log.
- **Daily Log Feed** — Scrollable list of today's entries with timestamp, beverage type, thumbnail, and volume. Each item is tappable to edit or delete.
- **Quick Log Bar** — Below the feed, show 3–4 common drink tiles (e.g., "Glass of Water +250ml", "Coffee +240ml") for one-tap logging without a photo.
- **Streak Counter** — Shows how many consecutive days the user has met their goal.

### 4.4 History & Insights

**Weekly View:**

- Bar chart of daily intake for the past 7 days
- Highlight days where goal was met (green) vs. missed (grey/red)
- Weekly average shown below the chart

**Monthly View:**

- Calendar heatmap where color intensity corresponds to intake level
- Summary stats: days goal met, average daily intake, best day

**Beverage Breakdown (v2):**

- Donut chart showing proportion of intake by beverage type
- Flag days where coffee/caffeinated drinks exceeded recommended limits

### 4.5 Onboarding

**Screen 1 — Welcome:** App name, tagline, and hero animation of the photo-to-log flow.

**Screen 2 — Set Your Goal:**

- Option A: Let the app recommend (input weight + activity level → suggested goal)
- Option B: Set a custom goal manually (ml or oz toggle)

**Screen 3 — Unit Preference:** ml vs. fl oz

**Screen 4 — Notifications:** Enable reminders toggle with suggested schedule (e.g., every 2 hours from 8am–8pm). Skippable.

**Screen 5 — First Log CTA:** "Try it now — take a photo of a drink near you."

---

## 5. Technical Architecture

### 5.1 Platform

- **Mobile:** iOS (v16+) and Android (v12+)
- **Framework:** React Native (for shared codebase) or native Swift/Kotlin (if AI performance requires it)
- **Backend:** Node.js or Python (FastAPI) REST API
- **Database:** PostgreSQL for user data; S3-compatible storage for images (thumbnails only; raw images not retained after processing)

### 5.2 AI / ML Stack

| Component                      | Approach                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Container & beverage detection | Fine-tuned vision model (e.g., CLIP or a custom CNN) or multimodal LLM API (e.g., Claude Vision, GPT-4V) |
| Volume estimation              | Geometric estimation from bounding box + fill ratio + reference-based depth cues                         |
| Low-confidence detection       | Softmax confidence thresholds; flag if max class probability < 0.70                                      |
| Model serving                  | On-device inference (Core ML / TensorFlow Lite) for latency, with cloud fallback                         |

**Privacy:** Images are processed ephemerally. Full-resolution images are never stored server-side. Only the result (beverage type, estimated volume, timestamp) is persisted.

### 5.3 Data Model (Simplified)

```
User
  - id, email, display_name
  - daily_goal_ml, unit_preference
  - created_at

LogEntry
  - id, user_id
  - logged_at (timestamp)
  - beverage_type (enum)
  - estimated_volume_ml
  - user_adjusted_volume_ml (nullable)
  - hydration_coefficient
  - effective_hydration_ml (computed)
  - thumbnail_url
  - ai_confidence_score

DailySummary (materialized / cached)
  - user_id, date
  - total_intake_ml, goal_met (bool)
  - entry_count
```

### 5.4 API Endpoints (Core)

| Method | Endpoint             | Description                                            |
| ------ | -------------------- | ------------------------------------------------------ |
| POST   | /analyze-image       | Upload image → returns beverage type + volume estimate |
| POST   | /log-entry           | Save a confirmed log entry                             |
| PATCH  | /log-entry/:id       | Edit a log entry volume/type                           |
| DELETE | /log-entry/:id       | Delete a log entry                                     |
| GET    | /daily-summary?date= | Get summary for a given date                           |
| GET    | /history?range=7d    | Get history for past N days                            |
| GET    | /user/profile        | Get user profile and goal                              |
| PATCH  | /user/goal           | Update daily goal                                      |

---

## 6. Design Principles

- **Camera-first:** The camera shutter button is the most prominent element. Every other path to log is secondary.
- **Zero-friction confirmation:** The AI result card should require at most one tap to confirm. The default action ("Log It") should be safe to accept.
- **Transparency over magic:** Always show the AI's confidence and its reasoning (e.g., "Detected: Ceramic mug, ~80% full"). Users trust the app more when they understand it.
- **Celebration, not guilt:** Progress UI should celebrate achievements. Missed goals are shown neutrally, never with negative language.
- **Respect for privacy:** Communicate clearly that photos are processed and discarded; only the volume data is stored.

---

## 7. Privacy & Compliance

- **Data Minimization:** Full-resolution images are never stored. Only thumbnails (for the log feed) and metadata are retained.
- **User Control:** Users can delete any individual log entry or their entire account and data at any time.
- **GDPR / CCPA:** Data export available on request. Deletion requests honored within 30 days.
- **COPPA:** App is rated 13+. No collection of data from users under 13.
- **Health Data:** If integrating with Apple Health or Google Fit, adhere to their data handling agreements.

---

## 8. Integrations (v1 and Roadmap)

| Integration                               | Version | Notes                                                  |
| ----------------------------------------- | ------- | ------------------------------------------------------ |
| Apple Health (HealthKit)                  | v1      | Write daily water intake; read workouts to adjust goal |
| Google Fit                                | v1      | Same as above for Android                              |
| Apple Watch / Wear OS widget              | v2      | Quick-log button + daily progress ring on watch face   |
| Siri Shortcuts / Google Assistant         | v2      | "Hey Siri, log a glass of water"                       |
| Nutrition apps (MyFitnessPal, Cronometer) | v2      | Export hydration data                                  |

---

## 9. Monetization

| Model                       | Details                                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Free Tier                   | Unlimited photo logging, 7-day history, standard reminders                                                            |
| Hydro AI Pro (subscription) | 30-day history, beverage breakdown insights, custom reminder schedules, Apple Watch widget, Apple Health sync, no ads |
| Pricing                     | $2.99/month or $19.99/year                                                                                            |

---

## 10. Phased Rollout

### Phase 1 — MVP (Months 1–3)

- Camera capture + AI estimation
- Manual volume adjustment
- Daily progress dashboard (progress ring + log feed)
- Custom daily goal
- Apple Health / Google Fit write integration
- Basic push reminders
- iOS + Android

### Phase 2 — Growth (Months 4–6)

- 30-day history + heatmap calendar
- Quick-log tiles (no photo required)
- Beverage breakdown chart
- Streak tracking and milestone badges
- Pro subscription launch
- A/B test onboarding flows

### Phase 3 — Expansion (Months 7–12)

- Apple Watch / Wear OS companion app
- AI-powered personalized goal recommendations
- Social features (share streaks with friends)
- Voice logging via Siri / Google Assistant
- Third-party nutrition app integrations

---

## 11. Risks & Mitigations

| Risk                                                            | Likelihood | Impact | Mitigation                                                                             |
| --------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------- |
| AI volume estimation accuracy is too low for unusual containers | Medium     | High   | Build a robust user correction UX; use corrections as training signal to improve model |
| Users forget to log after the initial novelty wears off         | High       | High   | Smart reminder engine that adapts to user schedule; streak mechanic to build habit     |
| Privacy concerns about photo capture                            | Medium     | Medium | Clear in-app messaging; process-and-discard architecture; no cloud photo storage       |
| High server cost for image processing at scale                  | Medium     | Medium | Shift to on-device inference (Core ML / TFLite) where accuracy allows                  |
| Regulatory scrutiny as a health app                             | Low        | Medium | Avoid health claims; position as a personal tracking tool, not medical advice          |

---

## 12. Open Questions

1. Should partial-hydration beverages (coffee, tea, juice) count toward the goal, and if so, at what coefficient? Should this be a user preference?
2. What is the minimum acceptable AI accuracy before we require the user to confirm every estimate?
3. Should the free tier include Apple Health sync, or is that a Pro feature?
4. How do we handle sports drinks, protein shakes, and smoothies that may contain water as a component of a larger drink?
5. Do we store log entry thumbnails, or regenerate them from cached image data? What is the retention policy?

---

_Document owner: Product Team_  
_Reviewers: Engineering Lead, Design Lead, Data Science Lead_
