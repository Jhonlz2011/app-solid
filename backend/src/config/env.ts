if (!process.env.DATABASE_URL || !process.env.JWT_SECRET || !process.env.FRONTEND_URL) {
  throw new Error('Variables de entorno requeridas no encontradas');
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
  // Redis configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  REDIS_SOCKET_PATH: process.env.REDIS_SOCKET_PATH, // Optional Unix socket
  // Unix socket for server (production optimization)
  UNIX_SOCKET_PATH: process.env.UNIX_SOCKET_PATH,
};