# Proposal: Add Accessible Label to Chat Textarea

## Type: fix
## Source: UAT-3 C7, UAT-3 U4
## Problem: Chat message textarea has no accessible label (only placeholder text), and the command palette listbox is missing `aria-activedescendant`.
## Solution:
1. Add `aria-label="Type a message"` to the textarea in `MessageInput.tsx`
2. Add `aria-controls` and `aria-activedescendant` to the command palette input

In `MessageInput.tsx`:
```tsx
<textarea
  ref={textareaRef}
  value={value}
  onChange={handleInput}
  onKeyDown={handleKeyDown}
  placeholder="Type a message..."
  aria-label="Type a message"
  disabled={disabled}
  ...
/>
```

In `CommandPalette.tsx`:
```tsx
<Input
  ref={inputRef}
  value={query}
  onChange={...}
  placeholder="Type a command..."
  aria-label="Command search"
  aria-controls="command-list"
  aria-activedescendant={flatCommands[selectedIndex] ? `cmd-${flatCommands[selectedIndex].id}` : undefined}
/>
```

## Effort: S
## Files affected:
- `src/components/chat/MessageInput.tsx`
- `src/components/shared/CommandPalette.tsx`
## Test plan:
- Screen reader announces "Type a message" when focusing textarea
- Screen reader announces selected command in palette
- Run accessibility audit — no label violations
