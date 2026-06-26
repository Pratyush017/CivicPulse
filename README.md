# 🛡️ CivicPulse

**Autonomous Infrastructure Triage & Gamification Platform**  
*Built for the Vibe2Ship Hackathon (June 2026)*

CivicPulse eliminates the manual bottleneck of city maintenance and infrastructure reporting. By empowering citizens to report issues via a mobile-first web app, CivicPulse utilizes Google's Gemini 2.5 Flash as an autonomous, 24/7 "City Inspector"—categorizing damage, rejecting false positives, verifying physical repairs, and distributing community gamification points securely.

---

## 🚀 The Architecture (Key Features)

### 1. The AI Triage Gate (Cost & Data Integrity)
To prevent gamification farming and database bloat, every submitted report passes through a strict Gemini 2.5 Flash triage gate.
* **False-Positive Rejection:** The AI categorically rejects non-issues (e.g., clean roads, blank walls, random selfies).
* **Automated Cloud Cleanup:** If an image is flagged as a false positive, the Next.js backend intercepts the rejection, extracts the filename, and autonomously executes a Supabase `remove()` command to delete the junk image from the storage bucket, saving cloud costs.

### 2. Dual-Factor AI Anti-Spoofing
Verifying that a civic issue has been resolved requires strict proof to unlock "Civic Points". We utilize a two-pronged verification loop:
* **Factor A (Spatial GPS):** A Haversine algorithm calculates the distance between the original report coordinates and the verifier's active GPS location, enforcing a strict <50m bounding box.
* **Factor B (Multimodal Forensics):** Gemini 2.5 Flash analyzes `Image A` (the original damage) and `Image B` (the newly uploaded repair) side-by-side. It compares background structures, road textures, and lighting angles to mathematically verify it is the exact same physical location *and* that the repair is visually complete.

### 3. Zero-Trust Supabase Backend
This is not a public sandbox. CivicPulse is built on a hardened, production-ready database architecture:
* **Row Level Security (RLS):** Strict policies ensure users can only insert verified data via authenticated JWT tokens.
* **Server-Side RPC Gamification:** The `increment_civic_points` engine is fully detached from the frontend. Points are awarded exclusively by the secure server after AI verification passes, eliminating client-side injection attacks.
* **Crypto UUIDs:** Filenames are generated via Node's native `crypto.randomUUID()` to prevent high-concurrency overwrites.

### 4. Responsive & Native UX
* **Device-Aware Capture:** Desktop users see a seamless Drag-and-Drop zone, while mobile users get a native HTML5 camera integration (`capture="environment"`) to shoot high-res photos directly in the field.
* **Dynamic Canvas Rendering:** Leaflet's `invalidateSize()` hook is deployed to prevent rendering breaks during mobile device rotation.
* **Client-Side Throttling:** 59-second UI cooldowns prevent accidental double-submits, backed by AbortControllers to kill ghost requests.

---

## 🛠️ Tech Stack

* **Frontend:** Next.js 16 (App Router), React, Tailwind CSS, shadcn/ui.
* **Mapping:** Leaflet.js (CartoDB Dark Matter tiles).
* **Backend & Auth:** Supabase (PostgreSQL, Storage, RLS, Edge RPC).
* **AI Engine:** Google Gemini 2.5 Flash (`@google/genai`).

---

## ⚙️ Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pratyush017/CivicPulse.git
   cd CivicPulse
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Variables:**
   Create a `.env.local` file and add your keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   GEMINI_API_KEY=your_google_ai_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

---

## 👤 Developer

* **Pratyush Raj** - *Pursuing B-Tech Information Technology @ VIT Vellore*
