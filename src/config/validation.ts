import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().min(10).required(),
  MONGO_URI: Joi.string().uri().required(),
  TELEGRAM_BOT_TOKEN: Joi.string().min(10).optional(),
  ADMIN_CHAT_ID: Joi.alternatives()
    .try(Joi.number(), Joi.string().pattern(/^\d+$/))
    .optional(),
  DOMAIN: Joi.string().uri().optional(),
  CORS_ORIGINS: Joi.string().allow('').default(''),
});
