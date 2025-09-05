/**
 * Dependency graph utilities for detecting circular dependencies
 */

import type { HugsyConfig } from '@hugsylabs/hugsy-types';

export interface CycleError {
  message: string;
  cycle: string[];
  path: string;
}

export class DependencyGraph {
  private adjacencyList = new Map<string, Set<string>>();
  private visiting = new Set<string>();
  private visited = new Set<string>();
  private cycleDetected: CycleError | null = null;

  /**
   * Build dependency graph from config
   */
  private buildGraph(dependencies: Map<string, string | string[]>): void {
    this.adjacencyList.clear();

    for (const [node, deps] of dependencies) {
      if (!this.adjacencyList.has(node)) {
        this.adjacencyList.set(node, new Set());
      }

      const depList = Array.isArray(deps) ? deps : [deps];
      for (const dep of depList) {
        this.adjacencyList.get(node)?.add(dep);

        // Ensure all nodes exist in the graph
        if (!this.adjacencyList.has(dep)) {
          this.adjacencyList.set(dep, new Set());
        }
      }
    }
  }

  /**
   * Detect cycles in the dependency graph using DFS
   */
  detectCycles(dependencies: Map<string, string | string[]>): CycleError | null {
    this.buildGraph(dependencies);
    this.visiting.clear();
    this.visited.clear();
    this.cycleDetected = null;

    for (const node of this.adjacencyList.keys()) {
      if (!this.visited.has(node)) {
        const path: string[] = [];
        this.dfs(node, path);

        if (this.cycleDetected) {
          return this.cycleDetected;
        }
      }
    }

    return null;
  }

  /**
   * DFS traversal to detect cycles
   */
  private dfs(node: string, path: string[]): boolean {
    if (this.visiting.has(node)) {
      // Found a cycle
      const cycleStartIndex = path.indexOf(node);
      const cycle = path.slice(cycleStartIndex).concat(node);

      this.cycleDetected = {
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        cycle,
        path: cycle.join(' -> '),
      };
      return true;
    }

    if (this.visited.has(node)) {
      return false;
    }

    this.visiting.add(node);
    path.push(node);

    const neighbors = this.adjacencyList.get(node) ?? new Set();
    for (const neighbor of neighbors) {
      if (this.dfs(neighbor, [...path])) {
        return true;
      }
    }

    path.pop();
    this.visiting.delete(node);
    this.visited.add(node);

    return false;
  }

  /**
   * Get load order using topological sort
   * Returns null if there's a cycle
   * The order is such that dependencies come before their dependents
   */
  getLoadOrder(dependencies: Map<string, string | string[]>): string[] | null {
    // First check for cycles
    if (this.detectCycles(dependencies)) {
      return null;
    }

    // Build reverse graph for topological sort (if A depends on B, we need B before A)
    const reverseGraph = new Map<string, Set<string>>();
    const allNodes = new Set<string>();

    for (const [node, deps] of dependencies) {
      allNodes.add(node);
      if (!reverseGraph.has(node)) {
        reverseGraph.set(node, new Set());
      }

      const depList = Array.isArray(deps) ? deps : deps ? [deps] : [];
      for (const dep of depList) {
        allNodes.add(dep);
        if (!reverseGraph.has(dep)) {
          reverseGraph.set(dep, new Set());
        }
        // Add edge from dependency to dependent
        reverseGraph.get(dep)?.add(node);
      }
    }

    // Calculate in-degree for each node (number of dependencies)
    const inDegree = new Map<string, number>();
    for (const node of allNodes) {
      inDegree.set(node, 0);
    }

    for (const [node, deps] of dependencies) {
      const depList = Array.isArray(deps) ? deps : deps ? [deps] : [];
      inDegree.set(node, depList.length);
    }

    // Find nodes with no dependencies
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    const result: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);

      // Process all nodes that depend on this node
      const dependents = reverseGraph.get(node) ?? new Set();
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);

        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    // If not all nodes were processed, there's a cycle
    if (result.length !== allNodes.size) {
      return null;
    }

    return result;
  }

  /**
   * Static helper to detect cycles in HugsyConfig
   */
  static detectConfigCycles(
    configPath: string,
    configs: Map<string, HugsyConfig>,
    visited = new Set<string>()
  ): CycleError | null {
    if (visited.has(configPath)) {
      const cycle = Array.from(visited).concat(configPath);
      return {
        message: `Circular dependency detected in presets: ${cycle.join(' -> ')}`,
        cycle,
        path: cycle.join(' -> '),
      };
    }

    visited.add(configPath);
    const config = configs.get(configPath);

    if (config?.extends) {
      const extendsList = Array.isArray(config.extends) ? config.extends : [config.extends];

      for (const extend of extendsList) {
        const error = this.detectConfigCycles(extend, configs, new Set(visited));
        if (error) {
          return error;
        }
      }
    }

    return null;
  }

  /**
   * Format cycle error for user-friendly display
   */
  static formatCycleError(error: CycleError): string {
    const lines: string[] = ['❌ Circular dependency detected!', '', 'Dependency chain:'];

    const cycle = error.cycle;
    for (let i = 0; i < cycle.length - 1; i++) {
      lines.push(`  ${i + 1}. ${cycle[i]} → ${cycle[i + 1]}`);
    }

    lines.push('');
    lines.push('To fix this issue:');
    lines.push(
      `  • Remove the extends reference from ${cycle[cycle.length - 2]} to ${cycle[cycle.length - 1]}`
    );
    lines.push(`  • Or restructure your presets to avoid circular dependencies`);

    return lines.join('\n');
  }
}
