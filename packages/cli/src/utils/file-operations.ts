/**
 * File operations utilities with atomic writes and transaction support
 */

import { promises as fsPromises } from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export interface FileOperation {
  path: string;
  content: string | object;
}

export interface TransactionResult {
  success: boolean;
  error?: Error;
  rolledBack?: boolean;
}

export class FileOperations {
  /**
   * Atomically write content to a file
   * Writes to a temporary file first, then renames to target
   */
  static async atomicWrite(filePath: string, content: string | object): Promise<void> {
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    try {
      await fsPromises.access(dir);
    } catch {
      await fsPromises.mkdir(dir, { recursive: true });
    }
    
    // Generate unique temporary file name
    const tmpFile = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    
    try {
      // Convert object to JSON if needed
      const data = typeof content === 'object' 
        ? JSON.stringify(content, null, 2) 
        : content;
      
      // Write to temporary file
      await fsPromises.writeFile(tmpFile, data, 'utf8');
      
      // Atomic rename (this is atomic on most filesystems)
      await fsPromises.rename(tmpFile, filePath);
    } catch (error) {
      // Clean up temporary file if it exists
      try {
        await fsPromises.unlink(tmpFile);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Execute multiple file operations as a transaction
   * Either all succeed or all are rolled back
   */
  static async transaction(operations: FileOperation[]): Promise<TransactionResult> {
    const backups = new Map<string, string>();
    const created = new Set<string>();
    
    try {
      // Phase 1: Create backups of existing files
      for (const op of operations) {
        try {
          await fsPromises.access(op.path);
          // File exists, create backup
          const backupPath = `${op.path}.backup.${Date.now()}`;
          await fsPromises.copyFile(op.path, backupPath);
          backups.set(op.path, backupPath);
        } catch {
          // File doesn't exist, will be created
          created.add(op.path);
        }
      }
      
      // Phase 2: Write all files
      for (const op of operations) {
        await this.atomicWrite(op.path, op.content);
      }
      
      // Phase 3: Clean up backups on success
      for (const backupPath of backups.values()) {
        try {
          await fsPromises.unlink(backupPath);
        } catch {
          // Ignore cleanup errors
        }
      }
      
      return { success: true };
    } catch (error) {
      // Rollback: Restore backups and remove created files
      for (const [originalPath, backupPath] of backups.entries()) {
        try {
          await fsPromises.copyFile(backupPath, originalPath);
          await fsPromises.unlink(backupPath);
        } catch (rollbackError) {
          console.error(`Failed to rollback ${originalPath}:`, rollbackError);
        }
      }
      
      // Remove files that were created in this transaction
      for (const createdPath of created) {
        try {
          await fsPromises.access(createdPath);
          await fsPromises.unlink(createdPath);
        } catch {
          // File might not have been created, ignore
        }
      }
      
      return { 
        success: false, 
        error: error as Error,
        rolledBack: true 
      };
    }
  }

  /**
   * Safely read a file with a default value
   */
  static async safeRead<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      const content = await fsPromises.readFile(filePath, 'utf8');
      
      // Try to parse as JSON if default value is an object
      if (typeof defaultValue === 'object' && defaultValue !== null) {
        try {
          return JSON.parse(content) as T;
        } catch {
          // If parsing fails, return default
          return defaultValue;
        }
      }
      
      return content as unknown as T;
    } catch (error) {
      // Return default value if file doesn't exist or can't be read
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Check if a file exists
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}