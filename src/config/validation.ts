import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().min(10).required(),
  MONGO_URI: Joi.string().uri().required(),
});
