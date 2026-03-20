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

## Required env

```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/ibrat
JWT_SECRET=your_long_secret
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=123456789
DOMAIN=https://your-domain.com
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

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

## Notes for frontend

- Prefer `/auth/me` or `/users/me` right after login to hydrate the session.
- Prefer `/me` endpoints for student dashboards.
- `rooms` API is connected and available for schedule forms.
- CORS is controlled through `CORS_ORIGINS`.
