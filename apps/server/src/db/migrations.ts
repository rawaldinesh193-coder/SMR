import { pool } from './connection.js';

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email VARCHAR(255) UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          device_name VARCHAR(255) NOT NULL,
          model VARCHAR(255) NOT NULL,
          android_version VARCHAR(50) NOT NULL,
          fingerprint VARCHAR(255) UNIQUE NOT NULL,
          is_trusted BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS pairing_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
          pairing_code VARCHAR(12) NOT NULL,
          pairing_token VARCHAR(255) UNIQUE NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_pairing_token ON pairing_sessions(pairing_token);
      CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairing_sessions(pairing_code);

      CREATE TABLE IF NOT EXISTS connection_sessions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
          desktop_client_info JSONB NOT NULL,
          session_token VARCHAR(512) UNIQUE NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
          started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP WITH TIME ZONE,
          last_ping_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_events (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
          event_type VARCHAR(100) NOT NULL,
          ip_address VARCHAR(45),
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('[Database] PostgreSQL schema migrations completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Database] Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}
