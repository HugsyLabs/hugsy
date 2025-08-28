import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from '../src/dependency-graph';
import type { CycleError } from '../src/dependency-graph';
import type { HugsyConfig } from '@hugsylabs/hugsy-types';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe('detectCycles', () => {
    it('should detect simple cycle: A -> B -> A', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'B'],
        ['B', 'A'],
      ]);

      const error = graph.detectCycles(dependencies);
      
      expect(error).not.toBeNull();
      expect(error?.cycle).toContain('A');
      expect(error?.cycle).toContain('B');
      expect(error?.message).toContain('Circular dependency detected');
    });

    it('should detect complex cycle: A -> B -> C -> A', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ]);

      const error = graph.detectCycles(dependencies);
      
      expect(error).not.toBeNull();
      expect(error?.cycle).toEqual(['A', 'B', 'C', 'A']);
      expect(error?.path).toBe('A -> B -> C -> A');
    });

    it('should detect self-reference: A -> A', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'A'],
      ]);

      const error = graph.detectCycles(dependencies);
      
      expect(error).not.toBeNull();
      expect(error?.cycle).toEqual(['A', 'A']);
      expect(error?.message).toContain('A -> A');
    });

    it('should return null for acyclic graph', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'B'],
        ['B', 'C'],
        ['D', 'E'],
      ]);

      const error = graph.detectCycles(dependencies);
      
      expect(error).toBeNull();
    });

    it('should handle multiple dependencies per node', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', ['B', 'C']],
        ['B', 'D'],
        ['C', 'D'],
        ['D', 'E'],
      ]);

      const error = graph.detectCycles(dependencies);
      
      expect(error).toBeNull();
    });

    it('should detect cycle with multiple dependencies', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', ['B', 'C']],
        ['B', 'D'],
        ['C', 'E'],
        ['D', 'F'],
        ['F', 'A'], // Creates cycle
      ]);

      const error = graph.detectCycles(dependencies);
      
      expect(error).not.toBeNull();
      expect(error?.cycle).toContain('A');
      expect(error?.cycle).toContain('F');
    });

    it('should detect cycle in disconnected graph', () => {
      const dependencies = new Map<string, string | string[]>([
        // First component (no cycle)
        ['A', 'B'],
        ['B', 'C'],
        // Second component (has cycle)
        ['D', 'E'],
        ['E', 'F'],
        ['F', 'D'],
      ]);

      const error = graph.detectCycles(dependencies);
      
      expect(error).not.toBeNull();
      expect(error?.cycle).toContain('D');
      expect(error?.cycle).toContain('E');
      expect(error?.cycle).toContain('F');
    });

    it('should handle empty dependencies', () => {
      const dependencies = new Map<string, string | string[]>();

      const error = graph.detectCycles(dependencies);
      
      expect(error).toBeNull();
    });
  });

  describe('getLoadOrder', () => {
    it('should return correct load order for acyclic graph', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'B'],
        ['B', 'C'],
        ['D', 'C'],
      ]);

      const order = graph.getLoadOrder(dependencies);
      
      expect(order).not.toBeNull();
      expect(order).toHaveLength(4);
      
      // C should come before B and D
      const cIndex = order!.indexOf('C');
      const bIndex = order!.indexOf('B');
      const dIndex = order!.indexOf('D');
      
      expect(cIndex).toBeLessThan(bIndex);
      expect(cIndex).toBeLessThan(dIndex);
      
      // B should come before A
      const aIndex = order!.indexOf('A');
      expect(bIndex).toBeLessThan(aIndex);
    });

    it('should return null for cyclic graph', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ]);

      const order = graph.getLoadOrder(dependencies);
      
      expect(order).toBeNull();
    });

    it('should handle multiple roots', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'C'],
        ['B', 'C'],
        ['C', 'D'],
      ]);

      const order = graph.getLoadOrder(dependencies);
      
      expect(order).not.toBeNull();
      expect(order).toHaveLength(4);
      
      // D should come first
      expect(order![0]).toBe('D');
      
      // C should come before A and B
      const cIndex = order!.indexOf('C');
      const aIndex = order!.indexOf('A');
      const bIndex = order!.indexOf('B');
      
      expect(cIndex).toBeLessThan(aIndex);
      expect(cIndex).toBeLessThan(bIndex);
    });

    it('should handle isolated nodes', () => {
      const dependencies = new Map<string, string | string[]>([
        ['A', 'B'],
        ['C', []], // C has no dependencies
        ['D', []], // D has no dependencies
      ]);

      const order = graph.getLoadOrder(dependencies);
      
      expect(order).not.toBeNull();
      expect(order).toHaveLength(4);
      expect(order).toContain('A');
      expect(order).toContain('B');
      expect(order).toContain('C');
      expect(order).toContain('D');
      
      // B should come before A
      const bIndex = order!.indexOf('B');
      const aIndex = order!.indexOf('A');
      expect(bIndex).toBeLessThan(aIndex);
    });

    it('should handle empty graph', () => {
      const dependencies = new Map<string, string | string[]>();

      const order = graph.getLoadOrder(dependencies);
      
      expect(order).not.toBeNull();
      expect(order).toHaveLength(0);
    });
  });

  describe('detectConfigCycles', () => {
    it('should detect cycles in HugsyConfig extends', () => {
      const configs = new Map<string, HugsyConfig>([
        ['config1', { extends: 'config2', permissions: { allow: [] } }],
        ['config2', { extends: 'config3', permissions: { allow: [] } }],
        ['config3', { extends: 'config1', permissions: { allow: [] } }],
      ]);

      const error = DependencyGraph.detectConfigCycles('config1', configs);
      
      expect(error).not.toBeNull();
      expect(error?.message).toContain('Circular dependency detected in presets');
      expect(error?.cycle).toContain('config1');
      expect(error?.cycle).toContain('config2');
      expect(error?.cycle).toContain('config3');
    });

    it('should handle array of extends', () => {
      const configs = new Map<string, HugsyConfig>([
        ['config1', { extends: ['config2', 'config3'], permissions: { allow: [] } }],
        ['config2', { permissions: { allow: [] } }],
        ['config3', { extends: 'config1', permissions: { allow: [] } }],
      ]);

      const error = DependencyGraph.detectConfigCycles('config1', configs);
      
      expect(error).not.toBeNull();
      expect(error?.cycle).toContain('config1');
      expect(error?.cycle).toContain('config3');
    });

    it('should return null for valid config', () => {
      const configs = new Map<string, HugsyConfig>([
        ['config1', { extends: 'config2', permissions: { allow: [] } }],
        ['config2', { extends: 'config3', permissions: { allow: [] } }],
        ['config3', { permissions: { allow: [] } }],
      ]);

      const error = DependencyGraph.detectConfigCycles('config1', configs);
      
      expect(error).toBeNull();
    });

    it('should handle configs without extends', () => {
      const configs = new Map<string, HugsyConfig>([
        ['config1', { permissions: { allow: [] } }],
      ]);

      const error = DependencyGraph.detectConfigCycles('config1', configs);
      
      expect(error).toBeNull();
    });
  });

  describe('formatCycleError', () => {
    it('should format cycle error for user display', () => {
      const error: CycleError = {
        message: 'Circular dependency detected: A -> B -> C -> A',
        cycle: ['A', 'B', 'C', 'A'],
        path: 'A -> B -> C -> A',
      };

      const formatted = DependencyGraph.formatCycleError(error);
      
      expect(formatted).toContain('❌ Circular dependency detected!');
      expect(formatted).toContain('Dependency chain:');
      expect(formatted).toContain('1. A → B');
      expect(formatted).toContain('2. B → C');
      expect(formatted).toContain('3. C → A');
      expect(formatted).toContain('To fix this issue:');
      expect(formatted).toContain('Remove the extends reference from C to A');
    });

    it('should handle self-reference', () => {
      const error: CycleError = {
        message: 'Circular dependency detected: A -> A',
        cycle: ['A', 'A'],
        path: 'A -> A',
      };

      const formatted = DependencyGraph.formatCycleError(error);
      
      expect(formatted).toContain('❌ Circular dependency detected!');
      expect(formatted).toContain('1. A → A');
      expect(formatted).toContain('Remove the extends reference from A to A');
    });

    it('should provide helpful suggestions', () => {
      const error: CycleError = {
        message: 'Circular dependency detected',
        cycle: ['preset1', 'preset2', 'preset1'],
        path: 'preset1 -> preset2 -> preset1',
      };

      const formatted = DependencyGraph.formatCycleError(error);
      
      expect(formatted).toContain('Remove the extends reference from preset2 to preset1');
      expect(formatted).toContain('Or restructure your presets to avoid circular dependencies');
    });
  });
});