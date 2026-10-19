# Enterprise AI Review Workflow

[![Test](https://github.com/my-dai/enterprise-ai-review-workflow/actions/workflows/test.yml/badge.svg)](https://github.com/my-dai/enterprise-ai-review-workflow/actions/workflows/test.yml)

I developed this workflow for a sponsored University of Michigan
Multidisciplinary Design Program project. It supports the review of lessons
learned before they are approved and published to an internal knowledge
library.

The public code covers the parts of the system I worked on that can run without
company services:

- field-specific feedback and proposed revisions with apply and undo;
- keyword suggestions that the author can accept or revise;
- reference matching against an approved lesson library;
- duplicate-risk checks before publication; and
- review comments that remain attached to the relevant field across revisions.

The project stack includes Power Apps, Power Automate, SharePoint, Copilot
Studio, React, TypeScript, and structured model responses. Company records and
deployment settings are replaced here with local fixtures and adapters.

## Repository layout

- `src/` contains a small, testable model of revision, library-match, and
  follow-up behavior.
- `app-preview/` contains the React interface and a browser preview backed by
  simulated services.
- `tests/` covers suggestion state, reference ranking, and review follow-up.

## Run

```bash
npm install
npm test
npm run demo
```

To run the full interface:

```bash
cd app-preview
npm install
npm run test:portfolio
npm run dev:preview
```

## Design principle

Suggestions never change an author’s text automatically. The interface keeps
the recommendation, reason, and source references visible, and the reviewer can
apply, revise, or undo a change before the lesson advances.

