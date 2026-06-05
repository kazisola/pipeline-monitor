# Pipeline Monitor — Backend API

A production-grade real-time pipeline monitoring system built with NestJS, designed for Oil & Gas / Energy operations. This backend powers live sensor data collection, intelligent alert processing, and enterprise-grade authentication.

## Tech Stack

| Technology | Role |
|---|---|
| **NestJS** | Backend framework — modular, scalable Node.js architecture |
| **MongoDB** | Persistent storage for sensor readings and alert history |
| **Redis** | Real-time caching (latest sensor reads) + BullMQ queue backend |
| **BullMQ** | Async job queue for alert processing without blocking the API |
| **Keycloak** | Enterprise OIDC identity provider — simulates real industrial SSO |
| **Docker** | Containerized infrastructure — one command to run everything |
| **Passport JWT** | Token validation via Keycloak's JWKS public key endpoint |

## Architecture

```
Sensor POST /api/sensors
        │
        ├─► calculateAlertLevel()     Pure logic — no I/O
        │
        ├─► MongoDB .create()         Permanent storage
        │
        ├─► Redis .set() [TTL: 5min]  Cache latest reading per sensor
        │
        └─► if WARNING/CRITICAL
                │
                └─► BullMQ .add()     Fire-and-forget background job
                            │
                            └─► AlertsProcessor   Saves to alerts collection
```

Every protected route goes through:
```
Request → JwtAuthGuard → JwtStrategy → JWKS (Keycloak) → req.user → Controller
```

## Project Structure

```
src/
├── auth/
│   ├── guards/jwt-auth.guard.ts           Protects routes — 401 if token invalid
│   ├── strategies/jwt.strategy.ts         OIDC token validation via Keycloak JWKS
│   └── auth.module.ts
├── sensors/
│   ├── dto/create-sensor-reading.dto.ts   Request validation
│   ├── schemas/sensor-reading.schema.ts   MongoDB schema + enums
│   ├── sensors.controller.ts              REST API routes
│   ├── sensors.service.ts                 Business logic + Redis + BullMQ
│   └── sensors.module.ts
├── alerts/
│   ├── schemas/alert.schema.ts            Alert audit log schema
│   ├── alerts.processor.ts                BullMQ background worker
│   └── alerts.module.ts
├── app.module.ts                          Root module — wires everything
└── main.ts                                Bootstrap + global pipes + CORS
```

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/api/sensors/health` | ❌ Public | Health check |
| `GET` | `/api/sensors` | ✅ JWT | List readings (paginated, filterable) |
| `POST` | `/api/sensors` | ✅ JWT | Create sensor reading |
| `GET` | `/api/sensors/:id/latest` | ✅ JWT | Latest reading — Redis first, MongoDB fallback |
| `GET` | `/api/sensors/pipeline/:id/summary` | ✅ JWT | Aggregated pipeline stats |

### Query Parameters (GET /api/sensors)
- `pipelineId` — filter by pipeline
- `alertLevel` — filter by NORMAL / WARNING / CRITICAL
- `limit` — page size (default: 50)
- `skip` — offset for pagination

## Alert Level Logic

Alert level is automatically calculated on every incoming reading:

| Level | Condition |
|---|---|
| `NORMAL` | Value < 80% of threshold |
| `WARNING` | Value between 80–99% of threshold |
| `CRITICAL` | Value ≥ 100% of threshold |

## Getting Started

### Prerequisites
- Node.js 20+
- Docker Desktop

### 1. Clone and install
```bash
git clone <repo>
cd pipeline-monitor
npm install
```

### 2. Start infrastructure
```bash
docker compose up -d
```

This starts:
- **MongoDB** on port `27017`
- **Redis** on port `6379`
- **Keycloak** on port `8080`
- **Mongo Express** (DB UI) on port `8081`

### 3. Configure environment
```bash
cp .env.example .env
# Fill in KEYCLOAK_CLIENT_SECRET from Keycloak admin
```

### 4. Run the API
```bash
npm run start:dev
```

API available at `http://localhost:3000/api`

### 5. Keycloak Setup
1. Visit `http://localhost:8080` → login `admin / admin`
2. Create realm: `pipeline`
3. Create client: `pipeline-api` (Client Authentication ON)
4. Add Audience mapper → Included Client Audience: `pipeline-api`
5. Create user: `engineer1` / `Test1234!` (Temporary OFF, Email verified ON)

## Environment Variables

```env
MONGODB_URI=mongodb://admin:secret@localhost:27017/pipeline_db?authSource=admin
REDIS_HOST=localhost
REDIS_PORT=6379
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=pipeline
KEYCLOAK_CLIENT_ID=pipeline-api
KEYCLOAK_CLIENT_SECRET=your-secret-here
JWKS_URI=http://localhost:8080/realms/pipeline/protocol/openid-connect/certs
PORT=3000
```

## Key Design Decisions

**Why cache in Redis?**
The dashboard polls every 15 seconds. Without Redis, every poll hits MongoDB. With Redis, the latest reading is served from memory in under 1ms, with MongoDB as the fallback on cache miss. This pattern is called cache-aside.

**Why async alert processing with BullMQ?**
Under high sensor volume, handling alerts synchronously adds latency to every POST. BullMQ decouples ingestion from processing — the API stays fast, alerts are handled reliably with automatic retries and failure tracking.

**Why JWKS instead of a shared secret?**
JWKS lets NestJS verify tokens using Keycloak's public key without calling Keycloak on every request. Keys are cached locally. This is how real enterprise SSO works at scale — no central auth bottleneck.
