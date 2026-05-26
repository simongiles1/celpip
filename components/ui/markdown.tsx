import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const defaultComponents: Components = {
  p: ({ children }) => <span>{children}</span>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
};

interface MarkdownContentProps {
  children: string;
  inline?: boolean;
  className?: string;
}

export function MarkdownContent({
  children,
  inline = false,
  className,
}: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={inline ? defaultComponents : undefined}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
