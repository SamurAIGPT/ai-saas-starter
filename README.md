# 🚀 AI SaaS Starter — Professional Next.js AI SaaS Platform

> **The production-ready, professionally upgraded AI SaaS template.** Build and deploy fully functional AI-powered SaaS with Google OAuth, PayPal payments, professional landing page, MuAPI AI engine, Prisma, and webhook-backed async generation — in minutes. Fully open-source and ready for production.

**Tech stack:** Next.js 16 (App Router) · Prisma · PostgreSQL · NextAuth (Google OAuth) · PayPal · Tailwind CSS v4 · MuAPI · Webhook-backed async delivery
**Use cases:** AI image generators · AI video generators · AI audio tools · Virtual try-on apps · AI writing tools · AI photo editors · Any credit-based generative AI SaaS

**Recent Updates:** 
- ✨ Professional landing page with hero section and features showcase
- 💳 PayPal integration (replaced Stripe)
- 🎨 Enhanced UI/UX with modern design components
- 📊 Professional pricing page with feature showcase
- 🚀 Production-ready architecture

---

## 🏗️ Technical Architecture
* **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + React Icons
* **Database**: Supabase Shared PostgreSQL pool + Prisma Client
* **Auth**: NextAuth with Google OAuth Provider
* **Billing**: PayPal Checkout with secure webhook validation for credit additions
* **Prediction Engine**: Universal async trigger, inline client polling, and webhook prediction completion sync

---

## 📁 Key Features
* **Professional Landing Page**: Beautiful hero section with gradient effects, feature showcase, and clear call-to-action buttons
* **Google Auth & Session Management**: Secure user registration, sign-in state checks, and session persistence
* **PayPal Credit Checkout System**: Secure payment processing with webhook validation and automated credit topups
* **Prediction Webhook System**: Two-tiered delivery (inline polling for short tasks, and webhook handler for longer predictions)
* **Local Webhook Bypass Pattern**: Automatically polls active generations on creations load (`/api/creations`) to heal state if webhooks fail
* **Premium Theme (Dark Mode)**: Fully responsive dark-themed workspace with modern design components
* **Professional Pricing Page**: Beautiful pricing cards with feature showcase and clear pricing tiers
* **CORS-Safe Downloads**: Server proxy `/api/download` to bypass cross-origin browser behaviors and download images immediately

---

## 🗄️ Database Safety Warning (Supabase Shared DB)

This application shares a single PostgreSQL database instance with other SaaS tools. **To prevent deleting tables of other applications in the shared pool, you MUST follow the schema synchronization lifecycle:**

1. **Pull first (Introspection)**: Run `npx prisma db pull` to load all database tables into your local `schema.prisma`.
2. **Declare your model**: Write your application's custom tables (e.g. `Creation`, `Enhancement`) and links inside the `User` model.
3. **Push changes**: Run `npx prisma db push`. This adds your models safely without dropping existing ones.
4. **Cleanup schema**: Strip models of other apps out of your `schema.prisma` file so your compiled types remain clean and lightweight.
5. **Generate client**: Run `npx prisma generate` to rebuild the type-safe client.

---

## 🔑 Environment Variables
Create a `.env` file in the root directory (based on `.env.example`):
* `DATABASE_URL`: Connection URL of Supabase PostgreSQL database.
* `DIRECT_URL`: Connection URL for database migrations.
* `NEXTAUTH_SECRET`: Random string for encrypting NextAuth sessions.
* `NEXTAUTH_URL`: Canonical root URL of the deployment (e.g. `http://localhost:3000`).
* `ADMIN_EMAILS`: Comma-separated Google account emails allowed to administer the app catalog.
* `GOOGLE_CLIENT_ID`: OAuth Client ID from Google Cloud Console.
* `GOOGLE_CLIENT_SECRET`: OAuth Client Secret from Google Cloud Console.
* `MUAPIAPP_API_KEY`: API Key to connect to the MUAPI services.
* `WEBHOOK_URL`: Target webhook domain (usually maps to `NEXTAUTH_URL`).
* `NEXT_PUBLIC_PAYPAL_CLIENT_ID`: PayPal sandbox/production client ID.
* `PAYPAL_CLIENT_SECRET`: PayPal sandbox/production secret key.
* `PAYPAL_WEBHOOK_ID`: PayPal webhook ID for payment confirmations.
* `PAYPAL_ENV`: Set to `sandbox` to use PayPal Sandbox; defaults to `production`.
* `PAYPAL_API_BASE`: Optional PayPal API endpoint override.
* `MUAPI_WEBHOOK_SECRET`: Long random secret for authenticating generation callbacks (falls back to `NEXTAUTH_SECRET`).
* `DOWNLOAD_ALLOWED_HOSTS`: Comma-separated exact HTTPS hosts allowed by the image download proxy.

---

## 🚀 Local Setup & Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure PayPal credentials:
   - Copy `.env.example` to `.env.local`
   - Add your PayPal Client ID, Secret, and Webhook ID
   - See [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md) for detailed PayPal setup
   
3. Dynamic DB sync (Follow the Database Safety lifecycle above):
   ```bash
   npx prisma db pull
   npx prisma generate
   ```
   The current schema adds `PayPalOrder` and `PaymentEvent`; synchronize these models with the database before using PayPal checkout or webhook idempotency. Review the shared-database warning above and back up the database before schema changes.
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Build for production:
   ```bash
   npm run build
   ```

---

## 📖 Documentation

- **[UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md)** - Complete setup guide for PayPal integration and customization
- **[CHANGES.md](./CHANGES.md)** - Detailed list of all upgrades and changes

---

## 🛠️ How to Launch a Custom SaaS App with Dynamic Parameter Uploads

This Next.js SaaS platform includes a parameter designer that allows you to configure dynamic image, video, and audio uploads with strict input count limits.

### 1. Define App Custom Parameters (JSON Schema)
Click **Launch New App** on the main dashboard and paste a JSON template containing your prompt parameters. The system automatically inspects both keys and values to map them to appropriate form fields:
* **Image Upload Fields**: Keys containing `image` or `img` (or string values ending in `.jpg`, `.png`, `.webp`, `.gif`) auto-detect as **Image Upload** (`image_list`).
* **Video Upload Fields**: Keys containing `video` (or string values ending in `.mp4`, `.webm`, `.mov`) auto-detect as **Video Upload** (`video_list`).
* **Audio Upload Fields**: Keys containing `audio` (or string values ending in `.mp3`, `.wav`, `.m4a`) auto-detect as **Audio Upload** (`audio_list`).
* **Dropdowns (`enum`)**: String values with commas or matching common presets (e.g. `Auto`, `1k`, `2k`, `4k`) map to selections.
* **Toggles (`boolean`)**: Boolean values map to toggle switches.
* **Others**: Numbers map to number fields; text values with newlines (`\n`) map to textareas.

### 2. Auto-Detected Input Limits & Configuration
When an upload type is parsed, the parameter designer manages lists and limits automatically:
* **Single vs. List Key Detection**: If a key contains `_list` (e.g., `images_list`) or the default JSON value is an array, the system sets the default **Max Uploads Limit** to **`5`**. Otherwise, single-upload parameters (e.g. `image_url`) default to **`1`**.
* **Limit Range Adjustment**: You can dynamically modify the limits per-parameter using the **Max Uploads Limit** configuration input/slider (ranging from **1 to 10**) directly in the Launch Modal.

### 3. Execution & Studio Rendering
Upon launching the application, the dedicated studio route is created:
1. **Dynamic File Dropzones**: The studio sidebar renders clean, custom file upload dashed blocks (supporting icons for images, videos, and audios).
2. **Preview Grid & Deletion**: Uploaded items render in a responsive square preview grid with individual delete controls (`✕`).
3. **Limit Enforcement**: The sidebar restricts uploading more files once the configured limit (`maxInputs`) is reached.
4. **Data Packaging**: When generating output:
   * Single inputs (`maxInputs === 1`) are packaged as a single string URL value (e.g. `"https://cdn.muapi.com/file.png"`).
   * List inputs (`maxInputs > 1`) are packaged as an array of string URLs.
   * Standalone generated database compiler strings automatically stringify array parameters to ensure safe Prisma serialization in the background.
