# Lessons Learned Review App Preview

This folder is a sanitized backup of the React and TypeScript interface I built
for a sponsored University of Michigan MDP project. It shows how AI assistance
fits into an employee review workflow: field-specific feedback, proposed
revisions with apply/undo controls, keyword suggestions, library references,
duplicate-risk checks, and reviewer follow-up.

The local preview uses synthetic lessons and simulated AI responses. Generated
Power Apps bindings, SharePoint data models, tenant and environment identifiers,
flow endpoints, credentials, and company records are intentionally excluded.

## Run the portfolio preview

```bash
npm install
npm run build:preview
npm run dev:preview
```

Then open `http://127.0.0.1:5187/preview/`.

## Test the workflow logic

```bash
npm run test:portfolio
```

The original deployment connects the same interface patterns to Power Apps,
Power Automate, SharePoint, Copilot Studio, and organization-managed AI flows.
Those connectors are represented here by local adapters so the public project
is runnable without exposing deployment details.
