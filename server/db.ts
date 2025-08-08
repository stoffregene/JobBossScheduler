import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

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
  db = drizzle(pool, { schema });
  console.log('Database connection established successfully');
} catch (error) {
  console.error('Failed to create database pool:', error);
  throw error;
}

export { pool, db };