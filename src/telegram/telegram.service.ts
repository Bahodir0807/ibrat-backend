import {
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Telegraf, Context, Markup, session } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PhoneRequestService } from '../phone-request/phone-request.service';
import { HomeworkService } from '../homework/homework.service';
import { GradesService } from '../grades/grades.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ScheduleService } from '../schedule/schedule.service';
import { Role } from '../roles/roles.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-type.enum';
import { PublicUser } from '../users/types/public-user.type';

interface SessionData {
  step?: string;
  phone?: string;
  tgId?: number;
  firstName?: string;
  notificationType?: NotificationType;
  username?: string;
  isAuthenticated?: boolean;
  // temporary fields for notifications
  pendingMessage?: string;
  pendingRole?: Role;
}

interface BotContext extends Context {
  session: SessionData;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot?: Telegraf<BotContext>;
  private readonly adminChatId: number;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly phoneReq: PhoneRequestService,
    private readonly hw: HomeworkService,
    private readonly grades: GradesService,
    private readonly attendance: AttendanceService,
    private readonly schedule: ScheduleService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notify: NotificationsService,
  ) {
    const token = this.config.get<string>('telegramBotToken');
    this.adminChatId = Number(this.config.get<string>('adminChatId')) || 0;
    if (!token) {
      return;
    }

    this.bot = new Telegraf<BotContext>(token);
    this.bot.use(session());

    this.notify.onNotification(({ message, telegramIds }) => {
      telegramIds.forEach(id => {
        try {
          void this.sendTelegramMessageSafe(id, `📢 ${message}`);
        } catch (err) {
          this.logger.warn(`Failed to send notify to chat ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    });
  }

  getBot() {
    return this.bot;
  }

  onModuleInit() {
    if (!this.bot) {
      return;
    }

    this.setupBot();
    if (this.isWebhookMode()) {
      this.logger.log('Telegram bot initialized in webhook mode');
      return;
    }

    this.bot
      .launch()
      .then(() => this.logger.log('Telegram bot polling started'))
      .catch(error => {
        this.logger.error(
          'Failed to start Telegram polling',
          error instanceof Error ? error.stack : String(error),
        );
      });

    process.once('SIGINT', () => this.bot!.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot!.stop('SIGTERM'));
  }

  private isWebhookMode(): boolean {
    return Boolean(this.config.get<string>('domain'));
  }

  private setupBot() {
    if (!this.bot) {
      return;
    }

    this.bot.start(ctx => this.handleSafe(ctx, () => this.sendStartMessage(ctx)));
    this.bot.command('check', ctx => this.handleSafe(ctx, () => this.handleCheck(ctx)));
    this.bot.command('homework', ctx => this.handleSafe(ctx, () => this.handleHomework(ctx)));
    this.bot.command('grades', ctx => this.handleSafe(ctx, () => this.handleGrades(ctx)));
    this.bot.command('attendance', ctx => this.handleSafe(ctx, () => this.handleAttendance(ctx)));
    this.bot.command('schedule', ctx => this.handleSafe(ctx, () => this.handleSchedule(ctx)));
    this.bot.command('notify', ctx => this.handleSafe(ctx, () => this.setupNotifications(ctx)));
    this.bot.command('login', ctx => this.handleSafe(ctx, () => this.handleLogin(ctx)));
    this.bot.on('contact', ctx => this.handleSafe(ctx, () => this.handleContact(ctx)));
    this.bot.on('callback_query', ctx => this.handleSafe(ctx, () => this.handleCallback(ctx as any)));
    this.bot.on('message', ctx => this.handleSafe(ctx, () => this.handleMessage(ctx)));
  }

  private async handleLogin(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    if (ctx.session.isAuthenticated) {
      try {
        const user = await this.ensureUser(ctx);
        return ctx.reply(`✅ Вы уже авторизованы как ${user.username} (${user.role})`);
    } catch {
      ctx.session.isAuthenticated = false;
    }
  }
  ctx.session.step = 'login_username';
  await ctx.reply('🔐 Авторизация\n\nВведите ваш username:');
}

  private async handleSafe(ctx: BotContext, handler: () => Promise<any>) {
    try {
      await handler();
    } catch (e) {
      this.logger.error(
        'Telegram handler error',
        e instanceof Error ? e.stack : String(e),
      );
      try {
        await ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
      } catch {}
    }
  }

  private async sendTelegramMessageSafe(chatId: number, message: string) {
    if (!this.bot) {
      return;
    }

    try {
      await this.bot.telegram.sendMessage(chatId, message);
    } catch (error) {
      this.logger.warn(
        `Failed to send Telegram message to chat ${chatId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // ---------- Helpers ----------

  /**
   * Получить пользователя (plain User) по id. Используется для отправки сообщений.
   */
  async sendMessage(userId: string, message: string) {
    if (!this.bot) {
      return;
    }

    const user = await this.users.findById(userId).catch(() => null);
    if (!user || !user.telegramId) {
      throw new NotFoundException('Пользователь не найден или не подключён к Telegram');
    }
    await this.bot!.telegram.sendMessage(Number(user?.telegramId ?? userId), message);
  }

  /**
   * ensureUser возвращает plain User (как возвращает UsersService).
   * Если твой UsersService возвращает Mongoose document, этот метод всё равно будет работать,
   * т.к. мы работаем с полями user.username/user.role/user._id и т.д.
   */
  private async ensureUser(ctx: BotContext): Promise<PublicUser> {
    const tgId = ctx.from?.id;
    if (!tgId) {
      throw new UnauthorizedException('Telegram user id is missing');
    }
    const user = await this.users.findByTelegramId(tgId as number);
    if (!user) {
      throw new UnauthorizedException('Telegram account is not linked to a user');
    }
    return user;
  }

  // ---------- Core flows ----------

  private async sendStartMessage(ctx: BotContext) {
    await ctx.reply(
      'Привет! Нажми кнопку ниже, чтобы зарегистрироваться через номер телефона. 👇',
      Markup.keyboard([[{ text: '📱 Отправить номер', request_contact: true }]]).resize().oneTime(),
    );
  }

  private async handleCheck(ctx: BotContext) {
    const tgId = ctx.from?.id;
    if (!tgId) return ctx.reply('Не удалось получить ID Telegram');

    const user = await this.users.findByTelegramId(tgId as number);
    if (user) {
      return ctx.reply('🎉 Вы зарегистрированы! Команды: /homework /grades /attendance /schedule');
    }

    const req = await this.phoneReq.getByTelegramId(String(tgId));
    if (!req) return ctx.reply('Вы не отправляли заявку.');
    if (req.status === 'pending') return ctx.reply('Заявка в обработке. Ждите.');
    if (req.status === 'rejected') return ctx.reply('К сожалению, вас отклонили.');
    return ctx.reply('Произошла ошибка. Свяжитесь с админом.');
  }

  private async handleContact(ctx: BotContext & { message: any }) {
    const contact = ctx.message.contact;
    if (!contact) return ctx.reply('Не удалось получить контакт.');
    const { phone_number: phone, user_id: tgId, first_name: firstName } = contact;

    if (!ctx.session) ctx.session = {};
    ctx.session = { step: 'ask_name', phone, tgId, firstName };

    await ctx.reply(
      `📛 Ваш номер: ${phone}. Хочешь использовать имя Telegram (${firstName}) или ввести своё?`,
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Telegram', 'use_telegram_name'),
        Markup.button.callback('✍️ Ввести своё', 'write_name'),
      ])
    );
  }

  private async handleCallback(ctx: BotContext & any) {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    await ctx.answerCbQuery().catch(() => {});

    if (!ctx.session) ctx.session = {};

    if (data === 'write_name') {
      ctx.session.step = 'enter_name';
      return ctx.reply('✍️ Введите своё имя:');
    }

    if (data === 'use_telegram_name') {
      const { tgId, phone, firstName } = ctx.session;
      if (!tgId || !phone || !firstName) {
        return ctx.reply('❌ Ошибка сессии. Попробуйте начать заново /start');
      }

      if (!this.adminChatId) {
        this.logger.warn('Phone request skipped because ADMIN_CHAT_ID is not configured');
        return ctx.reply('❌ Регистрация временно недоступна. Свяжитесь с администратором.');
      }

      const req = await this.phoneReq.create({ phone, name: firstName, telegramId: String(tgId) });

      await ctx.telegram.sendMessage(
        this.adminChatId,
        `🔔 Новая заявка!\n📱 Телефон: ${phone}\n👤 Имя: ${firstName}\n🆔 ${req._id}`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Принять', `approve:${req._id}`),
          Markup.button.callback('❌ Отклонить', `reject:${req._id}`),
        ])
      );

      await ctx.reply(`✅ Заявка отправлена. Использовано имя: ${firstName}\n📝 /check`);
      ctx.session = {};
      return;
    }

    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      const [action, reqId] = data.split(':');
      const req = await this.phoneReq.getById(reqId);
      if (!req) return ctx.answerCbQuery('❌ Заявка не найдена');

      if (action === 'approve') {
        await this.users.createWithPhone({
          name: req.name,
          phone: req.phone,
          telegramId: Number(req.telegramId),
          role: Role.Student,
        });
        await this.phoneReq.handle({ requestId: req._id, status: 'approved' });
        await ctx.editMessageText(`✅ Заявка ${reqId} принята`);
        await this.bot!.telegram.sendMessage(Number(req.telegramId), '🎉 Ваша заявка принята!');
      } else {
        await this.phoneReq.handle({ requestId: req._id, status: 'rejected' });
        await ctx.editMessageText(`❌ Заявка ${reqId} отклонена`);
        await this.bot!.telegram.sendMessage(Number(req.telegramId), '❌ Ваша заявка отклонена');
      }

      return ctx.answerCbQuery().catch(() => {});
    }

    if (data.startsWith('notify:')) {
      // delegate to notification handler
      return this.handleNotificationCallback(ctx as any);
    }
  }

  private async handleMessage(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    const session = ctx.session;
    const message = ctx.message;
    if (!message) return;
    if (!('text' in message)) return;

    const text = (message as any).text?.trim();
    if (!text) return;

    // LOGIN flow
    if (session?.step === 'login_username') {
      if (!text) return ctx.reply('❌ Username не может быть пустым. Попробуйте снова.');
      ctx.session.username = text;
      ctx.session.step = 'login_password';
      return ctx.reply('🔑 Введите ваш пароль:');
    }

    if (session?.step === 'login_password') {
      if (!text) return ctx.reply('❌ Пароль не может быть пустым. Попробуйте снова.');
      const username = session.username;
      if (!username) return ctx.reply('❌ Ошибка сессии. Попробуйте начать заново /login');

      try {
        const user = await this.users.findByUsername(username);
        if (!user) {
          ctx.session = {};
          return ctx.reply('❌ Пользователь не найден.');
        }

        const authUser = await this.users.findByUsernameForAuth(username);
        const ok = authUser
          ? await this.users.verifyPassword(authUser.password, text)
          : false;

        if (!ok) {
          ctx.session = {};
          return ctx.reply('❌ Неверный пароль.');
        }

        // link telegram id to user
        const tgId = ctx.from?.id;
        if (tgId) {
          const id = (user as any)._id || (user as any).id || (user as any).username;
          // Try to update by id if we have it
          if (id) {
            await this.users.update(String(id), { telegramId: String(tgId) } as any).catch(err => {
              this.logger.warn(
                `Failed to set telegramId for user ${id}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              );
            });
          }
        }

        ctx.session.isAuthenticated = true;
        ctx.session.step = undefined;
        return ctx.reply(`✅ Успешная авторизация!\nДобро пожаловать, ${user.username} (${user.role})`);
      } catch (err) {
        this.logger.error(
          'Telegram login error',
          err instanceof Error ? err.stack : String(err),
        );
        ctx.session = {};
        return ctx.reply('❌ Ошибка при авторизации. Попробуйте снова.');
      }
    }

    // enter_name flow (manual name entry after contact)
    if (session?.step === 'enter_name') {
      if (!text) return ctx.reply('❌ Имя не может быть пустым. Попробуйте снова.');
      const { tgId, phone } = session;
      if (!tgId || !phone) return ctx.reply('❌ Ошибка сессии. Попробуйте начать заново /start');

      if (!this.adminChatId) {
        this.logger.warn('Phone request skipped because ADMIN_CHAT_ID is not configured');
        return ctx.reply('❌ Регистрация временно недоступна. Свяжитесь с администратором.');
      }

      const req = await this.phoneReq.create({ phone, name: text, telegramId: String(tgId) });

      await this.bot!.telegram.sendMessage(
        this.adminChatId,
        `🔔 Новая заявка!\n📱 Телефон: ${phone}\n👤 Имя: ${text}\n🆔 ${req._id}`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Принять', callback_data: `approve:${req._id}` },
                { text: '❌ Отклонить', callback_data: `reject:${req._id}` }
              ]
            ]
          }
        }
      );

      await ctx.reply(`✅ Заявка отправлена. Использовано имя: ${text}\n📝 /check`);
      ctx.session = {};
      return;
    }

    // Notification sending flows (admin/teacher)
    if (session?.step === 'send_admin_notify' || session?.step === 'send_teacher_notify') {
      // admin: choose role then send; teacher: send to own students
      const pendingType = session.notificationType;
      if (!pendingType) {
        ctx.session = {};
        return ctx.reply('❌ Ошибка сессии. Попробуйте /notify заново.');
      }

      // store message for next step if admin needs to choose role
      if (session.step === 'send_admin_notify' && !session.pendingRole) {
        // admin sent message; ask to choose role
        ctx.session.pendingMessage = text;
        // ask role selection
        await ctx.reply('Выберите роль, которой отправить уведомление:', Markup.inlineKeyboard([
          [Markup.button.callback('Ученикам', 'notifyRole:student')],
          [Markup.button.callback('Учителям', 'notifyRole:teacher')],
          [Markup.button.callback('Админам', 'notifyRole:admin')],
          [Markup.button.callback('Panda', 'notifyRole:panda')],
        ]));
        ctx.session.step = 'choose_role_for_notify';
        return;
      }

      if (session.step === 'send_teacher_notify') {
        // teacher: send to their students (we'll assume that teachers have groups or relationships; fallback: broadcast to students)
        const user = await this.ensureUser(ctx);
        // send to students (simple approach: all students)
        const students = await this.users.findByRole(Role.Student);
        const telegramIds = students.filter(s => (s as any).telegramId).map(s => (s as any).telegramId as number);
        telegramIds.forEach(id => {
          void this.sendTelegramMessageSafe(id, `📝 [Домашка]\n${text}`);
        });
        ctx.session = {};
        return ctx.reply(`✅ Уведомление отправлено ${telegramIds.length} ученикам.`);
      }
    }

    // default
    return ctx.reply('Извините, но я не понимаю эту команду. Пожалуйста, используйте /homework, /grades, /attendance или /schedule.');
  }

  // ---------- More handlers (homework / grades / attendance / schedule) ----------

  private async finishRegistration(telegramId: string, phone: string, name: string) {
    const req = await this.phoneReq.getByTelegramId(telegramId);
    if (!req) throw new NotFoundException('Заявка не найдена');

    await this.phoneReq.updateName(req._id, name);
    await this.users.createWithPhone({ name, phone, telegramId: Number(telegramId), role: Role.Student });
    await this.phoneReq.handle({ requestId: req._id, status: 'approved' });
  }

  private async handleHomework(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.hw.getByUser((user as any)._id.toString());
    if (!list || !list.length) return ctx.reply('📭 Домашки нет.');

    return ctx.reply(
      list.map(h => `📅 ${new Date(h.date).toLocaleDateString('ru-RU')}\n📝 ${Array.isArray(h.tasks) ? h.tasks.join(', ') : h.tasks}`).join('\n\n'),
    );
  }

  private async handleGrades(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.grades.getByUser((user as any)._id.toString());
    if (!list || !list.length) return ctx.reply('📭 Оценок нет.');

    return ctx.reply(
      list.map(g => `📅 ${new Date(g.date).toLocaleDateString('ru-RU')} — ${g.subject}: ${g.score}`).join('\n'),
    );
  }

  private async handleAttendance(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.attendance.getByUser((user as any)._id);
    if (!list || !list.length) return ctx.reply('📭 Посещаемость пустая.');

    return ctx.reply(
      list.map(a => `📅 ${new Date(a.date).toLocaleDateString('ru-RU')} — ${a.status === 'present' ? '✅' : '❌'}`).join('\n'),
    );
  }

  private async handleSchedule(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.schedule.getScheduleForUser((user as any)._id.toString(), (user as any).role);
    if (!list || !list.length) return ctx.reply('📭 У вас пока нет расписания.');

    const formatted = list.map(s => {
      const day = new Date(s.date).toLocaleDateString('ru-RU');
      const start = new Date(s.timeStart).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const end = new Date(s.timeEnd).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const course = typeof s.course === 'object' && 'title' in s.course ? s.course.title : 'Без названия';
      const teacher = typeof s.teacher === 'object' && 'name' in s.teacher ? s.teacher.name : 'Преподаватель';
      const group = typeof s.group === 'object' && 'name' in s.group ? s.group.name : 'Без группы';

      return `📅 ${day}\n📘 ${course}\n👨‍🏫 ${teacher}\n👥 Группа: ${group}\n🕒 ${start} - ${end}`;
    });

    return ctx.reply(formatted.join('\n\n'));
  }

  private async setupNotifications(ctx: BotContext) {
    const user = await this.ensureUser(ctx);

    if (!user || ![Role.Admin, Role.Teacher].includes((user as any).role)) {
      return ctx.reply('❌ У вас нет прав на отправку уведомлений.');
    }

    await ctx.reply(
      'Выберите тип уведомления:',
      Markup.inlineKeyboard([
        [Markup.button.callback('💰 Оплата', 'notify:PAYMENT')],
        [Markup.button.callback('📝 Домашка', 'notify:HOMEWORK')],
        [Markup.button.callback('📊 Оценки', 'notify:GRADES')],
        [Markup.button.callback('📅 Посещаемость', 'notify:ATTENDANCE')],
        [Markup.button.callback('📢 Общие', 'notify:GENERAL')],
      ])
    );
  }

  private async handleNotificationCallback(ctx: BotContext & any) {
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    await ctx.answerCbQuery().catch(() => {});

    const user = await this.ensureUser(ctx);
    if (!user || ![Role.Admin, Role.Teacher].includes((user as any).role)) {
      return ctx.reply('❌ У вас нет прав.');
    }

    if (data.startsWith('notify:')) {
      const type = data.split(':')[1] as NotificationType;

      if ((user as any).role === Role.Admin) {
        ctx.session.step = 'send_admin_notify';
        ctx.session.notificationType = type;
        return ctx.reply('Введите текст уведомления и затем выберите роль (через кнопку).');
      }

      if ((user as any).role === Role.Teacher) {
        ctx.session.step = 'send_teacher_notify';
        ctx.session.notificationType = type;
        return ctx.reply('Введите текст уведомления для ваших учеников:');
      }
    }

    if (data.startsWith('notifyRole:')) {
      // admin selected role for previously stored pending message
      const roleStr = data.split(':')[1];
      const roleMap: Record<string, Role> = {
        student: Role.Student,
        teacher: Role.Teacher,
        admin: Role.Admin,
        panda: Role.Extra,
      };
      const role = roleMap[roleStr] || Role.Student;

      const msg = ctx.session.pendingMessage;
      if (!msg) return ctx.reply('❌ Нет сообщения в сессии. Начните /notify заново.');

      const targets = await this.users.findByRole(role);
      const telegramIds = targets.filter(t => (t as any).telegramId).map(t => (t as any).telegramId as number);
      telegramIds.forEach(id => void this.sendTelegramMessageSafe(id, `📢 ${msg}`));

      ctx.session = {};
      return ctx.reply(`✅ Уведомление отправлено ${telegramIds.length} пользователям роли ${role}.`);
    }
  }
}
