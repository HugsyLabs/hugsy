import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Setup mocks before importing the module
vi.mock('child_process');
vi.mock('open');
vi.mock('../src/utils/logger.js');

import { uiCommand } from '../src/commands/ui.js';
import { spawn } from 'child_process';
import open from 'open';
import { logger } from '../src/utils/logger.js';

describe('UI Command', () => {
  const mockSpawn = vi.mocked(spawn);
  const mockOpen = vi.mocked(open);
  const mockLogger = vi.mocked(logger);

  interface MockProcess {
    on: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    stdout: { on: ReturnType<typeof vi.fn> };
    stderr: { on: ReturnType<typeof vi.fn> };
  }

  let mockProcess: MockProcess;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create a mock process
    mockProcess = {
      on: vi.fn(),
      kill: vi.fn(),
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
    };

    mockSpawn.mockReturnValue(mockProcess as unknown as ReturnType<typeof spawn>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create UI command with correct configuration', () => {
    const command = uiCommand();

    expect(command.name()).toBe('ui');
    expect(command.description()).toBe('Launch the Hugsy web UI');

    const options = command.options;
    expect(options).toHaveLength(2);

    // Check port option
    const portOption = options.find((opt) => opt.flags === '-p, --port <port>');
    expect(portOption).toBeDefined();
    expect(portOption?.description).toBe('Port to run the UI on');
    expect(portOption?.defaultValue).toBe('3456');

    // Check no-open option
    const noOpenOption = options.find((opt) => opt.flags === '-n, --no-open');
    expect(noOpenOption).toBeDefined();
    expect(noOpenOption?.description).toBe("Don't open browser automatically");
  });

  it('should launch UI server with spawn', () => {
    const command = uiCommand();

    // Parse and execute the command
    command.parse(['node', 'test', '--port', '3456']);

    // Check spawn was called
    expect(mockSpawn).toHaveBeenCalled();
    expect(mockSpawn).toHaveBeenCalledWith(
      'npm',
      ['run', 'dev', '--', '--port', '3456'],
      expect.objectContaining({
        stdio: 'inherit',
        shell: true,
      })
    );
  });

  it('should launch UI server with custom port', () => {
    const command = uiCommand();

    // Parse and execute the command with custom port
    command.parse(['node', 'test', '--port', '8080']);

    // Check spawn was called with custom port
    expect(mockSpawn).toHaveBeenCalledWith(
      'npm',
      ['run', 'dev', '--', '--port', '8080'],
      expect.objectContaining({
        stdio: 'inherit',
        shell: true,
      })
    );
  });

  it('should not open browser when --no-open is specified', () => {
    vi.useFakeTimers();

    const command = uiCommand();

    // Parse and execute with no-open option
    command.parse(['node', 'test', '--no-open']);

    // Fast-forward time
    vi.advanceTimersByTime(3000);

    // Check that open was not called
    expect(mockOpen).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should open browser after delay by default', () => {
    vi.useFakeTimers();

    const command = uiCommand();

    // Parse and execute without no-open option
    command.parse(['node', 'test']);

    // Fast-forward time
    vi.advanceTimersByTime(2000);

    // Check that open was called
    expect(mockOpen).toHaveBeenCalledWith('http://localhost:3456');
    expect(mockLogger).toHaveProperty('success');
    expect(mockLogger).toHaveProperty('info');
    const successCalls = (mockLogger.success as ReturnType<typeof vi.fn>).mock.calls;
    const infoCalls = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls;
    expect(successCalls).toContainEqual(['UI server running at http://localhost:3456']);
    expect(infoCalls).toContainEqual(['Opening browser...']);

    vi.useRealTimers();
  });

  it('should handle process errors', () => {
    const originalExit = process.exit.bind(process);
    const exitMock = vi.fn<[number?], never>();
    process.exit = exitMock as typeof process.exit;

    const command = uiCommand();

    // Parse and execute
    command.parse(['node', 'test']);

    // Get the error handler
    const errorHandler = mockProcess.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'error'
    )?.[1] as ((error: Error) => void) | undefined;

    expect(errorHandler).toBeDefined();

    // Simulate an error
    const testError = new Error('Failed to start');
    if (errorHandler) {
      errorHandler(testError);
    }

    // Check error was logged and process exited
    expect(mockLogger).toHaveProperty('error');
    const errorCalls = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls;
    expect(errorCalls).toContainEqual(['Failed to start UI server: Failed to start']);
    expect(exitMock).toHaveBeenCalledWith(1);

    // Restore
    process.exit = originalExit;
  });

  it('should handle process termination signals', () => {
    const originalExit = process.exit.bind(process);
    const exitMock = vi.fn<[number?], never>();
    process.exit = exitMock as typeof process.exit;

    // Create a spy for process.on
    const processOnSpy = vi.spyOn(process, 'on');

    const command = uiCommand();

    // Parse and execute
    command.parse(['node', 'test']);

    // Find SIGINT handler
    const sigintCall = processOnSpy.mock.calls.find((call) => call[0] === 'SIGINT');
    const sigintHandler = sigintCall?.[1] as (() => void) | undefined;

    expect(sigintHandler).toBeDefined();

    // Call the SIGINT handler
    if (sigintHandler) {
      sigintHandler();
    }

    // Check that process was killed
    expect(mockProcess.kill).toHaveBeenCalled();
    expect(exitMock).toHaveBeenCalledWith(0);

    // Restore
    process.exit = originalExit;
    processOnSpy.mockRestore();
  });
});
