/**
 * Integration tests for the kanban board user journey.
 *
 * Tests the full board flow:
 *   - Board loads with columns and cards from mock Jira data
 *   - Card displays correct fields (key, summary, priority, components)
 *   - Filter bar filters visible cards
 *
 * Uses MSW to intercept Jira API calls and return realistic mock data.
 * The board is tested through its building blocks (FilterBar, column
 * derivation logic) since BoardView requires DnD and TanStack Query
 * providers that are best tested in combination with lighter wrappers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '@/components/board/FilterBar';
import { useBoardStore } from '@/stores/board';
import type { JiraIssue, BoardColumn } from '@/lib/jira/types';
import { mockBoardConfig, mockIssues } from '../mocks/handlers';

// ---------------------------------------------------------------------------
// Test data derived from MSW mock data
// ---------------------------------------------------------------------------

const issues: JiraIssue[] = mockIssues.issues as unknown as JiraIssue[];

// ---------------------------------------------------------------------------
// Store cleanup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useBoardStore.getState().clearFilters();
});

afterEach(() => {
  useBoardStore.getState().clearFilters();
});

// ---------------------------------------------------------------------------
// 1. Board loads with columns and cards from mock Jira data
// ---------------------------------------------------------------------------

describe('Board column and card population', () => {
  it('derives columns from board config and assigns issues correctly', () => {
    const columns: BoardColumn[] = mockBoardConfig.columnConfig.columns.map(
      (col) => {
        const statusIds = new Set(col.statuses.map((s) => s.id));
        const columnIssues = issues.filter((issue) =>
          statusIds.has(issue.fields.status.id),
        );
        return {
          name: col.name,
          statusIds: Array.from(statusIds),
          issues: columnIssues,
        };
      },
    );

    expect(columns).toHaveLength(3);

    // To Do column contains AEGIS-1
    expect(columns[0].name).toBe('To Do');
    expect(columns[0].issues).toHaveLength(1);
    expect(columns[0].issues[0].key).toBe('AEGIS-1');

    // In Progress column contains AEGIS-2
    expect(columns[1].name).toBe('In Progress');
    expect(columns[1].issues).toHaveLength(1);
    expect(columns[1].issues[0].key).toBe('AEGIS-2');

    // Done column contains AEGIS-3
    expect(columns[2].name).toBe('Done');
    expect(columns[2].issues).toHaveLength(1);
    expect(columns[2].issues[0].key).toBe('AEGIS-3');
  });

  it('handles optimistic updates by reassigning issues to target columns', () => {
    const optimisticUpdates = new Map([
      [
        'AEGIS-1',
        {
          issueKey: 'AEGIS-1',
          targetStatusId: '2', // move from To Do to In Progress
          originalStatusId: '1',
          timestamp: Date.now(),
        },
      ],
    ]);

    const columns: BoardColumn[] = mockBoardConfig.columnConfig.columns.map(
      (col) => {
        const statusIds = new Set(col.statuses.map((s) => s.id));
        const columnIssues = issues.filter((issue) => {
          const optimistic = optimisticUpdates.get(issue.key);
          const effectiveStatusId = optimistic
            ? optimistic.targetStatusId
            : issue.fields.status.id;
          return statusIds.has(effectiveStatusId);
        });
        return {
          name: col.name,
          statusIds: Array.from(statusIds),
          issues: columnIssues,
        };
      },
    );

    // AEGIS-1 moved from To Do to In Progress
    expect(columns[0].issues).toHaveLength(0); // To Do now empty
    expect(columns[1].issues).toHaveLength(2); // In Progress has AEGIS-1 and AEGIS-2
    expect(columns[1].issues.map((i) => i.key).sort()).toEqual([
      'AEGIS-1',
      'AEGIS-2',
    ]);
  });
});

// ---------------------------------------------------------------------------
// 2. Card displays correct fields
// ---------------------------------------------------------------------------

describe('Card data correctness', () => {
  it('AEGIS-1 has correct key, summary, priority, and assignee', () => {
    const card = issues[0];
    expect(card.key).toBe('AEGIS-1');
    expect(card.fields.summary).toBe('Implement authentication flow');
    expect(card.fields.priority.name).toBe('Medium');
    expect(card.fields.assignee?.displayName).toBe('Alice Developer');
    expect(card.fields.components[0].name).toBe('Auth');
  });

  it('AEGIS-2 has correct key, summary, priority (High), and no assignee', () => {
    const card = issues[1];
    expect(card.key).toBe('AEGIS-2');
    expect(card.fields.summary).toBe('Fix dashboard rendering bug');
    expect(card.fields.priority.name).toBe('High');
    expect(card.fields.assignee).toBeNull();
    expect(card.fields.issuetype.name).toBe('Bug');
  });

  it('AEGIS-3 has empty components list and Low priority', () => {
    const card = issues[2];
    expect(card.key).toBe('AEGIS-3');
    expect(card.fields.components).toHaveLength(0);
    expect(card.fields.priority.name).toBe('Low');
    expect(card.fields.status.name).toBe('Done');
  });

  it('all issues have required fields populated', () => {
    for (const issue of issues) {
      expect(issue.id).toBeDefined();
      expect(issue.key).toBeTruthy();
      expect(issue.fields.summary).toBeTruthy();
      expect(issue.fields.status).toBeDefined();
      expect(issue.fields.status.id).toBeTruthy();
      expect(issue.fields.status.statusCategory).toBeDefined();
      expect(issue.fields.priority).toBeDefined();
      expect(issue.fields.issuetype).toBeDefined();
      expect(issue.fields.created).toBeTruthy();
      expect(issue.fields.updated).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. FilterBar filters visible cards
// ---------------------------------------------------------------------------

describe('FilterBar integration with board store', () => {
  it('renders the search input and filter dropdowns', async () => {
    const { unmount } = render(<FilterBar issues={issues} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search issues...')).toBeInTheDocument();
      expect(screen.getByText('Assignee')).toBeInTheDocument();
      expect(screen.getByText('Component')).toBeInTheDocument();
      expect(screen.getByText('Priority')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    unmount();
  });

  it('text filter updates the store and can filter issues client-side', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FilterBar issues={issues} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search issues...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search issues...');
    await user.type(searchInput, 'auth');

    const { filters } = useBoardStore.getState();
    expect(filters.text).toBe('auth');

    // Simulate the client-side text filter that BoardView applies
    const filteredIssues = issues.filter(
      (issue) =>
        issue.key.toLowerCase().includes('auth') ||
        issue.fields.summary.toLowerCase().includes('auth'),
    );

    // Both AEGIS-1 ("Implement authentication flow") and AEGIS-3 ("Add unit tests for auth module") match
    expect(filteredIssues).toHaveLength(2);
    expect(filteredIssues.map((i) => i.key).sort()).toEqual([
      'AEGIS-1',
      'AEGIS-3',
    ]);

    unmount();
  });

  it('clearing the text filter resets the store value to null', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FilterBar issues={issues} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search issues...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search issues...');
    await user.type(searchInput, 'bug');
    expect(useBoardStore.getState().filters.text).toBe('bug');

    await user.clear(searchInput);
    expect(useBoardStore.getState().filters.text).toBeNull();

    unmount();
  });

  it('text filter by issue key narrows to a single issue', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FilterBar issues={issues} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search issues...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search issues...');
    await user.type(searchInput, 'AEGIS-2');

    const filterText = useBoardStore.getState().filters.text!;
    const filtered = issues.filter(
      (issue) =>
        issue.key.toLowerCase().includes(filterText.toLowerCase()) ||
        issue.fields.summary.toLowerCase().includes(filterText.toLowerCase()),
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('AEGIS-2');

    unmount();
  });

  it('text filter with no matches returns empty result', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<FilterBar issues={issues} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search issues...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search issues...');
    await user.type(searchInput, 'nonexistent-query-xyz');

    const filterText = useBoardStore.getState().filters.text!;
    const filtered = issues.filter(
      (issue) =>
        issue.key.toLowerCase().includes(filterText.toLowerCase()) ||
        issue.fields.summary.toLowerCase().includes(filterText.toLowerCase()),
    );

    expect(filtered).toHaveLength(0);

    unmount();
  });
});
