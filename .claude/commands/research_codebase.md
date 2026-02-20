---
description: Document codebase as-is with thoughts directory for historical context
---

# Research Codebase

You are tasked with conducting comprehensive research across the codebase to answer user questions by spawning parallel sub-agents and synthesizing their findings.

## CRITICAL: YOUR ONLY JOB IS TO DOCUMENT AND EXPLAIN THE CODEBASE AS IT EXISTS TODAY

- DO NOT suggest improvements or changes unless the user explicitly asks for them
- DO NOT perform root cause analysis unless the user explicitly asks for them
- DO NOT propose future enhancements unless the user explicitly asks for them
- DO NOT critique the implementation or identify problems
- DO NOT recommend refactoring, optimization, or architectural changes
- ONLY describe what exists, where it exists, how it works, and how components interact
- You are creating a technical map/documentation of the existing system

## Initial Setup:

When this command is invoked, respond with:

```
I'm ready to research the codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.
```

Then wait for the user's research query.

## Steps to follow after receiving the research query:

1. **Read any directly mentioned files first:**

   - If the user mentions specific files (tickets, docs, JSON), read them FULLY first
   - If GitHub issue URL provided: use `gh issue view <number> --json title,body,labels,comments`
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning any sub-tasks
   - This ensures you have full context before decomposing the research

2. **Analyze and decompose the research question:**

   - Break down the user's query into composable research areas
   - Take time to think deeply about the underlying patterns, connections, and architectural implications the user might be seeking
   - Identify specific components, patterns, or concepts to investigate
   - Create a research plan using TodoWrite to track all subtasks
   - Consider which directories, files, or architectural patterns are relevant

3. **Spawn parallel sub-agent tasks for comprehensive research:**

   Create multiple Task agents to research different aspects concurrently:

   ### **Codebase Structure:**

   ```
   src/
   ├── components/   → React components
   ├── constants/    → API URLs, API list
   ├── styles/       → CSS files
   ├── types/        → TypeScript interfaces
   ├── utils/        → Hooks, helpers, i18n
   └── index.tsx     → Single export
   test/             → Test files
   ```

   ### **Available Agents:**

   - **codebase-locator** - Find WHERE files/components are
   - **codebase-analyzer** - Analyze how code works with file:line references
   - **codebase-pattern-finder** - Find pattern examples

   **Documentation Domain:**

   - **thoughts-locator** - Find existing research/documentation
   - **thoughts-analyzer** - Extract insights from specific documents

   **External Research (only if user explicitly asks):**

   - **web-search-researcher** - External documentation and resources

   ### **Agent Usage Guidelines:**

   - **IMPORTANT**: All agents are documentarians, not critics
   - Start with locator agents to find what exists
   - Then use analyzer agents to document how things work
   - Run multiple agents in parallel for different aspects
   - Each agent knows its job - just tell it what you're looking for
   - Remind agents they are documenting, not evaluating

4. **Wait for all sub-agents to complete and synthesize findings:**

   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results (codebase and thoughts findings)
   - Prioritize live codebase findings as primary source of truth
   - Use thoughts/ findings as supplementary historical context
   - Connect findings across different components
   - Include specific file paths and line numbers for reference
   - Verify all thoughts/ paths are correct
   - Highlight patterns, connections, and architectural decisions
   - Answer the user's specific questions with concrete evidence

5. **Generate research document:**

   - Filename: `thoughts/shared/research/YYYY-MM-DD-GH-XXXX-description.md`
     - Format: `YYYY-MM-DD-GH-XXXX-description.md` where:
       - YYYY-MM-DD is today's date
       - GH-XXXX is the GitHub issue number (omit if no issue)
       - description is a brief kebab-case description of the research topic

   - Structure the document:

     ```markdown
     # Research: [User's Question/Topic]

     **Date**: [Today's date]
     **Related Issue**: [GitHub issue URL if applicable]

     ## Research Question

     [Original user query]

     ## Summary

     [High-level documentation of what was found, answering the user's question by describing what exists]

     ## Detailed Findings

     ### [Component/Area 1]

     - Description of what exists ([file.ext:line](link))
     - How it connects to other components
     - Current implementation details (without evaluation)

     ### [Component/Area 2]

     ...

     ## Code References

     - `path/to/file.ts:123` - Description of what's there
     - `another/file.ts:45-67` - Description of the code block

     ## Architecture Documentation

     [Current patterns, conventions, and design implementations found in the codebase]

     ## Historical Context (from thoughts/)

     [Relevant insights from thoughts/ directory with references]

     ## Related Research

     [Links to other research documents in thoughts/shared/research/]

     ## Open Questions

     [Any areas that need further investigation]
     ```

6. **Sync and present findings:**

   - Run `git add thoughts/` to stage the new research document
   - Present a concise summary of findings to the user
   - Include key file references for easy navigation
   - Ask if they have follow-up questions or need clarification

7. **Handle follow-up questions:**
   - If the user has follow-up questions, append to the same research document
   - Add new section: `## Follow-up Research [timestamp]`
   - Spawn new sub-agents as needed
   - Continue updating the document

## When to Stop and Ask

You should work autonomously as much as possible, but stop and ask when:
- User's research question is too vague to decompose into specific investigations
- You can't find any relevant code or documentation after thorough searching
- You discover the feature/component the user asked about doesn't exist
- User references external systems or documentation you don't have access to
- Research reveals the answer requires domain knowledge outside the codebase

When blocked, explain what you searched for, what you found (or didn't find), and ask for clarification.

## Important notes:

- Always use parallel Task agents to maximize efficiency
- Always run fresh codebase research
- Focus on finding concrete file paths and line numbers
- Research documents should be self-contained
- Each sub-agent prompt should be focused on read-only documentation
- Document cross-component connections
- **CRITICAL**: You and all sub-agents are documentarians, not evaluators
- **REMEMBER**: Document what IS, not what SHOULD BE
- **NO RECOMMENDATIONS**: Only describe the current state
- **File reading**: Always read mentioned files FULLY before spawning sub-tasks
