import { memo, useMemo } from 'react';
import { LazyEditor } from './LazyEditor';

interface JsonPreviewProps {
  data: unknown;
  title: string;
  theme?: 'light' | 'dark';
}

export const JsonPreview = memo(function JsonPreview({
  data,
  title,
  theme = 'light',
}: JsonPreviewProps) {
  const editorOptions = useMemo(
    () => ({
      readOnly: true,
      minimap: { enabled: false },
      fontSize: 14,
      lineNumbers: 'on' as const,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on' as const,
      wrappingIndent: 'indent' as const,
    }),
    []
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {data ? 'Read-only preview' : 'No data'}
        </span>
      </div>

      <div className="flex-1">
        <LazyEditor
          value={data ? JSON.stringify(data, null, 2) : '// No data available'}
          language="json"
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          options={editorOptions}
        />
      </div>
    </div>
  );
});
