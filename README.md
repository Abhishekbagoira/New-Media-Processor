# AI-Powered Media Processing Microservice

A backend-heavy service that lets a user upload an image, runs it through an
asynchronous AI pipeline, and surfaces the result through authenticated APIs
and Swagger documentation.

This README is written for the person reviewing the submission. It explains
**what was built and why**, not just how to run it — the architecture
decisions matter as much as the code itself.

---

## 1. System Overview

```text
                    ┌─────────────┐
   Client / Postman ─────► │ API (Express) │ ─────► PostgreSQL (users, jobs)
                    └─────────────┘
                           │ enqueue(jobId)
                           ▼
                    ┌─────────────┐
                    │    Redis     │  (BullMQ queue)
                    └─────────────┘
                           │ dequeue
                           ▼
                    ┌─────────────┐
                    │ Worker (Node)│ ─────► Flask ML Service
                    └─────────────┘
                           │
                           ▼
                    PostgreSQL (writes results)
```

The **API** and **Worker** are two separate services in separate Docker
containers. They communicate only through Redis (the queue) and PostgreSQL
(the source of truth for job state). The API never waits for AI processing to
finish.

---

## 2. Architecture Decisions

These are the decisions an evaluator is most likely to ask about. Each one is
written as: **what I chose**, **why**, and **what I gave up**.

### 2.1 Worker Isolation — separate process, separate container

**Choice:** The API and worker are split into different services and run as
independent Docker containers in `docker-compose.yml`.

**Why:** Image captioning, label detection, and safety checks are slow enough
that they should not block HTTP requests. The API stores the job, returns the
job ID immediately, and the worker handles the heavy processing in the
background. This keeps the user-facing API responsive and makes the system
easier to scale later.

**What I gave up:** Slightly more operational complexity than a single
monolith. There are more env vars, more logs, and more services to manage.
That tradeoff is worth it because the whole assignment is about asynchronous
processing.

### 2.2 Queue-Based Processing with BullMQ

**Choice:** BullMQ backed by Redis is used to queue jobs after upload.

**Why:** The upload endpoint should do only the fast work: validate the file,
store it, create the database record, and enqueue the job. BullMQ gives a
clean queue abstraction, works well in Docker, and makes retries much easier
than a direct synchronous call chain.

**What I gave up:** I do not get real-time status push for free. In this
project, status is read back from the database through `GET /api/jobs` and
`GET /api/jobs/:id`.

### 2.3 Job State Stored in PostgreSQL

**Choice:** PostgreSQL is the source of truth for job records and results.

**Why:** The job list, detail view, caption, labels, safety result, retry count,
flagged category, and timestamps all belong in a durable relational store.
Keeping this state in Postgres makes the API easy to query and makes the worker
idempotent enough to support retries.

**What I gave up:** More schema design work than using a quick in-memory store.
That is the correct tradeoff here because the job data must survive container
restarts.

### 2.4 Authentication — JWT

**Choice:** JWT is used for sign up, log in, and protecting the job endpoints.

**Why:** The system is split into multiple services, so a stateless auth approach
fits well. The API only needs to verify the token and read the user ID from it.
That keeps the architecture simple and avoids server-side session storage.

**What I gave up:** Immediate token revocation is not built in. For this project,
that limitation is acceptable and should be documented rather than hidden.

### 2.5 File Storage — Local Docker Volume

**Choice:** Uploaded files are stored on a local volume inside the Docker
environment.

**Why:** The assignment allows local storage, so this keeps the project simple
and focused on the pipeline itself. It also avoids adding a cloud dependency
that would distract from the core backend flow.

**What I gave up:** Local storage is not ideal for multi-instance production
deployments because all services need access to the same files. In production,
this should move to S3, GCS, or Cloudflare R2.

### 2.6 AI Layer — Custom Flask ML Service

**Choice:** The AI steps are handled by a separate Flask service.

**Why:** The worker should stay lightweight and only orchestrate the pipeline.
Keeping the ML logic in its own service makes it easier to swap models later
and keeps the AI code isolated from the API and queue logic.

**What I gave up:** This does not directly use Google Cloud Vision API and
Hugging Face Inference API exactly as the PDF suggested. The structure of the
pipeline matches the assignment, but the implementation uses a local ML service
instead. That is a valid tradeoff for a working submission, but it should be
documented honestly.

---

## 3. Project Structure

```text
media-pipeline/
├── docker-compose.yml        # orchestrates postgres, redis, api, worker, ml
├── api/
│   ├── Dockerfile
│   └── src/
│       ├── app.js            # Express app entrypoint
│       ├── config/           # db, queue
│       ├── middleware/       # auth, error handling
│       ├── routes/           # auth, jobs
│       └── docs/             # Swagger setup
├── worker/
│   ├── Dockerfile
│   └── src/
│       ├── processJob.js     # queue consumer / orchestration
│       ├── caption.js        # caption step
│       ├── labels.js         # labels step
│       ├── safety.js         # safety step
│       └── utils/            # logger, helpers
└── ml/
    ├── Dockerfile
    └── app.py                # Flask ML endpoints
```

---

## 4. Features

### Authentication
- User sign up
- User log in
- JWT protected endpoints

### Upload Processing
- JPG validation
- PNG validation
- WEBP validation
- 5 MB size limit
- Unique job ID generation
- Database record created immediately
- Job enqueued asynchronously

### AI Pipeline
Each upload goes through:

1. Image captioning
2. Label detection
3. Content safety analysis

### Job Lifecycle
- `pending`
- `processing`
- `completed`
- `failed`

### Job APIs
- Upload image
- List jobs
- Get single job
- Retry failed job

### Swagger
- API documentation available through Swagger UI
- Works with Bearer token authentication

---

## 5. API Reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create a new user |
| `POST` | `/api/auth/login` | No | Log in and receive a JWT |
| `POST` | `/api/jobs/upload` | Yes | Upload an image and create a job |
| `GET` | `/api/jobs` | Yes | List the current user's jobs |
| `GET` | `/api/jobs/:id` | Yes | Get full job details |
| `POST` | `/api/jobs/:id/retry` | Yes | Retry a failed job |

---

## 6. Running Locally

### Install dependencies
Run the install command inside the API, worker, and ML folders if needed.

### Environment variables
Create the required `.env` files and fill in values for:
- `DATABASE_URL`
- `JWT_SECRET`
- `REDIS_HOST`
- `REDIS_PORT`
- `ML_SERVICE_URL`

If your setup includes file upload or logging paths, keep those in the same
environment file used by the API and worker.

### Start the system
```bash
docker compose up --build
```

This starts:
- API service
- PostgreSQL
- Redis
- Worker service
- ML service

### Swagger UI
After the services are up:

```text
http://localhost:4000/api/docs
```

---

## 7. How the Job Flow Works

```text
Upload image
   ↓
API validates file
   ↓
API stores file and creates job row
   ↓
API enqueues job in Redis
   ↓
Worker picks job from queue
   ↓
Worker calls ML service for:
   - caption
   - labels
   - safety
   ↓
Worker writes results back to PostgreSQL
   ↓
Job becomes completed or failed
```

If the safety step returns a risky category, the job is marked as
`flagged = true` and `flagged_category` is stored in the database.

---

## 8. Design Notes

### Why local storage was used
The requirement allowed local volume storage, so I used it to keep the system
simple and focused on the queue + worker architecture. In production I would
move to object storage so multiple containers can access the same file safely.

### Why Swagger was added
Swagger makes the API easier to review and test. It is useful for interviews
because the reviewer can run the endpoints without reading the code first.

### Why the frontend is minimal or not included yet
The assignment allows backend focus, but a simple UI would be the next step if
the project needs to match the full frontend requirement.

---

## 9. Scalability Notes

At higher load:

**What scales well**
- API service: stateless with JWT
- Worker service: can be scaled horizontally
- Redis queue: handles async buffering well

**Likely bottlenecks**
- PostgreSQL connection pool
- Local file storage
- Third-party or ML inference latency

**What I would do next**
- Move uploads to S3 / GCS / R2
- Add more worker replicas
- Add a queue dead-letter strategy
- Add test coverage for worker retry logic
- Add CI/CD with GitHub Actions
- Deploy to a cloud platform

---

## 10. Known Limitations

- Local storage only
- No cloud deployment yet
- No frontend UI yet, only API + Swagger
- No email notification for flagged content
- No WebSocket updates; job status is checked through API calls
- No Kubernetes deployment
- Limited automated tests at the moment

---

## 11. What Would Be Improved With More Time

- Build a minimal frontend for upload, job list, job detail, and retry
- Add in-app flagged-content warnings in the UI
- Add automated tests for worker retry behavior
- Add GitHub Actions CI
- Deploy the full system publicly
- Replace local file storage with object storage
- Swap the local ML service for the exact external AI APIs from the spec
