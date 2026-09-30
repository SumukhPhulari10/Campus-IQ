# CampusIQ 🎓

> **An AI-powered smart campus management & intelligence platform.**  
> Streamlining campus academics, notices, attendance, and queries for Students, Faculty, and Administrators with Google Gemini.

---

## ✨ Features

- 🤖 **Gemini AI Campus Assistant**: Instant, context-aware answers to campus queries, syllabus questions, and institutional guidelines.
- 👥 **Role-Based Portals**: Dedicated workspaces and dashboards tailored for **Students**, **Teachers**, and **Administrators**.
- 📅 **Schedules & Academic Calendar**: Real-time timetables, event schedules, exam notifications, and semester milestones.
- 📊 **Academic & Attendance Tracking**: Monitor course attendance, internal assessments, and performance metrics.
- 📄 **Document & Knowledge Base**: Upload campus PDFs, syllabi, and circulars with automated text extraction and vector search.
- ✉️ **Announcements & Notifications**: Instant campus-wide broadcasts and automated email alerts via Nodemailer.

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Motion](https://motion.dev/)
- **Backend**: [Node.js](https://nodejs.org/), [Express](https://expressjs.com/), [TypeScript (tsx)](https://github.com/privatenumber/tsx)
- **AI Engine**: [Google Gemini API (`@google/genai`)](https://ai.google.dev/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (`pg`)
- **Utilities**: [Multer](https://github.com/expressjs/multer) & [pdf-parse](https://www.npmjs.com/package/pdf-parse) (Document handling), [Nodemailer](https://nodemailer.com/) (Email alerts), [JWT](https://jwt.io/) & [bcryptjs](https://github.com/dcodeIO/bcrypt.js) (Authentication)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [PostgreSQL](https://www.postgresql.org/) database
- [Google Gemini API Key](https://aistudio.google.com/)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/SumukhPhulari10/Campus-IQ.git
   cd Campus-IQ
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   Provide your:
   - `GEMINI_API_KEY`
   - `DATABASE_URL` (PostgreSQL connection string)
   - SMTP details for email alerts (optional for dev)

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

The application will start locally at `http://localhost:3000` (or the configured port).

---

## 📜 Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the full-stack development server with hot-reload (`tsx watch server.ts`) |
| `npm run build` | Builds Vite frontend bundle and bundles the Express server |
| `npm run start` | Starts the production server from `dist/server.cjs` |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
