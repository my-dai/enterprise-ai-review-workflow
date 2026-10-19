# Lessons Learned Review App

This folder contains the React and TypeScript interface I built for a sponsored
University of Michigan MDP project. The main screens cover lesson intake,
field-specific feedback, proposed revisions, keyword suggestions, library
references, duplicate checks, approvals, and reviewer follow-up.

The browser preview uses sample lessons and simulated service responses so the
review flow can be run locally. Power Apps bindings and organization-specific
SharePoint, environment, and flow configuration are not part of this public
repository.

## Run locally

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

In the sponsored project, the interface connects to Power Apps, Power Automate,
SharePoint, Copilot Studio, and organization-managed model flows. The local
adapters preserve the same request and review boundaries without requiring
those services.
