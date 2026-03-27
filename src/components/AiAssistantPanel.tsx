import { useState } from 'react';

interface AiAssistantPanelProps {
  code: string;
}

export const AiAssistantPanel = ({ code }: AiAssistantPanelProps) => {
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('Local LLM hook ready. Connect your model endpoint in server/ai.js for deep analysis.');

  const run = () => {
    const size = code.trim().split('\n').length;
    setAnswer(`Research mode: selected context has ${size} lines. Suggestion: isolate function boundaries, run profile, then apply targeted refactor.`);
  };

  return (
    <div className="h-full border-l border-[#30363d] w-[320px] glass p-3 flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wider text-[#8b949e]">AI Assistant</p>
      <textarea
        className="h-28 bg-[#0d1117] border border-[#30363d] rounded-xl2 p-2 text-xs outline-none"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ask about selected code, errors or architecture..."
      />
      <button className="h-9 rounded-xl2 bg-[#1f6feb] text-xs" onClick={run}>
        Analyze
      </button>
      <div className="flex-1 overflow-auto scrollbar bg-[#0d1117] border border-[#30363d] rounded-xl2 p-2 text-xs leading-relaxed">
        {answer}
      </div>
    </div>
  );
};
