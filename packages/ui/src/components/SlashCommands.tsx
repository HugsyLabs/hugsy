import { motion } from 'framer-motion';
import { Command, Search, Star, Download, FolderOpen, GitBranch, FileCode, FileText, Package as PackageIcon } from 'lucide-react';
import { useState } from 'react';

// Installed commands from .claude/commands/
const installedCommands = [
  { 
    name: 'commit', 
    description: 'Create git commit with conventional format',
    category: 'git',
    file: '.claude/commands/git/commit.md'
  },
  { 
    name: 'pr', 
    description: 'Create pull request with template',
    category: 'git',
    file: '.claude/commands/git/pr.md'
  },
  { 
    name: 'test', 
    description: 'Run project tests with coverage',
    category: 'development',
    file: '.claude/commands/development/test.md'
  },
  { 
    name: 'build', 
    description: 'Build project for production',
    category: 'development',
    file: '.claude/commands/development/build.md'
  },
  { 
    name: 'lint', 
    description: 'Lint and format code',
    category: 'development',
    file: '.claude/commands/development/lint.md'
  },
  { 
    name: 'docs', 
    description: 'Generate documentation',
    category: 'documentation',
    file: '.claude/commands/documentation/generate.md'
  },
  { 
    name: 'release', 
    description: 'Create a new release',
    category: 'release',
    file: '.claude/commands/release/create.md'
  }
];

// Community commands (marketplace)
const communityCommands = [
  {
    name: 'pr-review',
    description: 'AI-powered pull request review',
    author: '@microsoft',
    stars: 2300,
    downloads: 15000,
    category: 'review'
  },
  {
    name: 'test-coverage',
    description: 'Generate detailed test coverage reports',
    author: '@jest-community',
    stars: 1800,
    downloads: 12000,
    category: 'testing'
  },
  {
    name: 'changelog',
    description: 'Auto-generate changelog from commits',
    author: '@conventional-changelog',
    stars: 956,
    downloads: 8000,
    category: 'release'
  },
  {
    name: 'refactor',
    description: 'Smart code refactoring suggestions',
    author: '@claude-community',
    stars: 1200,
    downloads: 6500,
    category: 'development'
  },
  {
    name: 'security-audit',
    description: 'Security vulnerability scanner',
    author: '@snyk',
    stars: 3400,
    downloads: 20000,
    category: 'security'
  }
];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  git: GitBranch,
  development: FileCode,
  documentation: FileText,
  release: PackageIcon,
  review: Star,
  testing: Command,
  security: Command
};

export function SlashCommands() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredCommunity = communityCommands.filter(cmd => 
    (selectedCategory === 'all' || cmd.category === selectedCategory) &&
    (cmd.name.includes(searchQuery) || cmd.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 h-[60px] flex items-center">
        <div className="flex items-center justify-between w-full">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Slash Commands</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage your commands and discover new ones
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Installed Commands Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <FolderOpen className="w-5 h-5 mr-2 text-gray-500" />
              Installed Commands ({installedCommands.length})
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {installedCommands.map((cmd) => {
              const Icon = categoryIcons[cmd.category] || Command;
              return (
                <motion.div
                  key={cmd.name}
                  whileHover={{ y: -1 }}
                  className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                        <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">/{cmd.name}</h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{cmd.category}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{cmd.description}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{cmd.file}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Community Commands Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Star className="w-5 h-5 mr-2 text-gray-500" />
              Community Commands
            </h3>
            <div className="flex items-center space-x-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search commands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Categories</option>
                <option value="git">Git</option>
                <option value="development">Development</option>
                <option value="testing">Testing</option>
                <option value="security">Security</option>
                <option value="release">Release</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCommunity.map((cmd) => (
              <motion.div
                key={cmd.name}
                whileHover={{ y: -2 }}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">/{cmd.name}</h4>
                  <button className="px-3 py-1 bg-primary-100 hover:bg-primary-200 dark:bg-primary-900/30 dark:hover:bg-primary-900/50 text-primary-700 dark:text-primary-400 rounded-lg text-xs font-medium transition-colors">
                    Install
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{cmd.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-500">
                  <span>{cmd.author}</span>
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center">
                      <Star className="w-3 h-3 mr-1" />
                      {cmd.stars.toLocaleString()}
                    </span>
                    <span className="flex items-center">
                      <Download className="w-3 h-3 mr-1" />
                      {cmd.downloads.toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}