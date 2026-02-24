if (!process.env.DATABASE_URL || !process.env.FRONTEND_URL) {
  throw new Error('Variables de entorno requeridas no encontradas');
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
};