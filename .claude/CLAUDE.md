# Vault Core

React component library (`@apideck/react-vault`) for embedding Apideck Vault in React applications. Built with React 17, TypeScript, Tailwind CSS, and tsdx.

## Project Structure

```
src/
├── components/   - React components (Vault, Modal, ConnectionForm, etc.)
├── constants/    - API URLs, API list
├── styles/       - CSS files (base, custom)
├── types/        - TypeScript interfaces (Connection, Session, FormField)
├── utils/        - Hooks (useConnections, useSession), i18n, helpers
└── index.tsx     - Single export: Vault component
test/             - @testing-library/react tests
stories/          - Storybook stories
example/          - Example app
```

## Agents

Use specialized agents instead of exploring manually:

| Need | Agent |
|------|-------|
| Find files | `codebase-locator` |
| Understand how code works | `codebase-analyzer` |
| Find similar implementations | `codebase-pattern-finder` |
| Find existing research/plans | `thoughts-locator` |

## Test Commands

- **Unit tests**: `tsdx test` or `tsdx test <pattern>`
- **Lint**: `tsdx lint`
- **Build**: `tsdx build`
- **Storybook**: `yarn storybook`

## Commits

- Include `Co-Authored-By: Claude <noreply@anthropic.com>`
- Use `Ref #123`, never `Closes #123`
- Never commit directly to `main`

## Documents

- **Plans**: `thoughts/shared/plans/YYYY-MM-DD-description.md`
- **Research**: `thoughts/shared/research/YYYY-MM-DD-description.md`
