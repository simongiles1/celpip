import { normalizeExamPromptMarkdown } from "@/lib/normalize-exam-prompt-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { useMemo } from "react";

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
  const markdown = useMemo(
    () => (inline ? children : normalizeExamPromptMarkdown(children)),
    [children, inline],
  );

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={inline ? defaultComponents : undefined}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
