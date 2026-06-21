# VisualAI — AI-Powered Media Processing Pipeline

A full-stack image analysis platform built with a microservices architecture. Upload an image, get AI-generated captions, labels, and safety analysis — all processed asynchronously through a distributed queue pipeline.


---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
│              Upload · Job List · Job Detail · Retry          │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Service (Express)                      │
│         Auth · Upload · Job CRUD · Swagger Docs              │
└──────┬──────────────────────────────────────────────────────┘
       │ enqueue(jobId)                    │ read/write
       ▼                                   ▼
┌─────────────┐                   ┌─────────────────┐
│    Redis     │                   │   PostgreSQL     │
│  (BullMQ)   │                   │  users · jobs    │
└──────┬──────┘                   └─────────────────┘
       │ dequeue                           ▲
       ▼                                   │ write results
┌─────────────────────────────────────────────────────────────┐
│                   Worker Service (Node)                       │
│           caption → labels → safety → mark complete          │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  ML Service (Flask + Python)                  │
│          /caption   /labels   /safety                        │
└─────────────────────────────────────────────────────────────┘
```

The **API** never waits for AI processing. It stores the job, returns the job ID immediately, and the worker handles everything in the background.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| API | Node.js, Express, JWT Auth, Multer, Swagger UI |
| Queue | BullMQ + Redis |
| Worker | Node.js |
| ML Service | Python, Flask, BLIP / Google Vision |
| Database | PostgreSQL |
| Storage | Cloudinary (production), Local volume (dev) |
| Infrastructure | Docker, Docker Compose |

---

## Technology Decisions

Every tool was chosen for a specific reason. Here's the thinking behind each one.

### Cloudinary — Image Storage
Uploaded images need to be accessible by both the API (which receives the upload) and the worker (which downloads the file for AI processing). Local disk doesn't work reliably across separate Docker containers in production. Cloudinary solves this with a free-tier CDN — the API uploads the file and stores the public URL, and the worker downloads from that URL regardless of where it's running. This also means image storage survives container restarts.

> Alternative considered: AWS S3. Rejected because it requires billing setup and IAM configuration that adds friction for a project submission. Cloudinary's free tier is sufficient and faster to integrate.

### BullMQ + Redis — Job Queue
Image processing (captioning, label detection, safety checks) takes 1–3 seconds per image. If the API waited for this synchronously, every upload request would block for that duration. BullMQ lets the API return a job ID immediately and hand off processing to the worker. Redis is the backing store for the queue — it's lightweight, fast, and BullMQ is built specifically around it.

> Alternative considered: A simple `setTimeout` or in-process queue. Rejected because it doesn't survive crashes and can't scale to multiple worker instances.

### PostgreSQL — Primary Database
Job records, user accounts, captions, labels, safety results, and retry counts all need to survive container restarts and be queryable by both the API and the worker. PostgreSQL gives relational integrity, easy JOINs, and JSONB support (used for `flagged_categories`). It's also the standard choice when the data model is known upfront.

> Alternative considered: MongoDB. Rejected because the job schema is fixed and relational — there's no benefit to schema flexibility here.

### JWT — Authentication
The system runs as multiple separate services (API, worker, ML). A stateless auth approach means any service can verify a token without hitting a shared session store. The API signs a JWT on login and verifies it on protected routes — no extra infrastructure needed.

> Tradeoff accepted: JWTs can't be revoked before expiry. For a production system this would need a token blocklist, but it's an acceptable limitation here.

### Flask (Python) — ML Microservice
The AI steps (BLIP captioning, label detection, safety analysis) are written in Python because the best ML libraries (PyTorch, Transformers, Pillow) are Python-native. Keeping the ML code in a separate Flask service means the Node.js worker stays lightweight and just orchestrates HTTP calls. It also makes it easy to swap models later without touching the queue or API.

> Alternative considered: Running ML inside the worker via a Python subprocess. Rejected because it couples the runtimes and makes the worker container much heavier.

### Docker Compose — Local Orchestration
Five services need to run together locally (API, worker, ML, PostgreSQL, Redis) with shared networking. Docker Compose handles this in a single `docker compose up --build` command. Each service gets its own container, its own Dockerfile, and communicates over the internal Docker network using service names (`postgres`, `redis`, `ml`) as hostnames.

> Production note: The same Docker images deploy to Render. The only change is replacing Docker Compose hostnames with Render's internal service URLs via environment variables.

### Render — Backend Hosting
Render supports Docker-based deployments natively, which means the same Dockerfiles used locally work in production without modification. Each service (`api`, `worker`, `ml`) is deployed as a separate Web Service with its own Root Directory. Render also provides managed PostgreSQL and Redis, which removes the need to self-host those dependencies.

> Alternative considered: Railway, Fly.io. Render was chosen because it has the clearest Docker + monorepo support and a free tier that covers this project's scale.

### Vercel — Frontend Hosting
The React/Vite frontend is a static build (`npm run build` → `dist/`). Vercel is purpose-built for this — it detects Vite automatically, deploys on every push to `main`, and serves the build from a global CDN. Zero configuration needed beyond setting `VITE_API_URL` to point at the Render API.

---

## Project Structure

```
media-pipeline/
├── docker-compose.yml          # orchestrates all 5 services
├── .env                        # root env (shared config)
│
├── api/                        # Express REST API
│   └── src/
│       ├── app.js
│       ├── server.js
│       ├── config/             # db pool, redis, queue
│       ├── controllers/        # auth, jobs
│       ├── middleware/         # JWT auth, error handler
│       ├── models/             # user, job
│       ├── routes/             # /auth, /jobs
│       ├── storage/            # file handling (local + Cloudinary)
│       ├── db/
│       │   └── migrate.js      # auto-applies SQL migrations on startup
│       └── docs/               # Swagger definition
│
├── worker/                     # BullMQ queue consumer
│   └── src/
│       ├── processJob.js       # orchestrates the AI pipeline
│       ├── caption.js          # step 1: image captioning
│       ├── labels.js           # step 2: label detection
│       └── safety.js           # step 3: content safety check
│
├── ml/                         # Python Flask AI microservice
│   └── app.py                  # /caption, /labels, /safety endpoints
│
└── web/                        # React frontend
    └── src/
        ├── pages/              # Login, Register, Dashboard, JobDetail
        ├── components/         # PrivateRoute, Navbar, JobCard
        └── api/                # axios client
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- A [Cloudinary](https://cloudinary.com) account (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/Abhishekbagoira/media-pipeline.git
cd media-pipeline
```

### 2. Set up environment variables

Each service has its own `.env`. Copy the examples and fill in values:

```bash
cp api/.env.example api/.env
cp worker/.env.example worker/.env
cp web/.env.example web/.env
```

**`api/.env` minimum required:**
```env
DATABASE_URL=postgresql://postgres:password@postgres:5432/visualai
REDIS_HOST=redis
REDIS_PORT=6379
JWT_SECRET=your_jwt_secret_here
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
ML_SERVICE_URL=http://ml:5000
```

**`worker/.env` minimum required:**
```env
DATABASE_URL=postgresql://postgres:password@postgres:5432/visualai
REDIS_HOST=redis
REDIS_PORT=6379
ML_SERVICE_URL=http://ml:5000
```

**`web/.env` minimum required:**
```env
VITE_API_URL=http://localhost:4000
```

### 3. Start all services

```bash
docker compose up --build
```

This starts: PostgreSQL · Redis · API · Worker · ML Service

Migrations run automatically on startup.

### 4. Open the app

| Interface | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:4000 |
| Swagger UI | http://localhost:4000/api/docs |

---

## API Reference

All job endpoints require a `Bearer <token>` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create a new user |
| `POST` | `/api/auth/login` | No | Log in, receive JWT |
| `POST` | `/api/jobs/upload` | Yes | Upload image, create job |
| `GET` | `/api/jobs` | Yes | List current user's jobs |
| `GET` | `/api/jobs/:id` | Yes | Get full job detail + results |
| `POST` | `/api/jobs/:id/retry` | Yes | Retry a failed job |

### Example: Upload an image

```bash
curl -X POST http://localhost:4000/api/jobs/upload \
  -H "Authorization: Bearer <your_token>" \
  -F "image=@/path/to/photo.jpg"
```

**Response:**
```json
{
  "jobId": "cf6aafd4-ec94-43fa-aa3c-eafb7cd2a94f",
  "status": "pending"
}
```

### Example: Get job results

```bash
curl http://localhost:4000/api/jobs/cf6aafd4-ec94-43fa-aa3c-eafb7cd2a94f \
  -H "Authorization: Bearer <your_token>"
```

**Response:**
```json
{
  "id": "cf6aafd4-ec94-43fa-aa3c-eafb7cd2a94f",
  "status": "completed",
  "caption": "a dog running on a beach",
  "labels": ["animal", "outdoor", "beach"],
  "flagged": false,
  "flagged_categories": null,
  "created_at": "2026-06-21T17:15:54Z"
}
```

---

## Job Lifecycle

```
pending → processing → completed
                    ↘ failed  →  (retry) → processing → ...
```

If the safety check detects risky content, the job is marked `flagged = true` and the detected category is stored in `flagged_categories`.

---

## ML Pipeline

Each uploaded image goes through 3 steps in sequence:

```
POST /caption  →  "a dog running on a beach"
POST /labels   →  ["animal", "outdoor", "beach"]
POST /safety   →  { flagged: false, categories: null }
```

All 3 steps are handled by the Flask ML microservice. The worker writes results back to PostgreSQL after all steps complete.

---

## Database Migrations

Migrations live in `api/src/db/migrations/` as numbered `.sql` files and are applied automatically on API startup in filename order.

```
001_create_users.sql
002_create_jobs.sql
003_create_notifications.sql
004_add_flagged_categories.sql
```

---

## Running Tests

```bash
# Worker unit tests
cd worker
npm test
```

---

## Deployment

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com)
2. Set **Root Directory** to `web`
3. Add env var: `VITE_API_URL=https://your-api.onrender.com`

### API / Worker / ML → Render

Deploy each as a separate Web Service with Docker runtime:

| Service | Root Directory | Start Command |
|---|---|---|
| API | `api` | `node src/server.js` |
| Worker | `worker` | `node src/index.js` |
| ML | `ml` | `python app.py` |

Add a **PostgreSQL** and **Redis** instance on Render, then set `DATABASE_URL` and `REDIS_URL` in each service's environment variables.

---

## Known Limitations

- No WebSocket updates — job status is polled via `GET /api/jobs/:id`
- No email notifications for flagged content
- Local ML model returns generic results for unrecognized images
- No horizontal scaling config (single worker replica)

---

## Roadmap

- [ ] Replace polling with WebSocket real-time updates
- [ ] Swap local ML model for production-grade Vision API
- [ ] Move file storage to S3 / Cloudflare R2
- [ ] GitHub Actions CI/CD pipeline
- [ ] Kubernetes deployment config
- [ ] Email alerts for flagged content
- [ ] Dead-letter queue strategy for failed jobs

---

## Author

**Abhishek** — built as a full-stack AI engineering project demonstrating async microservice architecture, queue-based processing, and AI integration.
