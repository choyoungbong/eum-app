/**
 * Base Repository
 */

import { DatabaseAdapter } from '../adapters/database.adapter';

export interface IRepository<T> {
  findById(id: string): Promise<T | null>;
  findMany(filter?: Partial<T>): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(filter?: Partial<T>): Promise<number>;
}

export abstract class BaseRepository<T extends { id: string }> implements IRepository<T> {
  constructor(protected adapter: DatabaseAdapter) {}

  abstract findById(id: string): Promise<T | null>;
  abstract findMany(filter?: Partial<T>): Promise<T[]>;
  abstract create(data: Partial<T>): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T>;
  abstract delete(id: string): Promise<void>;
  abstract count(filter?: Partial<T>): Promise<number>;

  protected buildPaginationParams(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    return { skip, take: limit };
  }

  protected buildWhereClause(filter: Partial<T>): any {
    const where: any = {};
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    });
    return where;
  }
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
