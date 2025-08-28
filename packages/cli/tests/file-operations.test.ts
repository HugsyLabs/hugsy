import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { FileOperations } from '../src/utils/file-operations';
import type { FileOperation } from '../src/utils/file-operations';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rmdir);

const TEST_DIR = path.join(tmpdir(), 'hugsy-test-file-ops-' + Date.now());

describe('FileOperations', () => {
  beforeEach(async () => {
    // Create test directory
    try {
      await mkdir(TEST_DIR, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      const files = await promisify(fs.readdir)(TEST_DIR);
      for (const file of files) {
        await unlink(path.join(TEST_DIR, file));
      }
      await rmdir(TEST_DIR);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('atomicWrite', () => {
    it('should write content atomically', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      const content = 'Hello, World!';
      
      await FileOperations.atomicWrite(filePath, content);
      
      const result = await readFile(filePath, 'utf8');
      expect(result).toBe(content);
    });

    it('should write JSON objects', async () => {
      const filePath = path.join(TEST_DIR, 'test.json');
      const content = { name: 'test', value: 42 };
      
      await FileOperations.atomicWrite(filePath, content);
      
      const result = await readFile(filePath, 'utf8');
      expect(JSON.parse(result)).toEqual(content);
    });

    it('should clean up temp file on error', async () => {
      const filePath = path.join(TEST_DIR, 'test.txt');
      
      // Mock fsPromises.rename to throw error
      const renameSpy = vi.spyOn(fsPromises, 'rename').mockRejectedValue(
        new Error('Mock rename error')
      );
      
      await expect(FileOperations.atomicWrite(filePath, 'content')).rejects.toThrow('Mock rename error');
      
      // Check that temp files are cleaned up
      const files = await promisify(fs.readdir)(TEST_DIR);
      const tempFiles = files.filter(f => f.includes('.tmp'));
      expect(tempFiles.length).toBe(0);
      
      renameSpy.mockRestore();
    });

    it('should create directory if it does not exist', async () => {
      const filePath = path.join(TEST_DIR, 'subdir', 'test.txt');
      const content = 'Created in subdir';
      
      await FileOperations.atomicWrite(filePath, content);
      
      const result = await readFile(filePath, 'utf8');
      expect(result).toBe(content);
    });
  });

  describe('transaction', () => {
    it('should execute all operations successfully', async () => {
      const operations: FileOperation[] = [
        { path: path.join(TEST_DIR, 'file1.txt'), content: 'Content 1' },
        { path: path.join(TEST_DIR, 'file2.txt'), content: 'Content 2' },
        { path: path.join(TEST_DIR, 'file3.json'), content: { test: true } },
      ];
      
      const result = await FileOperations.transaction(operations);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      
      // Verify all files were created
      for (const op of operations) {
        const content = await readFile(op.path, 'utf8');
        if (typeof op.content === 'object') {
          expect(JSON.parse(content)).toEqual(op.content);
        } else {
          expect(content).toBe(op.content);
        }
      }
    });

    it('should rollback all operations on failure', async () => {
      // Create an existing file
      const existingPath = path.join(TEST_DIR, 'existing.txt');
      await writeFile(existingPath, 'Original content');
      
      const operations: FileOperation[] = [
        { path: existingPath, content: 'Modified content' },
        { path: path.join(TEST_DIR, 'new.txt'), content: 'New file' },
        { path: '/invalid/path/that/will/fail.txt', content: 'Will fail' },
      ];
      
      const result = await FileOperations.transaction(operations);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.rolledBack).toBe(true);
      
      // Verify existing file was restored
      const existingContent = await readFile(existingPath, 'utf8');
      expect(existingContent).toBe('Original content');
      
      // Verify new file was not created
      const newFileExists = await FileOperations.exists(path.join(TEST_DIR, 'new.txt'));
      expect(newFileExists).toBe(false);
    });

    it('should handle partial failures correctly', async () => {
      const file1Path = path.join(TEST_DIR, 'file1.txt');
      const file2Path = path.join(TEST_DIR, 'file2.txt');
      
      // Pre-create file1
      await writeFile(file1Path, 'Original 1');
      
      const operations: FileOperation[] = [
        { path: file1Path, content: 'Updated 1' },
        { path: file2Path, content: 'New 2' },
      ];
      
      // Mock atomicWrite to fail on second call
      let callCount = 0;
      const originalAtomicWrite = FileOperations.atomicWrite.bind(FileOperations);
      const atomicWriteSpy = vi.spyOn(FileOperations, 'atomicWrite').mockImplementation(async (path, content) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Mock write error');
        }
        return originalAtomicWrite(path, content);
      });
      
      const result = await FileOperations.transaction(operations);
      
      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);
      
      // File1 should be restored to original
      const file1Content = await readFile(file1Path, 'utf8');
      expect(file1Content).toBe('Original 1');
      
      // File2 should not exist
      const file2Exists = await FileOperations.exists(file2Path);
      expect(file2Exists).toBe(false);
      
      atomicWriteSpy.mockRestore();
    });

    it('should clean up backup files on success', async () => {
      const filePath = path.join(TEST_DIR, 'file.txt');
      await writeFile(filePath, 'Original');
      
      const operations: FileOperation[] = [
        { path: filePath, content: 'Updated' },
      ];
      
      const result = await FileOperations.transaction(operations);
      expect(result.success).toBe(true);
      
      // Check no backup files remain
      const files = await promisify(fs.readdir)(TEST_DIR);
      const backupFiles = files.filter(f => f.includes('.backup.'));
      expect(backupFiles.length).toBe(0);
    });
  });

  describe('safeRead', () => {
    it('should read existing file', async () => {
      const filePath = path.join(TEST_DIR, 'read.txt');
      await writeFile(filePath, 'Test content');
      
      const result = await FileOperations.safeRead(filePath, 'default');
      expect(result).toBe('Test content');
    });

    it('should return default value for non-existent file', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');
      
      const result = await FileOperations.safeRead(filePath, 'default value');
      expect(result).toBe('default value');
    });

    it('should parse JSON when default is object', async () => {
      const filePath = path.join(TEST_DIR, 'data.json');
      const data = { name: 'test', value: 123 };
      await writeFile(filePath, JSON.stringify(data));
      
      const result = await FileOperations.safeRead(filePath, {});
      expect(result).toEqual(data);
    });

    it('should return default for invalid JSON', async () => {
      const filePath = path.join(TEST_DIR, 'invalid.json');
      await writeFile(filePath, 'not valid json');
      
      const defaultValue = { default: true };
      const result = await FileOperations.safeRead(filePath, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('should throw error for read errors other than ENOENT', async () => {
      const filePath = path.join(TEST_DIR, 'file.txt');
      await writeFile(filePath, 'content');
      
      // Mock fsPromises.readFile to throw non-ENOENT error
      const readFileSpy = vi.spyOn(fsPromises, 'readFile').mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );
      
      await expect(FileOperations.safeRead(filePath, 'default')).rejects.toThrow('Permission denied');
      
      readFileSpy.mockRestore();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = path.join(TEST_DIR, 'exists.txt');
      await writeFile(filePath, 'content');
      
      const result = await FileOperations.exists(filePath);
      expect(result).toBe(true);
    });

    it('should return false for non-existent file', async () => {
      const filePath = path.join(TEST_DIR, 'notexists.txt');
      
      const result = await FileOperations.exists(filePath);
      expect(result).toBe(false);
    });
  });
});