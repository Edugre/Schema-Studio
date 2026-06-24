import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownProps = {
  children: string;
};

// Renders copilot text as markdown. react-markdown does not render raw HTML by
// default, so this stays safe without an extra sanitizer. Links open in a new tab.
export function Markdown({ children }: MarkdownProps) {
  return (
    <div className="copilot-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => {
            void node;
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
