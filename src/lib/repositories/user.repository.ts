/**
 * User Repository
 */

import { User } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { PostgresAdapter } from '../adapters/postgres.adapter';

export class UserRepository extends BaseRepository<User> {
  constructor(adapter: PostgresAdapter) {
    super(adapter);
  }

  async findById(id: string): Promise<User | null> {
    const client = (this.adapter as PostgresAdapter).getClient();
    return await client.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    const client = (this.adapter as PostgresAdapter).getClient();
    return await client.user.findUnique({ where: { email } });
  }

  async findMany(filter?: Partial<User>): Promise<User[]> {
    const client = (this.adapter as PostgresAdapter).getClient();
    const where = this.buildWhereClause(filter || {});
    return await client.user.findMany({ where });
  }

  async create(data: Partial<User>): Promise<User> {
    const client = (this.adapter as PostgresAdapter).getClient();
    return await client.user.create({
      data: data as any,
    });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    const client = (this.adapter as PostgresAdapter).getClient();
    return await client.user.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(id: string): Promise<void> {
    const client = (this.adapter as PostgresAdapter).getClient();
    await client.user.delete({ where: { id } });
  }

  async count(filter?: Partial<User>): Promise<number> {
    const client = (this.adapter as PostgresAdapter).getClient();
    const where = this.buildWhereClause(filter || {});
    return await client.user.count({ where });
  }

  async verifyEmail(id: string): Promise<User> {
    const client = (this.adapter as PostgresAdapter).getClient();
    return await client.user.update({
      where: { id },
      data: { emailVerified: true },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    const client = (this.adapter as PostgresAdapter).getClient();
    return await client.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user !== null;
  }
}
