import * as Joi from 'joi';

export default () => {
  const schema = Joi.object({
    PORT: Joi.number().default(3000),
    JWT_SECRET: Joi.string().min(10).required(),
    MONGO_URI: Joi.string().uri().required(),
  });

  const { error, value: envVars } = schema.validate(process.env, {
    abortEarly: false,
    allowUnknown: true,
  });

  if (error) {
    throw new Error(`Config validation error: ${error.message}`);
  }

  return {
    port: envVars.PORT,
    jwtSecret: envVars.JWT_SECRET,
    dbUri: envVars.MONGO_URI,
  };
};
