---
description: Create detailed implementation plans through interactive research and iteration
---


# Implementation Plan

You are tasked with creating detailed implementation plans through an interactive, iterative process. You should be skeptical, thorough, and work collaboratively with the user to produce high-quality technical specifications.

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:

   - If a file path or issue reference was provided as a parameter, skip the default message
   - Immediately read any provided files FULLY
   - Begin the research process

2. **If no parameters provided**, respond with:

```
I'll help you create a detailed implementation plan. Let me start by understanding what we're building.

Please provide:
1. The task/issue description (or reference to a GitHub issue)
2. Any relevant context, constraints, or specific requirements
3. Links to related research or previous implementations

I'll analyze this information and work with you to create a comprehensive plan.

Tip: You can also invoke this command with an issue reference directly: `/create_plan GitHub issue #1234`
For deeper analysis, try: `/create_plan think deeply about GitHub issue #1234`
```

Then wait for the user's input.

## Research Path Decision

After reading any provided files, determine which path to follow:

**PATH A: Comprehensive Research Available**

- User explicitly provides a research doc path, OR
- GitHub issue number mentioned AND matching research found in `thoughts/shared/research/*GH-XXXX*.md`
- **Flow**: Read research → Present summary → Get confirmation → Write plan (Step 4)

**PATH B: Lightweight Research Required**

- No comprehensive research document available
- **Flow**: Initial research → Deeper discovery → Structure development → Write plan (Step 4)

---

## PATH A: Using Comprehensive Research

### Step A1: Read Research Document

1. **Read the research document FULLY** into main context
2. **DO NOT read any other files directly** - trust the research document contains all necessary information

### Step A2: Present Summary and Get Confirmation

Present to user:

```
Based on the research at [path], I understand we need to [accurate summary].

Key findings from the research:
- [Key finding 1 with file:line reference from research]
- [Key finding 2 with pattern/constraint]
- [Important architectural decision]

The research was comprehensive and includes all implementation details.
I'm ready to create the implementation plan based on these findings.

Any clarifications or changes before I proceed?
```

### Step A3: Skip to Plan Writing

After user confirms, proceed directly to **Step 4: Write Plan**

---

## PATH B: Lightweight Research

**IMPORTANT**: Use extended thinking throughout this path to deeply reason about the problem space, architecture, and implementation approach.

As you think, consider:

- What assumptions am I making that need verification?
- What could break if related code changes?
- Are there edge cases not explicitly covered?
- How does this fit with existing architectural patterns?
- What dependencies or side effects exist?

### Step B1: Initial Context Gathering

1. **Read all mentioned files FULLY**:

   - Issue files (GitHub issues or `thoughts/shared/issues/*.md`)
   - If GitHub issue URL provided: use `gh issue view <number> --json title,body,labels,comments`
   - Any JSON/data files mentioned
   - **IMPORTANT**: Read entire files (no limit/offset parameters)

2. **Spawn initial research agents in parallel** with pattern-focused prompts:

   - **codebase-locator** - "Find all files related to [task]. Also identify utility functions for [common operations]"
   - **codebase-analyzer** - "Understand current implementation of [feature] and identify its interface contracts and dependencies"
   - **codebase-pattern-finder** - "Find reference implementations for similar [components/hooks/utilities] to identify structural patterns"
   - **thoughts-locator** - Find existing thoughts documents about this feature

   **Pattern Research is Contextual** - Look for patterns that match what you're building:

   - Working on a **component**? → Find other components with similar props/behavior
   - Working on a **hook**? → Find other custom hooks in `src/utils/`
   - Working on a **utility**? → Look at other utilities in the same directory
   - Adding to **existing component**? → Examine that component's existing patterns

   For each component type, focus on:

   - **Components:** Props interface patterns, state management, context usage, event handling
   - **Hooks:** State management, SWR usage, context providers, return types
   - **Utilities:** Function signatures, error handling, data transformation patterns
   - **Tests:** Testing library patterns, mock setup, act() usage

3. **Read all files identified by research agents FULLY**

4. **Think deeply and analyze**:

   - Cross-reference issue requirements with actual code
   - Identify discrepancies or misunderstandings
   - Note assumptions that need verification
   - Consider edge cases and architectural implications

5. **Present informed understanding**:

   ```
   Based on the issue and my research of the codebase, I understand we need to [accurate summary].

   I've found that:
   - [Current implementation detail with file:line reference]
   - [Relevant pattern or constraint discovered]
   - [Potential complexity or edge case identified]

   Questions that my research couldn't answer:
   - [Specific technical question that requires human judgment]
   - [Business logic clarification]
   - [Design preference that affects implementation]
   ```

   Only ask questions you genuinely cannot answer through code investigation.

### Step B2: Deeper Discovery

After getting initial clarifications:

1. **If user corrects any misunderstanding**:

   - DO NOT just accept the correction
   - Spawn new research agents to verify
   - Read the specific files/directories they mention
   - Only proceed once verified

2. **Create research todo list** using TodoWrite

3. **Spawn parallel research agents for deeper investigation**:

   - **codebase-locator** - Find more specific files
   - **codebase-analyzer** - Understand implementation details
   - **codebase-pattern-finder** - Find similar features to model after
   - **thoughts-locator** - Find research/plans/decisions about this area
   - **thoughts-analyzer** - Extract key insights from relevant documents

4. **Wait for ALL agents to complete**

5. **Think deeply about design options**:

   - Reason through multiple implementation approaches
   - Consider trade-offs, performance implications, maintainability
   - Evaluate alignment with existing patterns
   - Identify potential risks and mitigation strategies

6. **Present findings and design options**:

   ```
   Based on my research, here's what I found:

   **Current State:**
   - [Key discovery about existing code]
   - [Pattern or convention to follow]

   **Design Options:**
   1. [Option A] - [pros/cons]
   2. [Option B] - [pros/cons]

   **Open Questions:**
   - [Technical uncertainty]
   - [Design decision needed]

   Which approach aligns best with your vision?
   ```

### Step B3: Plan Structure Development

Once aligned on approach:

1. **Create initial plan outline following TDD structure**:

   ```
   Here's my proposed plan structure (following TDD red-green-refactor):

   ## Overview
   [1-2 sentence summary]

   ## Implementation Phases:
   1. Type/Interface Updates
   2. Write Tests for [Component A] (TDD - RED)
   3. Implement [Component A] (TDD - GREEN)
   4. Write Tests for [Component B] (TDD - RED)
   5. Implement [Component B] (TDD - GREEN)
   6. Integration Wiring
   7. Verify All Tests Pass (TDD - GREEN verification)
   8. Refactor (TDD - REFACTOR)

   Does this phasing make sense? Should I adjust the order or granularity?
   ```

   **Key principles for phase ordering**:
   - Start with type/interface changes (no tests needed)
   - For each component, pair RED (write tests) with GREEN (implement)
   - Integration/wiring near end (after all components exist)
   - Always end with verification and refactor phases

2. **Get feedback on structure** before writing details

---

## Step 4: Write Plan (Both Paths Converge Here)

After structure approval:

**TDD Phase Structure (MANDATORY):**

All implementation plans MUST follow Test-Driven Development (TDD). Structure phases using the red-green-refactor cycle:

1. **Type/Interface changes first** (if needed - no tests required for type additions)
2. **For each component to implement**:
   - **Phase N: Write Tests (RED)**: Write failing tests for the component
   - **Phase N+1: Implement (GREEN)**: Implement just enough to make tests pass
3. **Final phases**:
   - **Phase X: Integration Wiring**: Wire up all dependencies and exports
   - **Phase Y: Verify All Tests Pass**: Run full test suite
   - **Phase Z: Refactor (REFACTOR)**: Clean up code while keeping tests green

**Example phase naming**:
- Phase 1: Type/Interface Updates
- Phase 2: Write Tests for ConnectionStatus Component (TDD - RED)
- Phase 3: ConnectionStatus Component Implementation (TDD - GREEN)
- Phase 4: Write Tests for useConnectionStatus Hook (TDD - RED)
- Phase 5: useConnectionStatus Hook Implementation (TDD - GREEN)
- Phase 6: Integration Wiring
- Phase 7: Verify All Tests Pass (TDD - GREEN verification)
- Phase 8: Refactor (TDD - REFACTOR)

**Test-First Guidelines**:
- Tests MUST be written BEFORE implementation for each component
- Each RED phase should specify:
  - Test file location
  - Specific test cases to write
  - Expected outcome: "All tests FAIL (function doesn't exist yet)"
- Each GREEN phase should reference the tests from previous RED phase
- Include refactor phase at end for cleanup while tests stay green

**Document Pattern Decisions:**
At the top of the plan (before Overview), include a "Pattern Decisions" section that documents:

```markdown
**Pattern Decisions**:

- [Component] pattern: [chosen approach] (based on: [reference file])
- [Another component]: [pattern] (based on: [reference])
- Utilities identified: [list with file paths]
- Interfaces/Types to update: [list]
```

Example:

```markdown
**Pattern Decisions**:

- Component pattern: Functional component with Props interface (based on: ConnectionForm.tsx)
- Hook pattern: SWR-based data fetching (based on: useConnections.tsx)
- Utilities identified: connectionActions (utils/connectionActions.ts)
- Types to update: Connection interface (types/Connection.ts)
```

1. **Write the plan** to `thoughts/shared/plans/YYYY-MM-DD-GH-XXXX-description.md`

   - Format: `YYYY-MM-DD-GH-XXXX-description.md` where:
     - YYYY-MM-DD is today's date
     - GH-XXXX is the GitHub issue number (omit if no issue)
     - description is a brief kebab-case description
   - Examples:
     - With issue: `2025-01-08-GH-1478-connection-status.md`
     - Without issue: `2025-01-08-improve-error-handling.md`

2. **Use the template at `.claude/templates/implementation_plan.md`** as the structure for the plan

3. **Generate progress JSON** at `thoughts/shared/progress/{plan-name}-status.json`

   Extract phase information from the plan and create a status file:
   ```json
   {
     "plan": "{plan-name}.md",
     "current_phase": 1,
     "total_phases": [count of phases in the plan],
     "phases": [
       {"id": 1, "name": "[Phase 1 name from plan]", "status": "pending"},
       {"id": 2, "name": "[Phase 2 name from plan]", "status": "pending"},
       ...
     ]
   }
   ```

### Step 5: Sync and Review

1. **Present the draft plan location**:

   ```
   I've created the initial implementation plan at:
   `thoughts/shared/plans/YYYY-MM-DD-GH-XXXX-description.md`

   Progress tracker created at:
   `thoughts/shared/progress/YYYY-MM-DD-GH-XXXX-description-status.json`

   Please review the plan and let me know:
   - Are the phases properly scoped?
   - Are the success criteria specific enough?
   - Any technical details that need adjustment?
   - Missing edge cases or considerations?
   ```

2. **Iterate based on feedback** - be ready to:

   - Add missing phases
   - Adjust technical approach
   - Clarify success criteria (both automated and manual)
   - Add/remove scope items

3. **Continue refining** until the user is satisfied

## Important Guidelines

1. **Be Skeptical**:

   - Question vague requirements
   - Identify potential issues early
   - Ask "why" and "what about"
   - Don't assume - verify with code

1. **Do NOT Include**:

   - Time estimates or effort calculations (wasted tokens, no value)
   - Timeline projections or duration guesses
   - Any section not explicitly in the template

1. **Be Interactive**:

   - Don't write full plan in one shot (except when comprehensive research available)
   - Get buy-in at each step during lightweight research
   - Allow course corrections at any stage
   - Work collaboratively throughout the process

1. **Be Thorough**:

   - Read all context files COMPLETELY before planning
   - Research actual code patterns using parallel sub-tasks
   - Include specific file paths and line numbers
   - Write measurable success criteria with clear automated vs manual distinction

1. **Be Practical**:

   - Focus on incremental, testable changes
   - Consider migration and rollback
   - Think about edge cases
   - Include "what we're NOT doing"

1. **Follow TDD Structure**:

   - ALWAYS structure phases around red-green-refactor cycle
   - Type/interface changes first (no tests needed for types)
   - For each component: Write Tests (RED) → Implement (GREEN)
   - End with: Integration Wiring → Verify Tests Pass → Refactor
   - Label each phase clearly: "(TDD - RED)", "(TDD - GREEN)", "(TDD - REFACTOR)"
   - Specify expected test outcomes in each phase

1. **Write Intent-Focused Code Guidance**:

   The implementation agent will read actual files and use specialized agents to analyze patterns. Don't write complete implementations - focus on INTENT and CONSTRAINTS.

   **For each change, provide**:

   - **Location**: File path + line numbers or method name
   - **What to change**: Brief description (e.g., "Add ConnectionStatus component")
   - **Key implementation notes**: Critical decisions as bullet points
   - **Optional code sketch**: Only when the approach is non-obvious

1. **Track Progress**:

   - Use TodoWrite to track planning tasks
   - Update todos as you complete research
   - Mark planning tasks complete when done

1. **When to Stop and Ask**:

   You should work autonomously as much as possible, but stop and ask when:

   - Files or components referenced in the issue/requirements don't exist
   - Requirements directly contradict each other or existing code patterns
   - You need business logic decisions that only the user can make
   - Multiple valid implementation approaches exist with significantly different trade-offs
   - Your proposed implementation would break established codebase patterns
   - After thorough research, you still can't resolve a critical technical uncertainty

1. **No Open Questions in Final Plan**:
   - If you encounter open questions during planning, STOP
   - Research or ask for clarification immediately
   - Do NOT write the plan with unresolved questions
   - The implementation plan must be complete and actionable
   - Every decision must be made before finalizing the plan

## Common Patterns

### For New Components:

- Research existing component patterns first
- Start with types/interfaces
- Build component logic
- Add styling with Tailwind
- Write tests

### For New Hooks:

- Research similar hooks in src/utils/
- Define return type interface
- Implement hook logic
- Add to relevant provider if needed
- Write tests

### For Refactoring:

- Document current behavior
- Plan incremental changes
- Maintain backwards compatibility
- Include migration strategy

## Sub-task Spawning Best Practices

When spawning research sub-tasks:

1. **Spawn multiple tasks in parallel** for efficiency
2. **Each task should be focused** on a specific area
3. **Provide detailed instructions** including:
   - Exactly what to search for
   - Which directories to focus on
   - What information to extract
   - Expected output format
4. **Be specific about directories**:
   - For components, specify `src/components/` directory
   - For hooks/utilities, specify `src/utils/` directory
   - For types, specify `src/types/` directory
   - For tests, specify `test/` directory
5. **Specify read-only tools** to use
6. **Request specific file:line references** in responses
7. **Wait for all tasks to complete** before synthesizing
8. **Verify sub-task results**:
   - If a sub-task returns unexpected results, spawn follow-up tasks
   - Cross-check findings against the actual codebase
   - Don't accept results that seem incorrect
