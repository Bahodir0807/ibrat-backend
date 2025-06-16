// src/telegram/telegram.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { Message, CallbackQuery } from 'telegraf/typings/core/types/typegram';
import { UsersService } from '../users/users.service';
import { Role } from '../roles/roles.enum';

// ID администратора, куда отправляются заявки
const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID || '0', 10);

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private usersService: UsersService,
  ) {
    this.bot.command('getid', ctx => {
      const chatId = ctx.chat?.id;
      ctx.reply(chatId ? `Ваш chat.id = ${chatId}` : 'Не удалось определить chat.id');
    });

    this.bot.start(ctx => this.handleStart(ctx));
    this.bot.on('text', ctx => this.handleStart(ctx));

    this.bot.on('contact', ctx => this.handleContact(ctx as Context & { message: Message.ContactMessage }));

    this.bot.on('callback_query', ctx => this.handleCallback(ctx));
  }

  private async handleStart(ctx: Context) {
    await ctx.reply('Привет! Нажми кнопку ниже, чтобы зарегистрироваться по номеру.', Markup.keyboard([
      [{ text: 'Зарегистрироваться', request_contact: true }]
    ]).resize().oneTime());
  }

  private async handleContact(ctx: Context & { message: Message.ContactMessage }) {
    const { phone_number: phone, first_name: name, user_id: tgId } = ctx.message.contact;
    if (!phone || !tgId) {
      await ctx.reply('Не удалось получить номер или Telegram ID.');
      return;
    }

    const payload = JSON.stringify({ phone, name, tgId });
    const text = `Новая заявка:
Имя: ${name}
Телефон: ${phone}
Telegram ID: ${tgId}`;
    try {
      if (ADMIN_CHAT_ID) {
        await ctx.telegram.sendMessage(
          ADMIN_CHAT_ID,
          text,
          Markup.inlineKeyboard([
            Markup.button.callback('Принять', `accept:${payload}`),
            Markup.button.callback('Отклонить', `reject:${payload}`),
          ])
        );
      }
      await ctx.reply('✅ Заявка отправлена администратору. Ожидайте ответа.');
      this.logger.log(`Registration requested: ${name} (${phone})`);
    } catch (err) {
      this.logger.error('Error sending registration to admin:', err);
      await ctx.reply('❌ Не удалось отправить заявку. Попробуйте позже.');
    }
  }

  private async handleCallback(ctx: Context & { callbackQuery: CallbackQuery }) {
    const cb = ctx.callbackQuery;
    if (!('data' in cb) || !cb.data) return;
    this.logger.log(`Callback query received: ${cb.data}`);
    const [action, payload] = cb.data.split(/:(.+)/);
    let data;
    try {
      data = JSON.parse(payload);
    } catch (err) {
      this.logger.error('Invalid callback payload:', err);
      return;
    }
    const { phone, name, tgId } = data as { phone: string; name: string; tgId: number };

    if (action === 'accept') {
      try {
        await this.usersService.createWithPhone({ name, phone, telegramId: tgId, role: Role.Student });
        await ctx.telegram.sendMessage(tgId, '✅ Ваша регистрация подтверждена!');
        await ctx.answerCbQuery('Пользователь принят');
      } catch (err) {
        this.logger.error('Error creating user:', err);
        await ctx.answerCbQuery('Ошибка при создании пользователя');
      }
    } else if (action === 'reject') {
      await ctx.telegram.sendMessage(tgId, '❌ Вашу заявку отклонили.');
      await ctx.answerCbQuery('Заявка отклонена');
    }
  }}
