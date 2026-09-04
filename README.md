# Gemini Reflection Journal

A secure, private, user-authenticated reflection and journaling application built with **Google Gemini 3.6 Flash**, **Cloud Firestore**, and **Firebase Authentication (Google Sign-In)**.

---

## 🔒 1. Threat Model Summary

| Threat Zone | Identified Risk | Countermeasure / Mitigation Strategy |
| :--- | :--- | :--- |
| **Input Surfaces** | Malicious injection, oversized journal payloads, or corrupted reflection inputs | Client and server validation (length caps, null-safe destructuring, strict field whitelisting). |
| **Planning & Reasoning** | Prompt injection attempting to alter the reflective persona or bypass guardrails | Immutable system instruction architecture; user prompts treated strictly as plain content data. |
| **Tool Execution** | API route tampering, unhandled exceptions, resource exhaustion, or SSRF | Express server proxy enforcing clean error handling without stack leakage and model fallback ladders. |
| **Memory & State** | Cross-user data leaks, unauthorized reads/writes to other users' journals | Strictly owner-bound Firestore security rules (`/users/{userId}/**` with `request.auth.uid == userId`). |
| **Inter-System Communication** | Gemini API key leakage or client-side exposure | Zero hardcoded keys; Gemini API keys stored strictly server-side in Secret Manager / environment variables. |

---

## 🏗️ 2. Architecture & Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **User Identity** | Firebase Auth (Google Sign-In) | Federated authentication. No direct email/password storage. |
| **Backend Database** | Google Cloud Firestore | Strictly user-isolated document storage under `/users/{userId}/entries/{entryId}`. |
| **AI Processing Engine** | Gemini 3.6 Flash | Multi-turn reflections, exploratory inquiry, and executive summaries with model fallback ladder. |
| **Backend Server** | Express & Node.js | Secure server-side proxy for Gemini API calls, payload sanitization, and Vite integration. |
| **Frontend Framework** | React 19 + TypeScript + Tailwind CSS | Responsive, distraction-free journal interface with dark mode aesthetic. |

---

## 🛡️ 3. Firestore Security Rules

To enforce strict user data isolation, the following rules are deployed to Cloud Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User-isolated documents: only authenticated owners can read/write their own records
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## 🔑 4. Secret Management & IAM Configuration

### Step 1: Create the Secret in Google Cloud Secret Manager
```bash
# Set your active GCP project
gcloud config set project YOUR_PROJECT_ID

# Create and populate the GEMINI_API_KEY secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
```

### Step 2: Grant Secret Accessor IAM Role to Cloud Run
```bash
# Grant the Cloud Run compute service account permission to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🚀 5. Google Cloud Run Deployment Flow

### Step 1: Enable Necessary GCP APIs
```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com
```

### Step 2: Deploy Container to Cloud Run
```bash
gcloud run deploy gemini-reflection-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

### Step 3: Apply Required Campaign Label
```bash
gcloud run services update gemini-reflection-journal \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 6. Functional Walkthrough & Test Plan

Every user interaction has a corresponding verification test case:

### Test Case 1: Landing Page & Google Authentication
1. Navigate to the root URL (`/`).
2. Verify the landing screen displays the hero introduction, security badges, and the **Continue with Google** button.
3. Click **Continue with Google**.
4. Complete the Google Auth popup.
5. Verify the user is redirected to the private journal dashboard with their name/avatar in the navigation bar.

### Test Case 2: Composing a Reflection & Selecting Prompt Starters
1. In the editor, click on one of the starter templates (e.g., *"Navigating a Crossroads"* or *"Gratitude & Growth"*).
2. Verify that the prompt template text is inserted directly into the writing canvas and the corresponding AI Companion stance is selected.
3. Type custom thoughts into the journal content area.
4. Verify the live word counter and reading time update in real time.

### Test Case 3: Multi-turn Dialogue with Gemini 3.6 Flash
1. In the right-hand **Gemini Companion** dialogue box, click **Start Reflection on Current Draft** or enter a custom inquiry (e.g., *"What underlying patterns do you notice?"*).
2. Verify the loading spinner appears while Gemini 3.6 Flash reflects on the entry.
3. Verify Gemini's thoughtful reply renders formatted markdown.
4. Send a follow-up reply in the chat input.
5. Verify multi-turn context is preserved and both turns are visible in the dialogue stream.

### Test Case 4: Generating Executive Summary & Takeaways
1. Click the **Generate AI Insights & Summary** button in the toolbar.
2. Verify Gemini synthesizes the entire entry and conversation into:
   - An executive synthesis paragraph
   - 3 actionable Key Takeaways with bullet icons
   - A suggested entry title
   - Emotional sentiment pill and topic tags
3. Click **Use this title** to automatically update the reflection's title.

### Test Case 5: Cloud Firestore Autosave & User Isolation
1. Pause typing for 1.2 seconds.
2. Verify the header save status switches to **Syncing to Firestore...** and settles on **Saved**.
3. Open browser DevTools Network tab to confirm the data was written to `/users/{userId}/entries/{entryId}`.
4. Attempting to read another user's collection will trigger a Firestore permission denied error as enforced by `firestore.rules`.

### Test Case 6: Past Reflections History & Search
1. Click **Past Reflections** in the navbar.
2. Verify all past entries are listed with their title, date, excerpt, tags, and AI turn count.
3. Type a keyword into the search bar. Verify the list filters instantly.
4. Click a tag pill (e.g., `#Mindfulness`) to filter entries by category.
5. Click on an entry card to load it back into the active editor.

### Test Case 7: Deletion with Confirmation
1. In the History view, click the trash icon on an entry.
2. Verify the confirmation prompt appears (*"Delete? Confirm / Cancel"*).
3. Click **Confirm**.
4. Verify the entry is immediately removed from Firestore and disappears from the UI.

### Test Case 8: Error Recovery & Manual Retry
1. If network connectivity drops or the save operation encounters an error, verify the top warning banner appears with a **Retry Save** action.
2. Clicking **Retry Save** safely resubmits the sanitized payload to Firestore without data loss.
