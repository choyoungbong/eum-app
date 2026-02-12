/**
 * PostgreSQL Adapter Implementation
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseAdapter } from './database.adapter';
import prisma from '../db';

export class PostgresAdapter implements DatabaseAdapter {
  private client: PrismaClient;
  private connected: boolean = false;

  constructor(client?: PrismaClient) {
    this.client = client || prisma;
    this.connected = true;
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    const result = await this.client.\<T[]>(sql, ...(params || []));
    return result;
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async execute(sql: string, params?: any[]): Promise<{ affectedRows: number }> {
    const result = await this.client.\(sql, ...(params || []));
    return { affectedRows: result };
  }

  async transaction<T>(callback: (adapter: DatabaseAdapter) => Promise<T>): Promise<T> {
    return await this.client.\(async (tx) => {
      const txAdapter = new PostgresAdapter(tx as PrismaClient);
      return await callback(txAdapter);
    });
  }

  async connect(): Promise<void> {
    await this.client.\();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.client.\();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getClient(): PrismaClient {
    return this.client;
  }
}

export const postgresAdapter = new PostgresAdapter();
