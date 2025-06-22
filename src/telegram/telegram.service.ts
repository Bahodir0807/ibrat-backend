import { Injectable, OnModuleInit, NotFoundException } from '@nestjs/common';
import { Telegraf, Context, Markup } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { PhoneRequestService } from '../phone-request/phone-request.service';
import { Document } from 'mongoose';
import { UserDocument } from '../users/schemas/user.schema';
import { HomeworkService } from '../homework/homework.service';
import { GradesService } from '../grades/grades.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ScheduleService } from '../schedule/schedule.service';
import { Role } from '../roles/roles.enum';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly bot: Telegraf<Context>;
  private readonly adminChatId: number;

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly phoneReq: PhoneRequestService,
    private readonly hw: HomeworkService,
    private readonly grades: GradesService,
    private readonly attendance: AttendanceService,
    private readonly schedule: ScheduleService,
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');
    this.adminChatId = parseInt(this.config.get<string>('ADMIN_CHAT_ID') || '0', 10);
    this.bot = new Telegraf(token);
  }

  getBot() {
    return this.bot;
  }

  onModuleInit() {
    this.setupBot();
  }

  private setupBot() {
    this.bot.start(ctx => this.sendStartMessage(ctx));
    this.bot.command('check', ctx => this.handleCheck(ctx));
    this.bot.command('homework', ctx => this.handleHomework(ctx));
    this.bot.command('grades', ctx => this.handleGrades(ctx));
    this.bot.command('attendance', ctx => this.handleAttendance(ctx));
    this.bot.command('schedule', ctx => this.handleSchedule(ctx));
    this.bot.on('contact', ctx => this.handleContact(ctx as any));
    this.bot.on('callback_query', ctx => this.handleCallback(ctx as any));
  }

  async sendMessage(userId: string, message: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.telegramId) {
      throw new NotFoundException('Пользователь не найден или не подключён к Telegram');
    }
    await this.bot.telegram.sendMessage(user.telegramId, message);
  }

  private async ensureUser(ctx: Context): Promise<UserDocument & Document> {
    const tgId = ctx.from?.id;
    if (!tgId) throw new Error('no-id');
    const user = await this.users.findByTelegramId(tgId);
    if (!user) throw new Error('no-user');
    return user;
  }

  private async sendStartMessage(ctx: Context) {
    await ctx.reply(
      'Привет! Нажми кнопку ниже, чтобы зарегистрироваться.',
      Markup.keyboard([[{ text: '📱 Отправить номер', request_contact: true }]])
        .resize()
        .oneTime(),
    );
  }

  private async handleCheck(ctx: Context) {
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

  private async handleContact(ctx: Context & {
    message: { contact: { phone_number: string; user_id: number; first_name: string } };
  }) {
    const { phone_number: phone, user_id: tgId, first_name: name } = ctx.message.contact;
    const existing = await this.phoneReq.getByTelegramId(String(tgId));
    if (existing && existing.status === 'pending') {
      return ctx.reply('Заявка уже отправлена, ожидайте.');
    }

    await this.phoneReq.create({ phone, name, telegramId: String(tgId) });

    const payload = JSON.stringify({ telegramId: String(tgId) });

    await ctx.telegram.sendMessage(
      this.adminChatId,
      `Новая заявка:\n${name}\n${phone}\nID: ${tgId}`,
      Markup.inlineKeyboard([
        Markup.button.callback('Принять', `approve:${payload}`),
        Markup.button.callback('Отклонить', `reject:${payload}`),
      ]),
    );

    await ctx.reply('Заявка отправлена! Напиши /check, чтобы узнать статус.');
  }

  private async handleCallback(ctx: Context & { callbackQuery: { data: string }; answerCbQuery: () => void }) {
    const [action, payloadStr] = ctx.callbackQuery.data.split(/:(.+)/);
    const payload = JSON.parse(payloadStr);
    const req = await this.phoneReq.getByTelegramId(payload.telegramId);

    if (!req) return ctx.answerCbQuery?.('Заявка не найдена');

    if (action === 'approve') {
      await this.users.createWithPhone({
        name: req.name,
        phone: req.phone,
        telegramId: parseInt(req.telegramId),
        role: Role.Student,
      });
      await this.phoneReq.handle({ requestId: req._id, status: 'approved' });
      await ctx.telegram.sendMessage(parseInt(req.telegramId), '✅ Вас зарегистрировали!');
      await ctx.answerCbQuery?.('Принято');
    } else {
      await this.phoneReq.handle({ requestId: req._id, status: 'rejected' });
      await ctx.telegram.sendMessage(parseInt(req.telegramId), '❌ Заявка отклонена.');
      await ctx.answerCbQuery?.('Отклонено');
    }
  }

  private async handleHomework(ctx: Context) {
    try {
      const user = await this.ensureUser(ctx);
      const list = await this.hw.getByUser(user._id.toString());
      if (!list.length) return ctx.reply('📭 Домашки нет.');
      return ctx.reply(
        list
          .map(h => `📅 ${new Date(h.date).toLocaleDateString()}\n📝 ${h.tasks.join(', ')}`)
          .join('\n\n'),
      );
    } catch (err) {
      return ctx.reply(err.message === 'no-user' ? '❌ Зарегистрируйтесь через /start' : 'Ошибка');
    }
  }

  private async handleGrades(ctx: Context) {
    try {
      const user = await this.ensureUser(ctx);
      const list = await this.grades.getByUser(user._id.toString());
      if (!list.length) return ctx.reply('📭 Оценок нет.');
      return ctx.reply(
        list
          .map(g => `📅 ${new Date(g.date).toLocaleDateString()} — ${g.subject}: ${g.score}`)
          .join('\n'),
      );
    } catch {
      return ctx.reply('❌ Зарегистрируйтесь через /start');
    }
  }

  private async handleAttendance(ctx: Context) {
    try {
      const user = await this.ensureUser(ctx) as UserDocument;
      const list = await this.attendance.getByUser(user._id);
      if (!list.length) return ctx.reply('📭 Посещаемость пустая.');
      return ctx.reply(
        list
          .map(a => `📅 ${new Date(a.date).toLocaleDateString()} — ${a.status === 'present' ? '✅' : '❌'}`)
          .join('\n'),
      );
    } catch {
      return ctx.reply('❌ Зарегистрируйтесь через /start');
    }
  }

  private async handleSchedule(ctx: Context) {
    try {
      const user = await this.ensureUser(ctx);
      const list = await this.schedule.getScheduleForUser(user._id.toString(), user.role);
      if (!list.length) return ctx.reply('📭 У вас пока нет расписания.');

      const formatted = list.map(s => {
        const day = new Date(s.date).toLocaleDateString();
        const start = new Date(s.timeStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = new Date(s.timeEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const course = typeof s.course === 'object' && 'title' in s.course ? s.course.title : 'Без названия';
        const teacher = typeof s.teacher === 'object' && 'name' in s.teacher ? s.teacher.name : 'Преподаватель';
        const group = typeof s.group === 'object' && 'name' in s.group ? s.group.name : 'Без группы';

        return `📅 ${day}\n📘 ${course}\n👨‍🏫 ${teacher}\n👥 Группа: ${group}\n🕒 ${start} - ${end}`;
      });

      return ctx.reply(formatted.join('\n\n'));
    } catch {
      return ctx.reply('❌ Не удалось получить расписание. Зарегистрируйтесь через /start');
    }
  }
}
