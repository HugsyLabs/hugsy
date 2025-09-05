import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Compiler } from '../src/compiler/index.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

describe('Subagents Compilation', () => {
  const testDir = join(
    import.meta.url.replace('file://', '').replace(/\/[^/]+$/, ''),
    'test-temp-subagents'
  );

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should compile subagents from config', async () => {
    const config: HugsyConfig = {
      subagents: {
        agents: {
          'code-reviewer': {
            name: 'code-reviewer',
            description: 'Reviews code for quality and best practices',
            tools: ['Read', 'Grep'],
            content: 'You are a code review expert. Focus on code quality and best practices.',
          },
          'test-writer': 'You are a test writing expert. Write comprehensive tests.',
        },
      },
    };

    const compiler = new Compiler({ projectRoot: testDir });
    await compiler.compile(config);

    const subagents = compiler.getCompiledSubagents();
    expect(subagents.size).toBe(2);

    const codeReviewer = subagents.get('code-reviewer');
    expect(codeReviewer).toBeDefined();
    expect(codeReviewer?.name).toBe('code-reviewer');
    expect(codeReviewer?.description).toBe('Reviews code for quality and best practices');
    expect(codeReviewer?.tools).toEqual(['Read', 'Grep']);
    expect(codeReviewer?.content).toContain('code review expert');

    const testWriter = subagents.get('test-writer');
    expect(testWriter).toBeDefined();
    expect(testWriter?.name).toBe('test-writer');
    expect(testWriter?.content).toContain('test writing expert');
  });

  it('should load subagents from files', async () => {
    // Create a subagent file
    const subagentsDir = join(testDir, 'subagents');
    mkdirSync(subagentsDir, { recursive: true });

    const subagentContent = `---
description: Security analysis specialist
tools:
  - Read
  - Grep
  - Bash
---

You are a security analysis specialist. Your role is to:
1. Identify potential security vulnerabilities
2. Suggest secure coding practices
3. Review authentication and authorization logic`;

    writeFileSync(join(subagentsDir, 'security-analyst.md'), subagentContent);

    const config: HugsyConfig = {
      subagents: {
        files: ['./subagents/*.md'],
      },
    };

    const compiler = new Compiler({ projectRoot: testDir });
    await compiler.compile(config);

    const subagents = compiler.getCompiledSubagents();
    expect(subagents.size).toBe(1);

    const securityAnalyst = subagents.get('security-analyst');
    expect(securityAnalyst).toBeDefined();
    expect(securityAnalyst?.description).toBe('Security analysis specialist');
    expect(securityAnalyst?.tools).toEqual(['Read', 'Grep', 'Bash']);
    expect(securityAnalyst?.content).toContain('security analysis specialist');
  });

  it('should merge subagents from presets', async () => {
    // Create a preset with subagents
    const presetsDir = join(testDir, 'presets');
    mkdirSync(presetsDir, { recursive: true });

    const preset = {
      subagents: {
        agents: {
          'docs-writer': {
            name: 'docs-writer',
            description: 'Documentation specialist',
            content: 'You are a documentation expert.',
          },
        },
      },
    };

    writeFileSync(join(presetsDir, 'test-preset.json'), JSON.stringify(preset, null, 2));

    const config: HugsyConfig = {
      extends: './presets/test-preset.json',
      subagents: {
        agents: {
          'api-designer': {
            name: 'api-designer',
            description: 'API design specialist',
            content: 'You are an API design expert.',
          },
        },
      },
    };

    const compiler = new Compiler({ projectRoot: testDir });
    await compiler.compile(config);

    const subagents = compiler.getCompiledSubagents();
    expect(subagents.size).toBe(2);

    // Check preset subagent
    const docsWriter = subagents.get('docs-writer');
    expect(docsWriter).toBeDefined();
    expect(docsWriter?.description).toBe('Documentation specialist');

    // Check user subagent
    const apiDesigner = subagents.get('api-designer');
    expect(apiDesigner).toBeDefined();
    expect(apiDesigner?.description).toBe('API design specialist');
  });

  it('should handle subagent overrides', async () => {
    // Create a preset with a subagent
    const presetsDir = join(testDir, 'presets');
    mkdirSync(presetsDir, { recursive: true });

    const preset = {
      subagents: {
        agents: {
          optimizer: {
            name: 'optimizer',
            description: 'Basic optimizer',
            content: 'You optimize code.',
          },
        },
      },
    };

    writeFileSync(join(presetsDir, 'base.json'), JSON.stringify(preset, null, 2));

    const config: HugsyConfig = {
      extends: './presets/base.json',
      subagents: {
        agents: {
          optimizer: {
            name: 'optimizer',
            description: 'Advanced performance optimizer',
            tools: ['Read', 'Write', 'Bash'],
            content: 'You are an advanced performance optimization specialist.',
          },
        },
      },
    };

    const compiler = new Compiler({ projectRoot: testDir });
    await compiler.compile(config);

    const subagents = compiler.getCompiledSubagents();
    expect(subagents.size).toBe(1);

    // Check that user config overrides preset
    const optimizer = subagents.get('optimizer');
    expect(optimizer).toBeDefined();
    expect(optimizer?.description).toBe('Advanced performance optimizer');
    expect(optimizer?.tools).toEqual(['Read', 'Write', 'Bash']);
    expect(optimizer?.content).toContain('advanced performance optimization');
  });

  it('should handle empty subagents config', async () => {
    const config: HugsyConfig = {
      subagents: {},
    };

    const compiler = new Compiler({ projectRoot: testDir });
    await compiler.compile(config);

    const subagents = compiler.getCompiledSubagents();
    expect(subagents.size).toBe(0);
  });

  it('should handle missing subagent files gracefully', async () => {
    const config: HugsyConfig = {
      subagents: {
        files: ['./non-existent/*.md'],
      },
    };

    const compiler = new Compiler({ projectRoot: testDir });
    await compiler.compile(config);

    const subagents = compiler.getCompiledSubagents();
    expect(subagents.size).toBe(0);
  });

  it('should validate subagent structure', async () => {
    const config: HugsyConfig = {
      subagents: {
        agents: {
          'valid-agent': {
            name: 'valid-agent',
            description: 'Valid agent',
            content: 'Valid content',
          },
          // This should be processed as a string content
          'simple-agent': 'Simple agent content',
        },
      },
    };

    const compiler = new Compiler({ projectRoot: testDir });
    await compiler.compile(config);

    const subagents = compiler.getCompiledSubagents();
    expect(subagents.size).toBe(2);

    const validAgent = subagents.get('valid-agent');
    expect(validAgent?.name).toBe('valid-agent');

    const simpleAgent = subagents.get('simple-agent');
    expect(simpleAgent?.name).toBe('simple-agent');
    expect(simpleAgent?.content).toBe('Simple agent content');
  });
});
