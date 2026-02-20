---
github_issue_url: [Full GitHub issue URL if applicable, otherwise omit this field]
status: draft
related_research: [Path to research document if applicable, otherwise omit this field]
---

# [Feature/Task Name] Implementation Plan

**Related Issue**: [GitHub issue URL as markdown link if applicable, e.g., [GH-1234](https://github.com/org/repo/issues/1234)]

---

## Pattern Decisions

Document the architectural patterns chosen for this implementation:

- **[Component type]:** [Pattern choice] (based on: [Reference file with line numbers if helpful])
- **[Another component]:** [Pattern] (based on: [Reference])
- **Utilities identified:** [List utilities to use with file paths]
- **Types to update:** [List types that need new fields/changes]

**Example:**

```markdown
- **Component pattern:** Functional component with Props interface (based on: ConnectionForm.tsx)
- **Hook pattern:** SWR-based data fetching with context provider (based on: useConnections.tsx)
- **Utilities identified:** connectionActions (utils/connectionActions.ts)
- **Types to update:** Connection interface (types/Connection.ts)
```

---

## Overview

[Brief description of what we're implementing and why]

## Current State Analysis

[What exists now, what's missing, key constraints discovered]

## Desired End State

[A Specification of the desired end state after this plan is complete, and how to verify it]

### Key Discoveries:

- [Important finding with file:line reference]
- [Pattern to follow]
- [Constraint to work within]

## What We're NOT Doing

[Explicitly list out-of-scope items to prevent scope creep]

## Implementation Approach

[High-level strategy and reasoning]

## Phase 1: [Descriptive Name]

### Overview

[What this phase accomplishes]

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed (if not Phase 1): `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/{plan-name}-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

#### 1. [Component/File Group]

**File**: `path/to/file.ext` (lines X-Y or after method name)
**Change**: [Brief description - e.g., "Add ConnectionStatus component"]

**Key Implementation Notes**:

- Design constraints: [e.g., "Must follow existing component patterns in src/components/"]
- Required behavior: [e.g., "Must handle loading, error, and success states"]
- Edge cases: [e.g., "Handle missing token gracefully"]
- Props interface: [if critical to get right]

**Code Sketch** (only if logic is complex/non-obvious):

```[language]
// Show STRUCTURE, not complete implementation
// Focus on WHY, not WHAT
```

### Success Criteria:

#### Automated Verification:
- Tests pass: `tsdx test --no-watch`
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

#### Manual Verification:
- Component renders correctly in Storybook
- Feature works as expected when tested in example app
- Edge case handling verified manually
- No regressions in related features

### Session Completion
1. All changes committed: `git add -A && git commit -m "Phase 1: [description]"`
2. Update progress JSON: set phase 1 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Phase 2: [Descriptive Name]

### Overview

[What this phase accomplishes]

### Session Startup Protocol
1. Verify working directory: `pwd`
2. Check previous phase committed: `git log -1 --oneline`
3. Read progress JSON: `thoughts/shared/progress/{plan-name}-status.json`
4. Confirm current phase matches JSON `current_phase`

### Changes Required:

[Similar structure to Phase 1...]

### Success Criteria:

#### Automated Verification:
- Tests pass: `tsdx test --no-watch`
- Build succeeds: `tsdx build`
- Linting passes: `tsdx lint`

#### Manual Verification:
- [Phase-specific manual verification]

### Session Completion
1. All changes committed: `git add -A && git commit -m "Phase 2: [description]"`
2. Update progress JSON: set phase 2 to "complete", increment current_phase
3. Verify clean state: `git status` shows clean working tree

---

## Testing Strategy

**IMPORTANT: Follow Test-Driven Development (TDD) for all code**

### TDD Approach:

1. **For new files**: Create minimal structure first (empty functions with correct signatures) to prevent import errors
2. **For each feature**: Write failing test → Run test → Implement → Run test (pass) → Refactor
3. **Verify**: Run `tsdx test --no-watch` after each cycle

### Unit Tests:

- [What to test - written BEFORE implementation]
- [Key edge cases]

### Component Tests:

- Use @testing-library/react
- Follow existing patterns in `test/` directory
- Use mock setup from `test/mock.ts`

### Manual Testing Steps:

1. [Specific step to verify feature in Storybook]
2. [Another verification step]
3. [Edge case to test manually]

## Performance Considerations

[Any performance implications or optimizations needed]

## Migration Notes

[If applicable, how to handle existing data/systems]

## References

- Related research: `thoughts/shared/research/[relevant].md`
- Similar implementation: `[file:line]`
