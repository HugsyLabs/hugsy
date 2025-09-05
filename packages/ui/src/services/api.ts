const API_BASE = 'http://localhost:3001/api';

export const api = {
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
    output: string;
    error?: string;
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
};
