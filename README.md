<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# ibrat-backend — Полная документация (RU)

Этот репозиторий — backend на NestJS для управления учебным процессом: пользователи, роли и доступы, курсы, расписание, посещаемость, домашние задания, оценки, платежи, уведомления и интеграция с Telegram-ботом.

Док содержит полный цикл: установка, переменные окружения, архитектура модулей, модели данных, безопасность, CI/CD и эксплуатация.

## Содержание

- О проекте
- Технологии
- Быстрый старт
- Переменные окружения
- Архитектура и модули
- Модели данных (схемы)
- Аутентификация и авторизация
- Шифрование паролей
- Интеграция с Telegram
- CORS
- Обработка ошибок и логирование
- API (обзор основных эндпоинтов)
- Скрипты разработки и тестирования
- Структура проекта
- Деплой и эксплуатация
- Roadmap/TODO

## О проекте

Система предназначена для частной школы/курсов:

- Управление пользователями и ролями (admin, owner, teacher, student, guest, extra/panda).
- Учебные сущности: курсы, расписание, домашние задания, оценки, посещаемость.
- Финансы: платежи учеников (базовая схема), планируется аналитика по доходам/расходам/заработной плате.
- Уведомления и Telegram-бот для регистрации по номеру телефона, проверок, рассылок и сервисных функций.

## Технологии

- Node.js, TypeScript
- NestJS 11
- Mongoose 8 (MongoDB)
- JWT (аутентификация)
- class-validator/class-transformer
- Joi (валидация конфигурации)
- Telegraf/nestjs-telegraf (Telegram)
- dotenv (загрузка .env)
- ESLint + Prettier, Jest

## Быстрый старт

Требования: Node.js LTS, pnpm, доступ к MongoDB.

1) Установка зависимостей

```bash
pnpm install
```

2) Конфигурация окружения (.env в корне)

См. раздел «Переменные окружения» ниже. Минимум: MONGO_URI, JWT_SECRET, ENCRYPTION_SECRET, ENCRYPTION_SALT, TELEGRAM_BOT_TOKEN, ADMIN_CHAT_ID, DOMAIN (для вебхука), PORT (опционально).

3) Запуск

```bash
# dev
pnpm run start:dev

# prod (предварительно сборка)
pnpm run build
pnpm run start:prod
```

Сервер слушает на 0.0.0.0:PORT (по умолчанию 3000). В логе будет URL домена и установленный вебхук Telegram.

## Переменные окружения

- `PORT` — порт HTTP (по умолчанию 3000).
- `MONGO_URI` — строка подключения к MongoDB, например: `mongodb://localhost:27017/ibrat`.
- `JWT_SECRET` — секрет для подписи JWT (обязателен, минимум 10 символов).
- `DOMAIN` — внешний домен для вебхука Telegram, например `https://b.sultonoway.uz` или публичный URL на проде.
- `TELEGRAM_BOT_TOKEN` — токен бота.
- `ADMIN_CHAT_ID` — chat_id администратора для уведомлений и заявок.
- `ENCRYPTION_SECRET` — секрет для симметричного шифрования паролей (AES-256-CBC).
- `ENCRYPTION_SALT` — соль для derivation ключа (scryptSync).
- Дополнительно: `SUPER_ROLE_KEY` может использоваться для выдачи расширенных прав при регистрации (см. `auth.service.ts`).

Примечание: модуль конфигурации (`src/config/validation.ts`, `src/config/configuration.ts`) проверяет базовые ключи. Для шифрования паролей ключ и соль берутся напрямую из `.env` в `src/common/encryption.ts`.

## Архитектура и модули

Главный модуль: `AppModule` (`src/app.module.ts`). Подключает:

- `AuthModule` — аутентификация, JWT, логин/регистрация.
- `UsersModule` — пользователи (CRUD, поиск, смена роли).
- `CoursesModule` — курсы и привязки к пользователям.
- `GroupsModule` — группы (если используются). 
- `SchedulesModule` — расписание занятий.
- `AttendanceModule` — посещаемость.
- `HomeworkModule` — домашние задания.
- `GradesModule` — оценки.
- `PaymentsModule` — платежи/финансы (базово, схема приведена, сервисы могут расширяться).
- `NotificationsModule` — уведомления и брокер событий для рассылок.
- `TelegramModule` — Telegram-бот, обработчики и рассылки.
- Общие модули: `common/*` (guards, filters, pipes, decorators, dto).

Глобальные Guard’ы:

- `JwtAuthGuard` (как `APP_GUARD`), аутентификация по JWT заголовку `Authorization: Bearer <token>`.
- `RolesGuard` (как `APP_GUARD`), проверка роли через декоратор `@Roles(...)`.

Глобальные пайпы/фильтры/интерсепторы регистрируются в `src/main.ts`:

- `AllExceptionsFilter`
- `LoggingInterceptor`
- `CustomValidationPipe`

## Модели данных (Mongoose схемы)

- `User` (`src/users/schemas/user.schema.ts`)
  - `username` (unique, required)
  - `password` (encrypted string)
  - `role` (enum Role, по умолчанию student)
  - `telegramId?`, `email?`, `firstName?`, `lastName?`, `phoneNumber?`, `isActive`, `avatarUrl?`

- `Course` (`src/courses/schemas/course.schema.ts`)
  - `name`, `description?`, `teacherId?`, `students?[]`, `price`

- `Attendance` (`src/attendance/schemas/attendance.schema.ts`)
  - `user` (ObjectId User), `date`, `status: 'present'|'absent'`

- `Finance` (`src/finance/schemas/finance.schema.ts`) — подготовлено к реализации, заполните под задачи (платежи, начисления, расходы).

Дополнительные сущности (домашка, оценки, расписание и др.) реализованы модулями и сервисами, обращайтесь к соответствующим файлам для детальной структуры.

## Аутентификация и авторизация

- Регистрация: `POST /auth/register` (валидируется DTO). По умолчанию допускаются роли `student` или `guest`. Пароль шифруется симметрично (не хэш!).
- Логин: `POST /auth/login` — проверка пользователя и сравнение пароля после расшифровки.
- JWT: выдается `token` и `role`. Используйте в заголовке `Authorization: Bearer <token>`.
- Профиль: `POST /auth/me` (JWT) — возвращает данные пользователя из токена.
- Доступ по ролям: используйте декоратор `@Roles(...)`. Глобальные guard’ы проверяют JWT и роль на каждом запросе.

Роли (`src/roles/roles.enum.ts`):

- `admin`, `owner`, `teacher`, `student`, `guest`, `extra` ("panda").

## Шифрование паролей

В проекте используется симметричное шифрование AES-256-CBC (`src/common/encryption.ts`).

- `encrypt(text: string): string` → `iv:hex:encrypted(hex)`
- `decrypt(text: string): string`
- Ключ вычисляется через `crypto.scryptSync(ENCRYPTION_SECRET, ENCRYPTION_SALT, 32)`.

Важно: это не безопасный способ хранения паролей для публичных сервисов (лучше bcrypt/argon2). Здесь сделано осознанно для функций Telegram/админских дешифровок. Если безопасность критична — замените на хэширование и измените логику сравнения.

## Интеграция с Telegram

Модуль: `src/telegram/telegram.service.ts`.

- Поддержка сценариев:
  - Старт/регистрация по номеру: `/start` с запросом контакта. Создается заявка, админ подтверждает/отклоняет.
  - Авторизация через бота: `/login` (username → пароль), привязка `telegramId` к пользователю.
  - Проверка статуса: `/check`.
  - Просмотр: `/homework`, `/grades`, `/attendance`, `/schedule` — ответы в чате.
  - Рассылки/уведомления: `/notify` (админ/преподаватель) с выбором типа и роли.

- Вебхук:
  - Приложение регистрирует webhook на `DOMAIN + '/bot'`.
  - `main.ts` включает: `app.use('/bot', bot.webhookCallback('/bot'))` и установку вебхука `setWebhook`.
  - Убедитесь, что `DOMAIN` доступен извне по HTTPS.

- Переменные: `TELEGRAM_BOT_TOKEN`, `ADMIN_CHAT_ID`, `DOMAIN` обязательны для корректной работы.

## CORS

В `src/main.ts` включен CORS со списком разрешенных доменов:

- `https://sultonoway.uz`
- `http://localhost:5173`
- `https://b.sultonoway.uz`
- `http://localhost:3000`

Настраивается в `app.enableCors({ origin, credentials, methods, allowedHeaders })`.

## Обработка ошибок и логирование

- Глобальный фильтр `AllExceptionsFilter` нормализует ответы об ошибках.
- Интерсептор `LoggingInterceptor` логирует вход/выход и время обработки.
- Кастомный `CustomValidationPipe` — для валидации DTO.

## API (обзор основных эндпоинтов)

Примеры. Полный контракт смотрите в контроллерах соответствующих модулей.

- Auth (`/auth`)
  - `POST /auth/register` — регистрация.
  - `POST /auth/login` — логин, ответ `{ token, role }`.
  - `POST /auth/me` — профиль по JWT.
  - `GET /auth/decrypt/:username` — для админа/owner, расшифровка пароля пользователя (для поддержки/восстановления).

- Users (`/users`) [JWT + роли]
  - `GET /users` — список пользователей (admin/extra/owner).
  - `GET /users/search?username|phone|telegramId` — поиск по одному из параметров.
  - `GET /users/students` — все студенты (admin/extra/owner/teacher).
  - `GET /users/:id` — получить пользователя.
  - `POST /users` — создать (admin/extra/owner).
  - `PUT /users/:id` — обновить (сам пользователь или admin).
  - `PATCH /users/:id/role` — смена роли (admin/extra/owner).
  - `DELETE /users/:id` — удалить (admin/extra/owner).
  - `GET /users/:id/password` — расшифровка пароля по id (admin/owner).

- Courses (`/courses`)
  - CRUD курсов, привязка преподавателя и студентов. См. контроллер/сервис.

- Attendance (`/attendance`)
  - Отметка посещаемости, получение истории для пользователя. См. контроллер/сервис.

- Grades/Homework/Schedule/Payments/Notifications/Statistics
  - Аналогично: эндпоинты и бизнес-логика в соответствующих модулях.

## Скрипты

- `pnpm run start` — запуск.
- `pnpm run start:dev` — dev-режим (watch).
- `pnpm run build` — сборка.
- `pnpm run start:prod` — запуск собранной версии.
- `pnpm run test` — тесты Jest.
- `pnpm run test:cov` — покрытие.
- `pnpm run lint` — ESLint + автофикс.

## Структура проекта (ключевое)

```
src/
  app.module.ts
  main.ts
  auth/
  users/
  courses/
  attendance/
  grades/
  homework/
  notifications/
  payments/
  schedule/
  telegram/
  common/ (guards, filters, pipes, decorators, encryption)
  config/ (validation, configuration)
```

Mongo схемы находятся в `*/schemas/*.schema.ts`. DTO — в `*/dto/*.dto.ts`.

## Деплой и эксплуатация

1) Настройте переменные окружения (.env) и доступ к MongoDB.
2) Проверьте CORS и домен (`DOMAIN`) для Telegram webhook (HTTPS обязателен).
3) Сборка: `pnpm run build`.
4) Запуск: `pnpm run start:prod` (процесс-менеджер: pm2/systemd/docker — на ваш выбор).
5) Логи: stdout/stderr, убедитесь, что видите успешную установку webhook.

Типовые проблемы:

- Неверный импорт `decrypt` (должен быть `from '../common/encryption'`, а не из `dotenv`).
- Пустой/неверный `JWT_SECRET`/`MONGO_URI` — приложение не стартует или падает на валидации.
- `TELEGRAM_BOT_TOKEN`/`DOMAIN` — без них бот не установит webhook.

## Roadmap / TODO

- Отчеты: убытки/прибыль/расходы, сводные панели для владельца/админа.
- Телеграм: доп. сценарии (замена учителя, статусы оплаты, массовые рассылки по группам/курсам).
- Метрики: сколько учеников у учителя, ЗП учителя, начисления/выплаты.
- Дашборды: сколько всего нужно получить от учеников, сколько уже получено (по курсам/учителям/периодам), сколько заплатить учителям.
- Перейти от симметричного шифрования к безопасному хэшированию паролей (bcrypt/argon2) + flow восстановления/сброса.

---

Если вы нашли неточность или хотите дополнить документацию — присылайте PR.
