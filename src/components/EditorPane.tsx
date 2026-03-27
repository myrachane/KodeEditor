import Editor, { type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useRef } from 'react';
import type { WorkspaceSettings } from '../types/ide';

interface EditorPaneProps {
  value: string;
  language: string;
  settings: WorkspaceSettings;
  onChange: (content: string) => void;
  onCursor: (line: number, column: number) => void;
}

export const EditorPane = ({ value, language, settings, onChange, onCursor }: EditorPaneProps) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const onMount: OnMount = (instance) => {
    editorRef.current = instance;

    instance.addAction({
      id: 'ghost-it',
      label: 'Ghost it',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: () => {
        const selection = instance.getSelection();
        const model = instance.getModel();
        if (!selection || !model || selection.isEmpty()) return;
        const selectedCode = model.getValueInRange(selection);
        instance.executeEdits('ghost-it', [
          {
            range: selection,
            text: `/* GHOST-START */\n${selectedCode}\n/* GHOST-END */`,
          },
        ]);
      },
    });

    instance.onDidChangeCursorPosition((event) => {
      onCursor(event.position.lineNumber, event.position.column);
    });
  };

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      language={language}
      value={value}
      onMount={onMount}
      onChange={(next) => onChange(next ?? '')}
      theme={settings.theme === 'light' ? 'light' : 'vs-dark'}
      options={{
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        tabSize: settings.tabSize,
        minimap: { enabled: true },
        lineNumbers: 'on',
        wordWrap: settings.wordWrap ? 'on' : 'off',
        autoClosingBrackets: 'always',
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        stickyScroll: { enabled: true },
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        formatOnPaste: settings.formatOnSave,
      }}
    />
  );
};
