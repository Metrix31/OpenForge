import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_id: string, label: string): Worker {
    switch (label) {
      case 'json': return new jsonWorker();
      case 'css':
      case 'scss':
      case 'less': return new cssWorker();
      case 'html':
      case 'handlebars':
      case 'razor': return new htmlWorker();
      case 'typescript':
      case 'javascript': return new tsWorker();
      default: return new editorWorker();
    }
  },
};

monaco.editor.defineTheme('vyrnex-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#14161f',
    'editor.lineHighlightBackground': '#1a1e2b',
    'editorLineNumber.foreground': '#454c63',
    'editorLineNumber.activeForeground': '#98a1ba',
    'editorCursor.foreground': '#3fb8c9',
    'editor.selectionBackground': '#244a57',
    'editorWidget.background': '#191c27',
    'editorIndentGuide.background1': '#232738',
  },
});

monaco.editor.defineTheme('vyrnex-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#fafbfd',
    'editor.lineHighlightBackground': '#eff1f6',
    'editorLineNumber.foreground': '#a2a9bd',
    'editorLineNumber.activeForeground': '#555d73',
    'editorCursor.foreground': '#0e8a9b',
    'editorWidget.background': '#eff1f6',
  },
});

export { monaco };
