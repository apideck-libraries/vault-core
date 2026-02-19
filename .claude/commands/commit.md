---
description: Create git commits with user approval
---

# Commit Changes

You are tasked with creating git commits for the changes made during this session.

## Process:

1. **Think about what changed:**

   - Review the conversation history and understand what was accomplished
   - Run `git status` to see current changes
   - Run `git diff` to understand the modifications
   - Consider whether changes should be one commit or multiple logical commits

2. **Plan your commit(s):**

   - Identify which files belong together
   - Draft clear, descriptive commit messages
   - Use imperative mood in commit messages
   - Focus on why the changes were made, not just what

3. **Present your plan to the user:**

   - List the files you plan to add for each commit
   - Show the commit message(s) you'll use
   - Ask: "I plan to create [N] commit(s) with these changes. Shall I proceed?"

4. **Execute upon confirmation:**
   - Use `git add` with specific files (never use `-A` or `.`)
   - Create commits using heredoc format for proper multi-line formatting:
     ```bash
     git commit -m "$(cat <<'EOF'
     Your commit message here

     Additional details if needed

     Co-Authored-By: Claude <noreply@anthropic.com>
     EOF
     )"
     ```
   - Show the result with `git log --oneline -n [number]`

## When to Stop and Ask

You should work autonomously as much as possible, but stop and ask when:
- You see uncommitted changes but don't have context on what was done (not in this session)
- Changes span multiple unrelated features and you're unsure how to split them
- Git history shows you're not on a feature branch and changes might affect main/master
- There are merge conflicts or unusual git states you need help resolving
- Files contain sensitive data (credentials, API keys) that shouldn't be committed

When blocked, explain what you see in `git status` and `git diff`, and ask how to proceed.

## Remember:

- You have the full context of what was done in this session
- Group related changes together
- Keep commits focused and atomic when possible
- The user trusts your judgment - they asked you to commit
