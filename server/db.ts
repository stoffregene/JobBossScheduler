import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { WebSocket } from 'ws';
import * as schema from "@shared/schema";

// Configure WebSocket for Neon serverless in Node.js environment
neonConfig.webSocketConstructor = WebSocket;

// Try to use direct connection if WebSocket fails
try {
  neonConfig.webSocketConstructor = WebSocket;
} catch (error) {
  console.log('WebSocket configuration failed, using direct connection');
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Log the database URL (without password for security)
const dbUrl = process.env.DATABASE_URL;
const maskedUrl = dbUrl ? dbUrl.replace(/:([^:@]+)@/, ':****@') : 'undefined';
console.log('Database URL:', maskedUrl);

// Create pool with retry logic
let pool: Pool;
let db: any;

try {
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
  console.log('Database connection established successfully');
} catch (error) {
  console.error('Failed to create database pool:', error);
  throw error;
}

export { pool, db };