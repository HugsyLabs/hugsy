import { lazy, Suspense } from 'react';
import type { EditorProps } from '@monaco-editor/react';

// Lazy load Monaco Editor to reduce initial bundle size
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

interface LazyEditorProps extends EditorProps {
  fallbackText?: string;
}

export function LazyEditor({ fallbackText = 'Loading editor...', ...props }: LazyEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
          <div className="text-gray-500 dark:text-gray-400">{fallbackText}</div>
        </div>
      }
    >
      <MonacoEditor {...props} />
    </Suspense>
  );
}
