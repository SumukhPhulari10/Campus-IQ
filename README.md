# CampusIQ

> An AI-powered campus information and management platform for students, teachers, and administrators.

CampusIQ centralizes academic notices, deadlines, campus documents, student guides, profiles, reviews, and role-based dashboards. It uses Google Gemini to answer campus questions, extract PDF text, and translate information into Marathi.

## Features

- Role-based dashboards for students, teachers, and administrators
- Google Gemini-powered campus assistant
- RAG-based queries using uploaded campus documents
- PDF upload, text extraction, review, and indexing
- Academic notices and deadline management
- Student guide publishing
- English-to-Marathi section translation
- Academic calendar and event management
- Student, teacher, and administrator profiles
- Email verification and password-reset support
- JWT-based authentication
- Student reviews and ratings
- Global search across campus information
- SMS support through Twilio where configured
- PostgreSQL database persistence

## Tech Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS 4
- Lucide React
- Motion

### Backend

- Node.js
- Express
- TypeScript
- tsx
- PostgreSQL
- JSON Web Tokens
- bcrypt
- Multer
- PDFParse
- Nodemailer
- Google Gemini API

## Project Structure

```text
Campusiq/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── data/
│   │   ├── lib/
│   │   └── App.tsx
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── lib/
│   │   └── data/
│   ├── sql/
│   ├── server.ts
│   ├── package.json
│   └── .env.example
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js 18 or newer
- npm
- PostgreSQL
- A Google Gemini API key
- An SMTP account for email verification and password reset, if required

## Installation

```bash
git clone https://github.com/SumukhPhulari10/Campus-IQ.git
cd Campus-IQ
```

## Backend Setup

```bash
cd backend
npm install
```

Copy the example environment file:

```bash
cp .env.example .env
```

On Windows Command Prompt:

```bat
copy .env.example .env
```

Update `backend/.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/campusiq
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=replace_with_a_long_random_secret
NODE_ENV=development

API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173

DEMO_ADMIN_NAME=CampusIQ Administrator
DEMO_ADMIN_EMAIL=admin email
DEMO_ADMIN_PASSWORD=replace_with_a_secure_password

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-smtp-app-password
FROM_EMAIL=CampusIQ <your-email@gmail.com>
```

Create the PostgreSQL database:

```sql
CREATE DATABASE campusiq;
```

The backend creates and updates its required tables on startup. SQL migration scripts are in `backend/sql/`.

Start the backend:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

## Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

The Vite development server proxies `/api` requests to `http://localhost:3000`.

## Environment Variables

| Variable | Required | Description |
|---|---:|---|
| `PORT` | No | Backend server port. Defaults to `3000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `JWT_SECRET` | Recommended | Secret used to sign authentication tokens |
| `API_URL` | Recommended | Public backend URL |
| `FRONTEND_URL` | Recommended | Allowed frontend origin |
| `SMTP_HOST` | For email | SMTP server hostname |
| `SMTP_PORT` | For email | SMTP server port |
| `SMTP_USER` | For email | SMTP username |
| `SMTP_PASS` | For email | SMTP password or app password |
| `FROM_EMAIL` | For email | Sender address used by Nodemailer |
| `DEMO_ADMIN_NAME` | Optional | Name for the optional demo administrator |
| `DEMO_ADMIN_EMAIL` | Optional | Email for the optional demo administrator |
| `DEMO_ADMIN_PASSWORD` | Optional | Password for the optional demo administrator |

## Available Commands

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run preview
npm run lint
```

### Backend

```bash
cd backend
npm run dev
npm run build
npm start
npm run lint
```

## Production Build

Build the frontend:

```bash
cd frontend
npm run build
```

Build the backend:

```bash
cd backend
npm run build
npm start
```

Set `VITE_API_BASE_URL` in the frontend build environment:

```env
VITE_API_BASE_URL=https://your-backend.example.com
```

Keep `GEMINI_API_KEY`, database credentials, JWT secrets, and SMTP credentials only in the backend environment.

## API Overview

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/signup` | POST | Register a student or staff account |
| `/api/auth/login` | POST | Authenticate a user |
| `/api/auth/me` | GET | Retrieve the authenticated user |
| `/api/profile` | PUT | Update the current user's profile |
| `/api/query` | POST | Ask the Gemini campus assistant |
| `/api/chat/history` | GET | Retrieve AI chat history |
| `/api/documents/upload` | POST | Upload and index campus documents |
| `/api/documents` | GET | Retrieve campus documents |
| `/api/documents/:id/file` | GET | Download or preview a document |
| `/api/notices` | GET | Retrieve notices |
| `/api/calendar-events` | GET | Retrieve academic calendar events |
| `/api/translate` | POST | Translate text into Marathi |
| `/api/reviews` | GET/POST | Retrieve or submit student reviews |

## Database

The PostgreSQL database stores:

- Users and authentication details
- Documents and extracted content
- Notices
- Academic calendar events
- Chat conversations
- Student reviews
- Password-reset OTP records

Migration and setup scripts are located in `backend/sql/`.

## Troubleshooting

### Backend cannot connect to PostgreSQL

- Verify PostgreSQL is running.
- Confirm that `DATABASE_URL` has the correct host, port, username, password, and database name.
- Make sure the database exists.

### Gemini features are unavailable

- Set a valid `GEMINI_API_KEY`.
- Check the API key quota and permissions.
- Restart the backend after changing `.env`.

### CORS or frontend connection errors

- Set `FRONTEND_URL` to the frontend URL.
- Set `VITE_API_BASE_URL` or the Vite proxy correctly.
- Restart both development servers after environment changes.

### Email verification or password reset is not working

- Configure valid SMTP credentials.
- Set `API_URL` to the public backend URL.
- For Gmail, use an application password instead of the account password.

## Security Notes

- Never commit `.env` or real credentials.
- Replace all example passwords and API keys.
- Use a strong random `JWT_SECRET`.
- Restrict allowed frontend origins using `FRONTEND_URL`.
- Configure HTTPS for production deployments.
- Keep database and SMTP credentials on the backend server only.

## Contributing

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature
   ```

3. Make your changes.
4. Run frontend and backend lint/build checks.
5. Commit and push your branch.
6. Open a pull request.

## Author
Omkar Solanke
Sumukh Phulari

## Repository

[Campus-IQ on GitHub](https://github.com/SumukhPhulari10/Campus-IQ)
