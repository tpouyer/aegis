import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { shortcutRegistry } from '../registry';
import type { Shortcut } from '../registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal KeyboardEvent for testing.
 * JSDOM doesn't fully support `KeyboardEvent`, so we construct one
 * with the properties the registry inspects.
 */
function makeKeyEvent(
  key: string,
  opts: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    target?: EventTarget | null;
  } = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });

  // Override target if specified (KeyboardEvent constructor ignores target)
  if (opts.target) {
    Object.defineProperty(event, 'target', {
      value: opts.target,
      writable: false,
    });
  }

  return event;
}

/**
 * Create a mock HTML element that looks like an input.
 */
function makeInputElement(): HTMLElement {
  const el = document.createElement('input');
  return el;
}

function makeTextareaElement(): HTMLElement {
  const el = document.createElement('textarea');
  return el;
}

function makeContentEditableElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('contenteditable', 'true');
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  shortcutRegistry._reset();
});

afterEach(() => {
  shortcutRegistry._reset();
});

describe('ShortcutRegistry', () => {
  // -----------------------------------------------------------------------
  // Basic registration and triggering
  // -----------------------------------------------------------------------

  it('registers and triggers a shortcut', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'k',
      scope: 'global',
      description: 'test shortcut',
      action,
    });

    const event = makeKeyEvent('k');
    const handled = shortcutRegistry.handleKeyDown(event, 'global');

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Scope filtering
  // -----------------------------------------------------------------------

  it('board shortcuts do not fire in chat scope', () => {
    const boardAction = vi.fn();
    shortcutRegistry.register({
      key: 'j',
      scope: 'board',
      description: 'focus next card',
      action: boardAction,
    });

    const event = makeKeyEvent('j');
    const handled = shortcutRegistry.handleKeyDown(event, 'chat');

    expect(handled).toBe(false);
    expect(boardAction).not.toHaveBeenCalled();
  });

  it('global shortcuts fire in any scope', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'x',
      scope: 'global',
      description: 'global test',
      action,
    });

    const event = makeKeyEvent('x');
    const handled = shortcutRegistry.handleKeyDown(event, 'board');

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it('board shortcuts fire in board scope', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'j',
      scope: 'board',
      description: 'focus next',
      action,
    });

    const event = makeKeyEvent('j');
    const handled = shortcutRegistry.handleKeyDown(event, 'board');

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Modifier key handling
  // -----------------------------------------------------------------------

  it('handles mod+k with metaKey on Mac', () => {
    // The registry checks navigator.userAgent to determine platform.
    // In JSDOM, navigator.userAgent is typically a generic string, so
    // mod maps to Ctrl. We test the ctrlKey path.
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'mod+k',
      scope: 'global',
      description: 'command palette',
      action,
    });

    // With ctrlKey (since JSDOM is not Mac)
    const event = makeKeyEvent('k', { ctrlKey: true });
    const handled = shortcutRegistry.handleKeyDown(event, 'global');

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it('does not trigger mod+k when no modifier is pressed', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'mod+k',
      scope: 'global',
      description: 'command palette',
      action,
    });

    const event = makeKeyEvent('k');
    const handled = shortcutRegistry.handleKeyDown(event, 'global');

    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('does not trigger plain key when modifier is pressed', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'k',
      scope: 'global',
      description: 'test',
      action,
    });

    const event = makeKeyEvent('k', { ctrlKey: true });
    const handled = shortcutRegistry.handleKeyDown(event, 'global');

    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Ignore when focus is in input
  // -----------------------------------------------------------------------

  it('ignores single-key shortcuts when focus is in an input', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'j',
      scope: 'board',
      description: 'focus next card',
      action,
    });

    const inputEl = makeInputElement();
    const event = makeKeyEvent('j', { target: inputEl });
    const handled = shortcutRegistry.handleKeyDown(event, 'board');

    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('ignores single-key shortcuts when focus is in a textarea', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'f',
      scope: 'board',
      description: 'focus filter',
      action,
    });

    const textareaEl = makeTextareaElement();
    const event = makeKeyEvent('f', { target: textareaEl });
    const handled = shortcutRegistry.handleKeyDown(event, 'board');

    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('ignores single-key shortcuts when focus is in contenteditable', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'k',
      scope: 'board',
      description: 'focus prev',
      action,
    });

    const ceEl = makeContentEditableElement();
    const event = makeKeyEvent('k', { target: ceEl });
    const handled = shortcutRegistry.handleKeyDown(event, 'board');

    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('allows modifier shortcuts even when focus is in an input', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'mod+s',
      scope: 'ide',
      description: 'save',
      action,
    });

    const inputEl = makeInputElement();
    const event = makeKeyEvent('s', { ctrlKey: true, target: inputEl });
    const handled = shortcutRegistry.handleKeyDown(event, 'ide');

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // Unregister
  // -----------------------------------------------------------------------

  it('unregister removes the shortcut', () => {
    const action = vi.fn();
    const unregister = shortcutRegistry.register({
      key: 'j',
      scope: 'board',
      description: 'focus next',
      action,
    });

    // Verify it works before unregister
    const event1 = makeKeyEvent('j');
    shortcutRegistry.handleKeyDown(event1, 'board');
    expect(action).toHaveBeenCalledOnce();

    // Unregister
    unregister();

    // Should no longer fire
    const event2 = makeKeyEvent('j');
    const handled = shortcutRegistry.handleKeyDown(event2, 'board');
    expect(handled).toBe(false);
    expect(action).toHaveBeenCalledOnce(); // still 1
  });

  // -----------------------------------------------------------------------
  // Two-key chord sequences
  // -----------------------------------------------------------------------

  it('handles two-key chord sequences (g then b)', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'g b',
      scope: 'global',
      description: 'go to board',
      action,
    });

    // First key: g
    const event1 = makeKeyEvent('g');
    const handled1 = shortcutRegistry.handleKeyDown(event1, 'global');
    expect(handled1).toBe(false); // first key doesn't trigger, just starts chord

    // Second key: b
    const event2 = makeKeyEvent('b');
    const handled2 = shortcutRegistry.handleKeyDown(event2, 'global');
    expect(handled2).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it('chord does not fire if second key is wrong', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'g b',
      scope: 'global',
      description: 'go to board',
      action,
    });

    // First key: g
    shortcutRegistry.handleKeyDown(makeKeyEvent('g'), 'global');

    // Wrong second key: x
    const handled = shortcutRegistry.handleKeyDown(makeKeyEvent('x'), 'global');
    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('chord does not fire when focus is in an input', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'g b',
      scope: 'global',
      description: 'go to board',
      action,
    });

    const inputEl = makeInputElement();

    // First key in input: g — should not start chord
    shortcutRegistry.handleKeyDown(makeKeyEvent('g', { target: inputEl }), 'global');

    // Second key: b
    const handled = shortcutRegistry.handleKeyDown(makeKeyEvent('b'), 'global');
    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('multiple chord shortcuts with same prefix', () => {
    const actionB = vi.fn();
    const actionS = vi.fn();
    shortcutRegistry.register({
      key: 'g b',
      scope: 'global',
      description: 'go to board',
      action: actionB,
    });
    shortcutRegistry.register({
      key: 'g s',
      scope: 'global',
      description: 'go to settings',
      action: actionS,
    });

    // g then s
    shortcutRegistry.handleKeyDown(makeKeyEvent('g'), 'global');
    shortcutRegistry.handleKeyDown(makeKeyEvent('s'), 'global');
    expect(actionS).toHaveBeenCalledOnce();
    expect(actionB).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // `when` condition
  // -----------------------------------------------------------------------

  it('when condition prevents firing when it returns false', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'Enter',
      scope: 'board',
      description: 'open card',
      action,
      when: () => false,
    });

    const event = makeKeyEvent('Enter');
    const handled = shortcutRegistry.handleKeyDown(event, 'board');

    expect(handled).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('when condition allows firing when it returns true', () => {
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'Enter',
      scope: 'board',
      description: 'open card',
      action,
      when: () => true,
    });

    const event = makeKeyEvent('Enter');
    const handled = shortcutRegistry.handleKeyDown(event, 'board');

    expect(handled).toBe(true);
    expect(action).toHaveBeenCalledOnce();
  });

  it('when condition is dynamic', () => {
    let enabled = false;
    const action = vi.fn();
    shortcutRegistry.register({
      key: 'Enter',
      scope: 'board',
      description: 'open card',
      action,
      when: () => enabled,
    });

    // First attempt: disabled
    shortcutRegistry.handleKeyDown(makeKeyEvent('Enter'), 'board');
    expect(action).not.toHaveBeenCalled();

    // Enable and try again
    enabled = true;
    shortcutRegistry.handleKeyDown(makeKeyEvent('Enter'), 'board');
    expect(action).toHaveBeenCalledOnce();
  });

  // -----------------------------------------------------------------------
  // getShortcuts
  // -----------------------------------------------------------------------

  it('getShortcuts returns all shortcuts when no scope is provided', () => {
    shortcutRegistry.register({
      key: 'j',
      scope: 'board',
      description: 'test1',
      action: vi.fn(),
    });
    shortcutRegistry.register({
      key: 'Escape',
      scope: 'chat',
      description: 'test2',
      action: vi.fn(),
    });

    const all = shortcutRegistry.getShortcuts();
    expect(all).toHaveLength(2);
  });

  it('getShortcuts filters by scope', () => {
    shortcutRegistry.register({
      key: 'j',
      scope: 'board',
      description: 'test1',
      action: vi.fn(),
    });
    shortcutRegistry.register({
      key: 'Escape',
      scope: 'chat',
      description: 'test2',
      action: vi.fn(),
    });

    const boardShortcuts = shortcutRegistry.getShortcuts('board');
    expect(boardShortcuts).toHaveLength(1);
    expect(boardShortcuts[0].scope).toBe('board');
  });

  // -----------------------------------------------------------------------
  // preventDefault
  // -----------------------------------------------------------------------

  it('calls preventDefault on matched shortcuts', () => {
    shortcutRegistry.register({
      key: 'k',
      scope: 'global',
      description: 'test',
      action: vi.fn(),
    });

    const event = makeKeyEvent('k');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    shortcutRegistry.handleKeyDown(event, 'global');

    expect(preventDefaultSpy).toHaveBeenCalledOnce();
  });

  it('does not call preventDefault when no shortcut matches', () => {
    shortcutRegistry.register({
      key: 'k',
      scope: 'board',
      description: 'test',
      action: vi.fn(),
    });

    const event = makeKeyEvent('x');
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    shortcutRegistry.handleKeyDown(event, 'board');

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
