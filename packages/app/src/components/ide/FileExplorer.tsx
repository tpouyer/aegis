/**
 * FileExplorer — tree view of the virtual filesystem.
 *
 * Renders the file/directory tree from the VFS. Clicking a file
 * opens it in the editor (adds a tab). Directories expand/collapse.
 * Multi-repo: shows a separate tree per initialized repo.
 */

import { ChevronDown, ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import type { TreeEntry } from '@/lib/github/types'
import { cn } from '@/lib/utils'
import { useIDEStore } from '@/stores/ide'

interface FileExplorerProps {
  repoKey: string
  tree: TreeEntry[]
}

/** Build a nested structure from a flat tree for rendering. */
interface TreeNode {
  name: string
  path: string
  type: 'blob' | 'tree'
  children: TreeNode[]
}

function buildTree(entries: TreeEntry[]): TreeNode[] {
  const root: TreeNode[] = []
  const nodeMap = new Map<string, TreeNode>()

  // Sort entries so directories come first, then alphabetically
  const sorted = [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'tree' ? -1 : 1
    return a.path.localeCompare(b.path)
  })

  for (const entry of sorted) {
    const parts = entry.path.split('/')
    const name = parts[parts.length - 1]
    const node: TreeNode = {
      name,
      path: entry.path,
      type: entry.type,
      children: [],
    }

    nodeMap.set(entry.path, node)

    if (parts.length === 1) {
      root.push(node)
    } else {
      const parentPath = parts.slice(0, -1).join('/')
      const parent = nodeMap.get(parentPath)
      if (parent) {
        parent.children.push(node)
      } else {
        // Parent not in tree (shouldn't happen with recursive tree)
        root.push(node)
      }
    }
  }

  return root
}

/** Get a file icon based on extension. */
function getFileIcon(name: string) {
  // For now, use the generic File icon.
  // Can be extended with language-specific icons.
  void name
  return File
}

interface TreeItemProps {
  node: TreeNode
  repoKey: string
  depth: number
}

function TreeItem({ node, repoKey, depth }: TreeItemProps) {
  const { explorerExpandedPaths, toggleExplorerPath, openFile } = useIDEStore()

  const fullPath = `${repoKey}:${node.path}`
  const isExpanded = explorerExpandedPaths.has(fullPath)
  const isDirectory = node.type === 'tree'

  const handleClick = useCallback(() => {
    if (isDirectory) {
      toggleExplorerPath(fullPath)
    } else {
      openFile(repoKey, node.path)
    }
  }, [isDirectory, fullPath, repoKey, node.path, toggleExplorerPath, openFile])

  const Icon = isDirectory ? (isExpanded ? FolderOpen : Folder) : getFileIcon(node.name)

  return (
    <div role="treeitem" aria-expanded={isDirectory ? isExpanded : undefined}>
      <button
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-sm hover:bg-accent',
          'text-left text-foreground',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isDirectory ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <Icon className={cn('h-4 w-4 shrink-0', isDirectory ? 'text-blue-400' : 'text-muted-foreground')} />
        <span className="truncate">{node.name}</span>
      </button>

      {isDirectory && isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} repoKey={repoKey} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileExplorer({ repoKey, tree }: FileExplorerProps) {
  const nodes = useMemo(() => buildTree(tree), [tree])

  return (
    <div className="pl-2" role="tree" aria-label={`Files in ${repoKey}`}>
      {nodes.map((node) => (
        <TreeItem key={node.path} node={node} repoKey={repoKey} depth={1} />
      ))}
    </div>
  )
}
