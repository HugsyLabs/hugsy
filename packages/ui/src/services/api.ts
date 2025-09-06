const API_BASE = 'http://localhost:3001/api';

export const api = {
  // Check if configuration exists
  async checkConfigExists(): Promise<boolean> {
    const response = await fetch(`${API_BASE}/config/exists`);
    const data = await response.json();
    return data.exists;
  },

  // Get available presets
  async getPresets(): Promise<{ name: string; description: string }[]> {
    const response = await fetch(`${API_BASE}/presets`);
    const data = await response.json();
    return data.presets;
  },

  // Initialize configuration with preset
  async initConfig(
    preset: string,
    force = false
  ): Promise<{
    success: boolean;
    config?: Record<string, unknown>;
    error?: string;
    message?: string;
  }> {
    const response = await fetch(`${API_BASE}/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset, force }),
    });
    return response.json();
  },

  // Get existing .claude/settings.json
  async getSettings(): Promise<{
    settings: Record<string, unknown> | null;
    exists: boolean;
  }> {
    const response = await fetch(`${API_BASE}/settings`);
    return response.json();
  },

  // Get .hugsyrc content
  async getHugsyrc(): Promise<string> {
    const response = await fetch(`${API_BASE}/hugsyrc`);
    const data = await response.json();
    return data.content;
  },

  // Update .hugsyrc content
  async updateHugsyrc(content: string): Promise<void> {
    await fetch(`${API_BASE}/hugsyrc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
  },

  // Compile settings
  async compile(): Promise<{
    settings: Record<string, unknown> | null;
    commands?: Record<string, { content: string; category?: string }>;
    subagents?: Record<string, { content: string; description: string; tools?: string[] }>;
    output: string;
    error?: string;
    missingPackages?: string[];
  }> {
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  },

  // Get commands
  async getCommands(): Promise<{
    commands: {
      name: string;
      files: {
        name: string;
        path: string;
        content: string;
      }[];
    }[];
  }> {
    const response = await fetch(`${API_BASE}/commands`);
    return response.json();
  },

  // Update command file
  async updateCommand(path: string, content: string): Promise<void> {
    await fetch(`${API_BASE}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
  },

  // Delete command file
  async deleteCommand(path: string): Promise<void> {
    await fetch(`${API_BASE}/commands`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
  },

  // Install npm packages
  async installPackages(packages: string[]): Promise<{
    success: boolean;
    message?: string;
    output?: string;
    error?: string;
    packageManager?: string;
  }> {
    const response = await fetch(`${API_BASE}/install-packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packages }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? 'Failed to install packages');
    }

    return result;
  },

  // Install settings using hugsy install
  async installSettings(force = false): Promise<{
    settings?: Record<string, unknown> | null;
    output: string;
    error?: string;
    message: string;
  }> {
    const response = await fetch(`${API_BASE}/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? 'Failed to install settings');
    }

    return result;
  },

  // Get agents from .claude/agents
  async getAgents(): Promise<{
    agents: Record<
      string,
      {
        name: string;
        description: string;
        tools?: string[];
        content: string;
      }
    >;
  }> {
    const response = await fetch(`${API_BASE}/agents`);
    return response.json();
  },
};
