# Demo Data

Creates realistic QA/demo users, courses, groups, and optional payments through the existing HTTP API only.

## Safety

Do not run this against production unless you intentionally want demo records there.

The script aborts when `DEMO_API_BASE_URL` is not local unless:

```env
DEMO_ALLOW_PRODUCTION=true
```

## Environment

Required:

```env
DEMO_API_BASE_URL=http://localhost:3000
DEMO_ADMIN_USERNAME=admin
DEMO_ADMIN_PASSWORD=Admin123!
```

Optional:

```env
DEMO_CREATE_PAYMENTS=true
DEMO_ALLOW_PRODUCTION=true
```

Use `DEMO_CREATE_PAYMENTS=true` to create a mix of pending, confirmed, and cancelled demo payments where supported by the API.

## Command

```bash
npm run demo:create
```

PowerShell example:

```powershell
$env:DEMO_API_BASE_URL="http://localhost:3000"
$env:DEMO_ADMIN_USERNAME="admin"
$env:DEMO_ADMIN_PASSWORD="Admin123!"
npm run demo:create
```

## Endpoints Used

- `POST /auth/login`
- `GET /users/search?username=...`
- `POST /users`
- `GET /courses`
- `POST /courses`
- `PATCH /courses/:id`
- `GET /groups`
- `POST /groups`
- `PATCH /groups/:id`
- Optional payments:
  - `GET /payments`
  - `POST /payments`
  - `PATCH /payments/:id/confirm`
  - `PATCH /payments/:id/cancel`

## Demo Credentials

Owner:

```text
temp_owner_test / TempOwner123!
```

Teacher:

```text
sultonovo / Teacher123!
```

Students:

```text
Ali Karimov
username: student01
password: Student123!
course: Math Course

Bekzod Rustamov
username: student02
password: Student123!
course: Math Course

Jahongir Sobirov
username: student03
password: Student123!
course: Math Course

Abdulloh Xasanov
username: student04
password: Student123!
course: Math Course

Asilbek Tursunov
username: student05
password: Student123!
course: Math Course

Nodirbek Ergashev
username: student06
password: Student123!
course: IT and IT Technologies

Azizbek Rakhimov
username: student07
password: Student123!
course: IT and IT Technologies

Diyorbek Usmonov
username: student08
password: Student123!
course: IT and IT Technologies

Islombek Qodirov
username: student09
password: Student123!
course: IT and IT Technologies

Sardor Mirzayev
username: student10
password: Student123!
course: IT and IT Technologies

Muhammadali Yoqubov
username: student11
password: Student123!
course: Computer Basics

Akmaljon Ismoilov
username: student12
password: Student123!
course: Computer Basics

Shohruh Abduvaliyev
username: student13
password: Student123!
course: Computer Basics

Ibrohim Fayziyev
username: student14
password: Student123!
course: Computer Basics

Mirjalol Nurmatov
username: student15
password: Student123!
course: Computer Basics
```

Courses:

- `Math Course` - `400000`
- `IT and IT Technologies` - `500000`
- `Computer Basics` - `350000`

Groups:

- `Math Course Demo Group`
- `IT and IT Technologies Demo Group`
- `Computer Basics Demo Group`
