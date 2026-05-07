/**
 * CardDetail — slide-over panel for full issue details.
 *
 * Uses the Shadcn Sheet component to render on the right side.
 * Shows description, acceptance criteria, linked issues, subtasks,
 * comments, status, and assignee info.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, User, Tag, GitBranch, MessageCircle } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIssue } from '@/lib/jira/queries';

interface CardDetailProps {
  issueKey: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CardDetail({ issueKey, open, onOpenChange }: CardDetailProps) {
  const { data: issue, isLoading } = useIssue(issueKey ?? '', {
    enabled: !!issueKey && open,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {/* Keyboard shortcut hint for close */}
        <kbd className="absolute right-12 top-[18px] rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          Esc
        </kbd>
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading issue...</p>
          </div>
        )}

        {issue && (
          <ScrollArea className="h-full pr-4">
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <span className="text-muted-foreground">{issue.key}</span>
                <span>{issue.fields.summary}</span>
              </SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <Badge
                  variant={
                    issue.fields.status.statusCategory.key === 'done'
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {issue.fields.status.name}
                </Badge>
                <Badge variant="outline">{issue.fields.priority.name}</Badge>
                <Badge variant="outline">{issue.fields.issuetype.name}</Badge>
              </SheetDescription>
            </SheetHeader>

            {/* Assignee and reporter */}
            <div className="mb-4 flex gap-4">
              {issue.fields.assignee && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <img
                    src={issue.fields.assignee.avatarUrls['24x24']}
                    alt={issue.fields.assignee.displayName}
                    className="h-5 w-5 rounded-full"
                  />
                  <span>{issue.fields.assignee.displayName}</span>
                </div>
              )}
              {issue.fields.reporter && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  Reporter: {issue.fields.reporter.displayName}
                </div>
              )}
            </div>

            {/* Components and labels */}
            {(issue.fields.components.length > 0 ||
              issue.fields.labels.length > 0) && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {issue.fields.components.map((c) => (
                  <Badge key={c.id} variant="secondary" className="text-xs">
                    <Tag className="mr-1 h-3 w-3" />
                    {c.name}
                  </Badge>
                ))}
                {issue.fields.labels.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            <Separator className="my-4" />

            {/* Description */}
            <section className="mb-4">
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                Description
              </h4>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {issue.fields.description ? (
                  <DescriptionRenderer content={issue.fields.description} />
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No description provided.
                  </p>
                )}
              </div>
            </section>

            {/* Linked issues */}
            {issue.fields.issuelinks && issue.fields.issuelinks.length > 0 && (
              <>
                <Separator className="my-4" />
                <section className="mb-4">
                  <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <GitBranch className="h-3.5 w-3.5" />
                    Linked Issues
                  </h4>
                  <ul className="space-y-1.5">
                    {issue.fields.issuelinks.map((link) => {
                      const linkedIssue =
                        link.outwardIssue ?? link.inwardIssue;
                      const direction = link.outwardIssue
                        ? link.type.outward
                        : link.type.inward;
                      if (!linkedIssue) return null;
                      return (
                        <li
                          key={link.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="text-muted-foreground">
                            {direction}
                          </span>
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">
                            {linkedIssue.key}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {linkedIssue.fields.summary}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </>
            )}

            {/* Subtasks */}
            {issue.fields.subtasks && issue.fields.subtasks.length > 0 && (
              <>
                <Separator className="my-4" />
                <section className="mb-4">
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    Subtasks
                  </h4>
                  <ul className="space-y-1.5">
                    {issue.fields.subtasks.map((subtask) => (
                      <li
                        key={subtask.key}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Badge
                          variant={
                            subtask.fields.status.statusCategory.key === 'done'
                              ? 'default'
                              : 'outline'
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {subtask.fields.status.name}
                        </Badge>
                        <span className="font-medium">{subtask.key}</span>
                        <span className="truncate text-muted-foreground">
                          {subtask.fields.summary}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {/* Comments */}
            {issue.fields.comment &&
              issue.fields.comment.comments.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <section className="mb-4">
                    <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <MessageCircle className="h-3.5 w-3.5" />
                      Comments ({issue.fields.comment.total})
                    </h4>
                    <ul className="space-y-3">
                      {issue.fields.comment.comments.map((comment) => (
                        <li
                          key={comment.id}
                          className="rounded-md border border-border p-3"
                        >
                          <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <img
                              src={comment.author.avatarUrls['16x16']}
                              alt={comment.author.displayName}
                              className="h-4 w-4 rounded-full"
                            />
                            <span className="font-medium text-foreground">
                              {comment.author.displayName}
                            </span>
                            <span>
                              {new Date(comment.created).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="text-sm text-card-foreground">
                            <DescriptionRenderer content={comment.body} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Internal components
// ---------------------------------------------------------------------------

/**
 * Renders Jira content — handles both ADF (Atlassian Document Format)
 * and plain text. For ADF, extracts text content for a basic rendering.
 * A full ADF renderer would be a separate concern.
 */
function DescriptionRenderer({ content }: { content: unknown }) {
  const text = extractText(content);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {text}
    </ReactMarkdown>
  );
}

/** Extract plain text from ADF or return content as-is if it's a string. */
function extractText(content: unknown): string {
  if (typeof content === 'string') return content;

  // ADF is a tree structure — walk it to extract text nodes
  if (content && typeof content === 'object' && 'type' in content) {
    const adf = content as { type: string; content?: unknown[]; text?: string };
    if (adf.text) return adf.text;
    if (adf.content) {
      return adf.content.map(extractText).join('\n');
    }
  }

  // Fallback
  return '';
}
