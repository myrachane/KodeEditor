interface StatusBarProps {
  line: number;
  column: number;
  language: string;
  branch: string;
  errors: number;
  warnings: number;
  live: boolean;
}

export const StatusBar = ({ line, column, language, branch, errors, warnings, live }: StatusBarProps) => {
  return (
    <footer className="h-8 bg-[#1f6feb] text-white text-xs px-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span>Ln {line}, Col {column}</span>
        <span>{language}</span>
        <span>{branch}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Errors: {errors}</span>
        <span>Warnings: {warnings}</span>
        <span>{live ? 'Live Server: Online' : 'Live Server: Offline'}</span>
        <span>UTF-8</span>
      </div>
    </footer>
  );
};
