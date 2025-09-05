import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, FileText, Wrench, Copy, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { LazyEditor } from './LazyEditor';
import useStore from '../store';
import { cn } from '../utils/cn';

interface Subagent {
  name: string;
  description: string;
  tools?: string[];
  content: string;
}

export function SubagentsViewer() {
  const { theme } = useStore();
  const [subagents, setSubagents] = useState<Record<string, Subagent>>({});
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [copiedAgents, setCopiedAgents] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  useEffect(() => {
    void loadSubagents();
  }, []);

  const loadSubagents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/compile');
      const data = await response.json();

      if (data.subagents) {
        setSubagents(data.subagents);
        // Select first agent by default
        const firstAgent = Object.keys(data.subagents)[0];
        if (firstAgent) {
          setSelectedAgent(firstAgent);
        }
      }
    } catch (error) {
      console.error('Failed to load subagents:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const copyAgent = (agentName: string) => {
    const agent = subagents[agentName];
    if (agent) {
      const markdown = `---
name: ${agent.name}
description: ${agent.description}${
        agent.tools
          ? `
tools: ${agent.tools.join(', ')}`
          : ''
      }
---

${agent.content}`;
      void navigator.clipboard.writeText(markdown);
      setCopiedAgents(new Set([...copiedAgents, agentName]));
      setTimeout(() => {
        setCopiedAgents((prev) => {
          const newSet = new Set(prev);
          newSet.delete(agentName);
          return newSet;
        });
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading subagents...</p>
        </div>
      </div>
    );
  }

  const agentCount = Object.keys(subagents).length;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <Bot className="w-6 h-6 text-primary-500" />
                <span>Subagents</span>
                <span className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400 ml-2">
                  {agentCount} {agentCount === 1 ? 'agent' : 'agents'}
                </span>
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Specialized AI assistants configured for specific tasks
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {agentCount === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No subagents configured</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Add subagents to your configuration or create them in{' '}
              <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                .claude/agents/
              </code>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Agent List */}
          <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-auto">
            <div className="p-4 space-y-2">
              {Object.entries(subagents).map(([name, agent]) => (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-colors',
                    selectedAgent === name
                      ? 'bg-primary-100 dark:bg-primary-900/20 border border-primary-300 dark:border-primary-700'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  )}
                  onClick={() => setSelectedAgent(name)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">{name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {agent.description}
                      </p>
                      {agent.tools && (
                        <div className="flex items-center mt-2 text-xs text-gray-400">
                          <Wrench className="w-3 h-3 mr-1" />
                          <span>{agent.tools.length} tools</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyAgent(name);
                      }}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Copy agent definition"
                    >
                      {copiedAgents.has(name) ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Agent Details */}
          {selectedAgent && subagents[selectedAgent] && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {selectedAgent}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {subagents[selectedAgent].description}
                </p>

                {/* Tools Section */}
                {subagents[selectedAgent].tools && (
                  <div className="mt-4">
                    <button
                      onClick={() => toggleSection('tools')}
                      className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {expandedSections.has('tools') ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <Wrench className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Tools ({subagents[selectedAgent].tools.length})
                      </span>
                    </button>
                    {expandedSections.has('tools') && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {subagents[selectedAgent].tools.map((tool) => (
                          <span
                            key={tool}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded font-mono"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* System Prompt */}
              <div className="flex-1 overflow-hidden">
                <div className="h-full flex flex-col">
                  <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                      <FileText className="w-4 h-4 mr-2" />
                      System Prompt
                    </h4>
                  </div>
                  <div className="flex-1">
                    <LazyEditor
                      height="100%"
                      defaultLanguage="markdown"
                      value={subagents[selectedAgent].content}
                      theme={editorTheme}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        wordWrap: 'on',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
