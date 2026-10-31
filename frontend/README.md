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

## 🚀 Frontend Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [CampusIQ backend](../backend/README.md)

### Installation

1. **Install dependencies from this folder:**
   ```bash
   npm install
   ```

2. **Configure the backend URL for production:**
   Set `VITE_API_BASE_URL` to the deployed backend origin in the frontend host's build environment:
   ```bash
   VITE_API_BASE_URL=https://your-backend.example.com
   ```

3. **Run the frontend locally:**
   ```bash
   npm run dev
   ```

The Vite development server starts at `http://localhost:5173` and proxies `/api` requests to `http://localhost:3000`. Start the backend separately.

---

## 📜 Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Runs the Vite frontend development server |
| `npm run build` | Builds the static frontend into `dist/` |
| `npm run preview` | Previews the production frontend build |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
