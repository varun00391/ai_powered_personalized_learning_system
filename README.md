# LearnOS AI — Personalized learning (reference app)

A full-stack reference implementation of a **personalized learning path** system: onboarding captures goals, experience, schedule, and weekly availability; the backend builds phased roadmaps with **objectives, study tips, activities, and knowledge-check questions**; each phase opens a **dedicated page** with an **AI study guide** (Groq) and **MCQs after reading**; the **dashboard** also includes a **multi-turn AI tutor** (Groq).

This is a **foundation** you can extend with real video CMS, HLS playback, and a graded assessment API (as described in a typical LearnOS-style architecture).

---

## What’s included

| Area | Details |
|------|---------|
| **Auth** | Register / login, JWT (access token in `localStorage`). |
| **Onboarding** | Career presets or **custom free-text goal**; Python/SQL level; hours/week; study windows; flexibility. |
| **Learning paths** | Preset tracks (e.g. Data Engineer, ML Engineer) or **Groq-generated** phases for custom goals (with offline fallback). |
| **Dashboard** | Path overview; **phase pages** (AI study guide → MCQs); recommendations; ChatGPT-style **tutor chat**. |
| **AI** | **Groq** OpenAI-compatible API for tutor + optional custom path generation. Works offline with templated responses when no key is set. |
| **Data** | **PostgreSQL** (users, learning paths, JSONB phase payloads). |
| **Ops** | **Docker Compose**: `db`, `backend`, `frontend` (nginx). |

---

## Tech stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2 (async), Pydantic v2, Uvicorn, HTTPX, JWT, Passlib/bcrypt.
- **Frontend:** React 18, Vite, React Router, Tailwind CSS.
- **Database:** PostgreSQL 16 (Docker).

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2  
  **or**
- Python 3.12+, Node.js 20+, and a running PostgreSQL instance.

---

## Quick start (Docker — recommended)

From the repository root:

```bash
# Optional: create .env in the project root (see Environment variables)
docker compose up -d --build
```

Then open:

- **Web UI:** http://localhost:8080  
- **API docs (Swagger):** http://localhost:8000/docs  
- **Health:** http://localhost:8000/health  

**First run:** register → complete onboarding → open the dashboard → **click a phase** to open its study page (AI guide, then knowledge checks).

To stop:

```bash
docker compose down
```

To reset the database volume (wipes all users and paths):

```bash
docker compose down -v
```

---

## Environment variables

Compose reads a **`.env`** file in the project root (same directory as `docker-compose.yml`) if present.

| Variable | Service | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | backend | Enables Groq for the **AI tutor** and improves **custom goal** path generation. Get a key from [Groq Console](https://console.groq.com/). |
| `GROQ_MODEL` | backend | Default: `llama-3.3-70b-versatile`. Override with any model your Groq account supports. |
| `JWT_SECRET` | backend | Secret for signing JWTs. **Change in production.** |
| `VITE_API_URL` | frontend **build** | Browser must reach the API. Default when building the image: `http://localhost:8000`. If you deploy behind another host, rebuild with the public API URL. |
| `DATABASE_URL` | backend | Set automatically in Compose to the `db` service. For local Python runs, point at your Postgres DSN (async: `postgresql+asyncpg://...`). |

Example `.env`:

```env
GROQ_API_KEY=gsk_your_key_here
JWT_SECRET=use-a-long-random-string-in-production
```

---

## Local development (without Docker for app code)

### 1. Database

Start PostgreSQL and create a database/user, or run only the DB container:

```bash
docker compose up -d db
```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+asyncpg://learnos:learnos@localhost:5432/learnos
export JWT_SECRET=dev-secret
export GROQ_API_KEY=   # optional
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API: http://127.0.0.1:8000/docs  

On startup, the app runs `create_all` and lightweight **SQL patches** (`ALTER TABLE ... IF NOT EXISTS`) for older databases.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite dev server proxies `/api` and `/health` to port **8000**. UI: http://127.0.0.1:5173  

---

## Project layout

```
├── docker-compose.yml      # Postgres + API + static frontend
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI app, CORS, lifespan
│   │   ├── config.py       # Settings from env
│   │   ├── models.py       # User, LearningPath
│   │   ├── schemas.py      # Pydantic models
│   │   ├── routers/        # auth, onboarding, paths, tutor, careers, recommendations
│   │   └── services/
│   │       ├── path_engine.py      # Preset careers + pacing math
│   │       ├── custom_path.py      # Custom goals (Groq / fallback)
│   │       ├── groq_client.py      # Groq HTTP client
│   │       ├── phase_enrichment.py # Objectives, tips, MCQs per phase
│   │       └── study_guide.py      # Groq / template study guide per phase
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/          # Landing, Login, Register, Onboarding, Dashboard, PhaseStudyPage
│   │   ├── components/     # e.g. PhaseKnowledgeSection
│   │   └── api/client.js
│   ├── Dockerfile
│   └── vite.config.js
└── README.md
```

---

## Main API routes (short)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/auth/register` | Create user, returns JWT |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| GET | `/api/v1/auth/me` | Current user (Bearer token) |
| GET | `/api/v1/careers` | Preset careers + `custom` |
| POST | `/api/v1/learner/onboarding` | Submit onboarding, creates path |
| GET | `/api/v1/learning-paths/current` | Current path (phases include enrichment / backfill) |
| POST | `/api/v1/learning-paths/current/phase/{n}/study-guide` | AI or template **study guide** markdown for phase `n` |
| GET | `/api/v1/recommendations` | Cold-start style suggestions |
| POST | `/api/v1/tutor/chat` | Multi-turn chat: `{ messages, phase_context? }` |

Full schemas: **http://localhost:8000/docs**

---

## Phase content (no video required)

Each phase in the API includes:

- `learning_objectives`, `study_tips`, `key_activities`, `knowledge_checks` (MCQs)  
- **UI flow:** dashboard → `/dashboard/phase/{index}` → **POST study-guide** (Groq when `GROQ_API_KEY` is set, else structured template) → user reads → **Knowledge checks** section (same MCQs from the API)  
- `study_tips` enrichment uses default **video**-oriented hints unless you extend onboarding again  

Paths created **before** enrichment may be **backfilled on read** when `knowledge_checks` is missing.

---

## What’s not implemented (typical next steps)

- **Video:** HLS/CDN, upload pipeline, player.  
- **Graded quizzes:** Server-side scoring, attempt history, anti-cheat.  
- **Labs:** Sandboxed runtimes or external lab links.  
- **Knowledge graph DB:** Neo4j (paths are in-process / Groq today).  
- **Events / analytics:** Kafka, streaming (architecture doc style).  

---

## Security notes

- Change **`JWT_SECRET`** for any shared or production deployment.  
- Do **not** commit real `.env` files with secrets (keep `.env` in `.gitignore`).  
- This project is a **reference**: add HTTPS, rate limiting, and hardened headers before public production use.

---

## License

Use and modify for your own projects as needed.
