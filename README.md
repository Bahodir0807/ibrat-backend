# ibrat-backend

NestJS backend for an education platform with users, roles, courses, schedule, homework, grades, attendance, payments, notifications, rooms, and Telegram integration.

## Stack

- NestJS 11
- TypeScript
- MongoDB + Mongoose
- JWT auth
- class-validator / class-transformer
- Joi config validation
- Telegraf
- Jest

## Run

```bash
pnpm install
pnpm run start:dev
```

Production:

```bash
pnpm run build
pnpm run start:prod
```

The production start script runs `node dist/src/main.js`, which matches the current Nest build output.

## cPanel deploy

Backend is prepared for cPanel Node.js hosting.

What is already added:

- startup file [app.js](/c:/Users/User/Desktop/MyProjects/ibrat-backend/app.js)
- auto-deploy recipe [`.cpanel.yml`](/c:/Users/User/Desktop/MyProjects/ibrat-backend/.cpanel.yml)
- production env template [`.env.example`](/c:/Users/User/Desktop/MyProjects/ibrat-backend/.env.example)

Recommended cPanel setup:

1. Create a Node.js app in cPanel.
2. Set the application root to this backend folder.
3. Set the startup file to `app.js`.
4. Use your real production `.env` values.
5. Run `npm install` once if cPanel does not do it automatically.
6. Restart the app after the first build.

If you use cPanel Git deployment, [`.cpanel.yml`](/c:/Users/User/Desktop/MyProjects/ibrat-backend/.cpanel.yml) will:

- install dependencies
- build NestJS
- touch `tmp/restart.txt` for Passenger restart

## Required env

```env
NODE_ENV=production
PORT=3000
MONGO_URI=mongodb+srv://user:password@cluster.example.mongodb.net/ibrat
# Render often exposes this name; the backend accepts it as an alias.
MONGODB_URI=
JWT_SECRET=your_long_secret
JWT_REFRESH_SECRET=your_different_long_refresh_secret
# Optional alias for deploy environments that use this name.
REFRESH_JWT_SECRET=
TELEGRAM_BOT_TOKEN=
ADMIN_CHAT_ID=
DOMAIN=https://api.example.com
CORS_ORIGINS=https://app.example.com,https://www.app.example.com
RATE_LIMIT_PROVIDER=redis
REDIS_URL=redis://user:password@redis-host:6379
PUBLIC_RATE_LIMIT_TTL=60000
PUBLIC_RATE_LIMIT_LIMIT=10

ENABLE_SCHEDULER=false
SCHEDULER_DRY_RUN=false
PAYMENT_GENERATION_ENABLED=false
DEBT_AGING_ENABLED=false
DEBT_REMINDERS_ENABLED=false
PAYMENT_GENERATION_HOUR=1
DEBT_AGING_HOUR=2
DEBT_REMINDERS_HOUR=10

SMS_ENABLED=false
SMS_PROVIDER=mock
SMS_DRY_RUN=true
SMS_DEFAULT_LOCALE=ru
SMS_CENTER_NAME=Inter Talim
SMS_API_URL=
SMS_API_KEY=
SMS_SENDER=
SMS_MAX_DEBT_REMINDERS_PER_DAY=3
```

Notes:

- `MONGO_URI` should point to your external production MongoDB instance. `MONGODB_URI` is accepted as a Render-compatible alias.
- `JWT_REFRESH_SECRET` must be different from `JWT_SECRET` in production/staging. `REFRESH_JWT_SECRET` is accepted as an alias.
- For local development, use a plain Mongo connection string like `mongodb://127.0.0.1:27017/ibrat` and make sure MongoDB is running.
- For the Vite frontend on port 5173, copy `.env.local.example` to `.env.local`; it allows `http://localhost:5173` and `http://127.0.0.1:5173`.
- If `mongodb+srv` fails with `querySrv ECONNREFUSED`, set `DNS_SERVERS=1.1.1.1,8.8.8.8` so Node can resolve Atlas SRV records.
- `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`, and `DOMAIN` are optional only if Telegram integration is intentionally disabled.
- Scheduler is disabled by default. Set `ENABLE_SCHEDULER=true` only after confirming payment generation, debt aging, and reminder flags.
- SMS is disabled and dry-run by default. `SMS_PROVIDER=mock` requires no real provider credentials; non-mock providers are intentionally unsupported until a real provider is implemented.
- In production, `CORS_ORIGINS` should contain your real frontend domain list, not localhost values.
- In production and staging, `RATE_LIMIT_PROVIDER` must be `redis` and `REDIS_URL` must point to a shared Redis instance. Local development can use `RATE_LIMIT_PROVIDER=memory`.

## Render deploy notes

1. Add a Redis service or attach a managed Redis provider.
2. Set `RATE_LIMIT_PROVIDER=redis`.
3. Set `REDIS_URL` from the Redis provider connection string.
4. Keep `PUBLIC_RATE_LIMIT_TTL` and `PUBLIC_RATE_LIMIT_LIMIT` at or below the documented defaults unless intentionally tightening limits.
5. Do not set `CORS_ALLOW_ALL_ORIGINS=true` or `CORS_ALLOW_NO_ORIGIN=true` in production/staging.

## Auth

- `POST /auth/register`
- `POST /auth/login` -> `{ token, role, user }`
- `GET /auth/me`
- `POST /auth/me`
- `GET /users/me`

Send JWT as:

```http
Authorization: Bearer <token>
```

## Frontend-friendly endpoints

Use these for the current logged-in user instead of passing `userId` manually:

- `GET /attendance/me`
- `GET /grades/me`
- `GET /homework/me`
- `GET /payments/me`
- `GET /schedule/me`
- `GET /users/me`

## Main resources

### Users

- `GET /users`
- `GET /users/search?username=...`
- `GET /users/students`
- `GET /users/:id`
- `POST /users`
- `PUT /users/:id`
- `PATCH /users/:id/role`
- `DELETE /users/:id`

### Courses

- `GET /courses`
- `GET /courses/:id`
- `POST /courses`
- `PATCH /courses/:id`
- `PATCH /courses/:id/add-students`
- `DELETE /courses/:id`

Create/update payload:

```json
{
  "name": "Math",
  "description": "Base course",
  "price": 500000,
  "teacherId": "USER_ID",
  "students": ["USER_ID"]
}
```

### Rooms

- `GET /rooms`
- `GET /rooms/:id`
- `POST /rooms`
- `PATCH /rooms/:id`
- `DELETE /rooms/:id`

### Schedule

- `GET /schedule`
- `GET /schedule/me`
- `GET /schedule/user/:id`
- `GET /schedule/:id`
- `POST /schedule`
- `PUT /schedule/:id`
- `DELETE /schedule/:id`

Create/update payload:

```json
{
  "course": "COURSE_ID",
  "room": "ROOM_ID",
  "date": "2026-03-20T00:00:00.000Z",
  "timeStart": "2026-03-20T09:00:00.000Z",
  "timeEnd": "2026-03-20T10:30:00.000Z",
  "teacher": "USER_ID",
  "students": ["USER_ID"],
  "group": "GROUP_ID"
}
```

### Homework

- `GET /homework/me`
- `GET /homework/user/:userId`
- `POST /homework`
- `PATCH /homework/:id/complete`

```json
{
  "userId": "USER_ID",
  "date": "2026-03-20T00:00:00.000Z",
  "tasks": ["Task 1", "Task 2"]
}
```

### Grades

- `GET /grades/me`
- `GET /grades/user/:userId`
- `POST /grades`
- `PATCH /grades/:id`
- `DELETE /grades/:id`

```json
{
  "userId": "USER_ID",
  "subject": "Math",
  "score": 5
}
```

### Attendance

- `GET /attendance/me`
- `GET /attendance/user/:userId`
- `POST /attendance`

```json
{
  "userId": "USER_ID",
  "date": "2026-03-20T00:00:00.000Z",
  "status": "present"
}
```

Allowed status values:

- `present`
- `absent`
- `late`
- `excused`

### Payments

- `GET /payments`
- `GET /payments/me`
- `GET /payments/student/:studentId`
- `POST /payments`
- `PATCH /payments/:id/confirm`
- `DELETE /payments/:id`

```json
{
  "student": "USER_ID",
  "courseId": "COURSE_ID",
  "paidAt": "2026-03-20T00:00:00.000Z"
}
```

## Security

- Passwords are stored as bcrypt hashes.
- Passwords are never returned by the API.
- Old decrypt-password endpoints were removed.
- Config is validated on startup.

## Tests

```bash
pnpm test
pnpm run test:e2e
```

Manual local CORS check:

```bash
curl -i -X OPTIONS http://localhost:3000/auth/login -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type"
```

The response should include `Access-Control-Allow-Origin: http://localhost:5173`.

## Notes for frontend

- Prefer `/auth/me` or `/users/me` right after login to hydrate the session.
- Prefer `/me` endpoints for student dashboards.
- `rooms` API is connected and available for schedule forms.
- CORS is controlled through `CORS_ORIGINS`.
