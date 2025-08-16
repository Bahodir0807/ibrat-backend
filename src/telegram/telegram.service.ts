import { Injectable, OnModuleInit, NotFoundException, forwardRef, Inject } from '@nestjs/common';
import { Telegraf, Context, Markup, session } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PhoneRequestService } from '../phone-request/phone-request.service';
import { UserDocument } from '../users/schemas/user.schema';
import { HomeworkService } from '../homework/homework.service';
import { GradesService } from '../grades/grades.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ScheduleService } from '../schedule/schedule.service';
import { Role } from '../roles/roles.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification-type.enum';
import { Document } from 'mongoose';
import { CallbackQuery, Message, Update } from 'telegraf/typings/core/types/typegram';
import { Context as TelegrafContext } from 'telegraf';

interface SessionData {
  step?: string;
  phone?: string;
  tgId?: number;
  firstName?: string;
  notificationType?: NotificationType;
  username?: string;
  isAuthenticated?: boolean;
}

interface BotContext extends TelegrafContext {
  session: SessionData;
}

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly bot: Telegraf<BotContext>;
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
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

    this.adminChatId = Number(this.config.get<string>('ADMIN_CHAT_ID')) || 0;
    this.bot = new Telegraf<BotContext>(token);
    this.bot.use(session());

    this.notify.onNotification(({ message, telegramIds }) => {
      telegramIds.forEach(id => {
        this.bot.telegram.sendMessage(id, `📢 ${message}`);
      });
    });
  }

  getBot() {
    return this.bot;
  }

  onModuleInit() {
    this.setupBot();
    this.bot.launch();

    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  private setupBot() {
    this.bot.start(ctx => this.sendStartMessage(ctx));
    this.bot.command('check', ctx => this.handleSafe(ctx, () => this.handleCheck(ctx)));
    this.bot.command('homework', ctx => this.handleSafe(ctx, () => this.handleHomework(ctx)));
    this.bot.command('grades', ctx => this.handleSafe(ctx, () => this.handleGrades(ctx)));
    this.bot.command('attendance', ctx => this.handleSafe(ctx, () => this.handleAttendance(ctx)));
    this.bot.command('schedule', ctx => this.handleSafe(ctx, () => this.handleSchedule(ctx)));
    this.bot.command('notify', ctx => this.handleSafe(ctx, () => this.setupNotifications(ctx)));
    this.bot.command('login', ctx => this.handleSafe(ctx, () => this.handleLogin(ctx)));
    this.bot.on('contact', ctx => this.handleSafe(ctx, () => this.handleContact(ctx)));
    this.bot.on('callback_query', ctx => this.handleSafe(ctx, () => this.handleCallback(ctx as BotContext & { callbackQuery: { data: string; }; answerCbQuery: (text?: string | undefined) => void; })))
    this.bot.on('message', ctx => this.handleSafe(ctx, () => this.handleMessage(ctx)));
  }

  private async handleSafe(ctx: BotContext, handler: () => Promise<any>) {
    try {
      await handler();
    } catch (e) {
      console.error(e);
      ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
    }
  }

  async sendMessage(userId: string, message: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.telegramId) {
      throw new NotFoundException('Пользователь не найден или не подключён к Telegram');
    }
    await this.bot.telegram.sendMessage(user.telegramId, message);
  }

  private async ensureUser(ctx: BotContext): Promise<UserDocument & Document> {
    const tgId = ctx.from?.id;
    if (!tgId) throw new Error('no-id');
    const user = await this.users.findByTelegramId(tgId);
    if (!user) throw new Error('no-user');
    return user;
  }

  private async sendStartMessage(ctx: BotContext) {
    await ctx.reply(
      'Привет! Нажми кнопку ниже, чтобы зарегистрироваться через номер телефона. 👇',
      Markup.keyboard([[{ text: '📱 Отправить номер', request_contact: true }]]).resize().oneTime(),
    );
  }

  private async handleCheck(ctx: BotContext) {
    const tgId = ctx.from?.id;
    if (!tgId) return ctx.reply('Не удалось получить ID Telegram');
  
    const user = await this.users.findByTelegramId(tgId);
    if (user) {
      return ctx.reply('🎉 Вы зарегистрированы! Команды: /homework /grades /attendance /schedule');
    }
  
    const req = await this.phoneReq.getByTelegramId(String(tgId));
    if (!req) return ctx.reply('Вы не отправляли заявку.');
    if (req.status === 'pending') return ctx.reply('Заявка в обработке. Ждите.');
    if (req.status === 'rejected') return ctx.reply('К сожалению, вас отклонили.');
  
    return ctx.reply('Произошла ошибка. Свяжитесь с админом.');
  }

  private async handleContact(ctx: BotContext & { message: Message.ContactMessage }) {
    const { phone_number: phone, user_id: tgId, first_name: firstName } = ctx.message.contact;
    ctx.session = { step: 'ask_name', phone, tgId, firstName };
    await ctx.reply(
      `📛 Ваш номер: ${phone}. Хочешь использовать имя Telegram (${firstName}) или ввести своё?`,
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Telegram', 'use_telegram_name'),
        Markup.button.callback('✍️ Ввести своё', 'write_name'),
      ]),
    );
  }

  private async handleCallback(
    ctx: BotContext & { callbackQuery: { data: string }; answerCbQuery: (text?: string) => void },
  ) {
    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();
  
    console.log('⚡ Callback data:', data); 
  
    if (data === 'write_name') {
      ctx.session.step = 'enter_name';
      return ctx.reply('✍️ Введите своё имя:');
    }
  
    if (data === 'use_telegram_name') {
      const { tgId, phone, firstName } = ctx.session;
      if (!tgId || !phone || !firstName) {
        return ctx.reply('❌ Ошибка сессии. Попробуйте начать заново /start');
      }
  
      const req = await this.phoneReq.create({ phone, name: firstName, telegramId: String(tgId) });
  
      await ctx.telegram.sendMessage(
        this.adminChatId,
        `🔔 Новая заявка!
        📱 Телефон: ${phone}
        👤 Имя: ${firstName}
        🆔 ${req._id}`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Принять', `approve:${req._id}`),
          Markup.button.callback('❌ Отклонить', `reject:${req._id}`),
        ])
      );
  
      await ctx.reply(`✅ Заявка отправлена. Использовано имя: ${firstName}
  
  📝 Команда для проверки статуса заявки: /check
  `);
      ctx.session = {};
      return;
    }
  
    if (data.startsWith('notify:')) {
      return this.handleNotificationCallback(ctx);
    }

    if (data.startsWith('approve:') || data.startsWith('reject:')) {
      const [action, reqId] = data.split(':');
      const req = await this.phoneReq.getByTelegramId(reqId); 
  
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
        await this.bot.telegram.sendMessage(Number(req.telegramId), '✅ Ваша заявка одобрена');
      } else {
        await this.phoneReq.handle({ requestId: req._id, status: 'rejected' });
        await ctx.editMessageText(`❌ Заявка ${reqId} отклонена`);
        await this.bot.telegram.sendMessage(Number(req.telegramId), '❌ Ваша заявка отклонена');
      }
  
      return ctx.answerCbQuery();
    }
  }

  private async handleMessage(ctx: BotContext) {
    const session = ctx.session;
    const message = ctx.message;

    if (!message || !('text' in message)) {
      return;
    }

    const text = message.text.trim();
    
    if (session?.step === 'login_username') {
      if (!text) {
        return ctx.reply('❌ Username не может быть пустым. Попробуйте снова.');
      }
      
      ctx.session.username = text;
      ctx.session.step = 'login_password';
      return ctx.reply('🔑 Введите ваш пароль:');
    }

    if (session?.step === 'login_password') {
      if (!text) {
        return ctx.reply('❌ Пароль не может быть пустым. Попробуйте снова.');
      }

      const { username } = session;
      if (!username) {
        return ctx.reply('❌ Ошибка сессии. Попробуйте начать заново /login');
      }

      try {
        // Проверяем пароль через UsersService
        const user = await this.users.findByUsername(username);
        if (!user) {
          ctx.session = {};
          return ctx.reply('❌ Пользователь не найден.');
        }

        const decryptedPassword = this.users.decryptPassword(user.password);
        if (decryptedPassword !== text) {
          ctx.session = {};
          return ctx.reply('❌ Неверный пароль.');
        }

        // Связываем Telegram ID с пользователем
        const tgId = ctx.from?.id;
        if (tgId && 'id' in user) {
          await this.users.update((user as any).id || (user as any)._id, { telegramId: String(tgId) });
        }

        ctx.session.isAuthenticated = true;
        ctx.session.step = undefined;
        
        await ctx.reply(`✅ Успешная авторизация!\nДобро пожаловать, ${user.username} (${user.role})`);
        return;
      } catch (error) {
        ctx.session = {};
        return ctx.reply('❌ Ошибка при авторизации. Попробуйте снова.');
      }
    }

    if (session?.step === 'enter_name') {
      if (!text) {
        return ctx.reply('❌ Имя не может быть пустым. Попробуйте снова.');
      }
      
      const { tgId, phone } = session;
      if (!tgId || !phone) {
        return ctx.reply('❌ Ошибка сессии. Попробуйте начать заново /start');
      }

      const req = await this.phoneReq.create({ phone, name: text, telegramId: String(tgId) });
      
      if (!ctx.from?.id) {
        throw new Error('❌ Не удалось получить Telegram ID пользователя');
      }
      

      await ctx.telegram.sendMessage(
        this.adminChatId,
        `🔔 Новая заявка!
      📱 Телефон: ${phone}
      👤 Имя: ${text}
      🆔 ${req._id}`,
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
      
      
      

      await ctx.reply(`✅ Заявка отправлена. Использовано имя: ${text}
      
      📝 Заявка отправлена, проверьте статус с помощью: /check
      `);
      ctx.session = {};
      return;
    }

    await ctx.reply('Извините, но я не понимаю эту команду. Пожалуйста, используйте /homework, /grades, /attendance или /schedule.');
  }

  private async finishRegistration(telegramId: string, phone: string, name: string) {
    const req = await this.phoneReq.getByTelegramId(telegramId);
    if (!req) throw new NotFoundException('Заявка не найдена');

    await this.phoneReq.updateName(req._id, name);
    await this.users.createWithPhone({ name, phone, telegramId: Number(telegramId), role: Role.Student });
    await this.phoneReq.handle({ requestId: req._id, status: 'approved' });
  }

  private async handleHomework(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.hw.getByUser(user._id.toString());
    if (!list.length) return ctx.reply('📭 Домашки нет.');

    return ctx.reply(
      list.map(h => `📅 ${new Date(h.date).toLocaleDateString('ru-RU')}
📝 ${h.tasks.join(', ')}`).join('\n\n'),
    );
  }

  private async handleGrades(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.grades.getByUser(user._id.toString());
    if (!list.length) return ctx.reply('📭 Оценок нет.');

    return ctx.reply(
      list.map(g => `📅 ${new Date(g.date).toLocaleDateString('ru-RU')} — ${g.subject}: ${g.score}`).join('\n'),
    );
  }

  private async handleAttendance(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.attendance.getByUser(user._id);
    if (!list.length) return ctx.reply('📭 Посещаемость пустая.');

    return ctx.reply(
      list.map(a => `📅 ${new Date(a.date).toLocaleDateString('ru-RU')} — ${a.status === 'present' ? '✅' : '❌'}`).join('\n'),
    );
  }

  private async handleSchedule(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const list = await this.schedule.getScheduleForUser(user._id.toString(), user.role);
    if (!list.length) return ctx.reply('📭 У вас пока нет расписания.');

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

    if (![Role.Admin, Role.Teacher].includes(user.role)) {
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

  private async handleNotificationCallback(
    ctx: BotContext & { callbackQuery: { data: string }; answerCbQuery: (text?: string) => void },
  ) {
    const data = ctx.callbackQuery.data;
    await ctx.answerCbQuery();

    const user = await this.ensureUser(ctx);
    if (![Role.Admin, Role.Teacher].includes(user.role)) return ctx.reply('❌ У вас нет прав.');

    if (data.startsWith('notify:')) {
      const type = data.split(':')[1] as NotificationType;

      if (user.role === Role.Admin) {
        ctx.session.step = 'send_admin_notify';
        ctx.session.notificationType = type;
        return ctx.reply('Введите текст уведомления и выберите роль после этого:');
      }

      if (user.role === Role.Teacher) {
        ctx.session.step = 'send_teacher_notify';
        ctx.session.notificationType = type;
        return ctx.reply('Введите текст уведомления для ваших учеников:');
      }
    }
  }

  private async handleLogin(ctx: BotContext) {
    // Проверяем, уже авторизован ли пользователь
    if (ctx.session.isAuthenticated) {
      try {
        const user = await this.ensureUser(ctx);
        return ctx.reply(`✅ Вы уже авторизованы как ${user.username} (${user.role})`);
      } catch (e) {
        ctx.session.isAuthenticated = false;
      }
    }

    // Начинаем процесс авторизации
    ctx.session.step = 'login_username';
    await ctx.reply('🔐 Авторизация\n\nВведите ваш username:');
  }
}