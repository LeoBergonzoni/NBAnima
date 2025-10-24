import type { Database as GeneratedDatabase } from '../types/database';

export type Database = GeneratedDatabase;

type DatabaseTables = Database['public']['Tables'];

export type Tables<T extends keyof DatabaseTables> = DatabaseTables[T];

export type TablesRow<T extends keyof DatabaseTables> = Tables<T>['Row'];

export type TablesInsert<T extends keyof DatabaseTables> = Tables<T>['Insert'];

export type TablesUpdate<T extends keyof DatabaseTables> = Tables<T>['Update'];
