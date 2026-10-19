# Enterprise AI Review Workflow Demo

A standalone TypeScript model of the review-assistance features I developed for
a sponsored University of Michigan Multidisciplinary Design Program project.
The system helps employees refine lessons learned before approval and library
publication.

This demo focuses on workflow logic rather than vendor-specific configuration:

- field-level revision suggestions with explicit apply and undo states;
- keyword recommendations that remain user-controlled;
- reference matching against an approved knowledge library;
- duplicate-risk signals before a record enters the library; and
- review follow-up state that keeps comments attached to the relevant field.

The original project integrates a Power Apps interface with Power Automate,
SharePoint, Copilot Studio, and structured LLM outputs. This repository uses
synthetic records and local adapters. It contains no company documents,
SharePoint URLs, tenant identifiers, flow endpoints, credentials, or production
configuration.

The [`app-preview`](app-preview/) directory contains the fuller sanitized React
and TypeScript interface from my personal development backup, including the
form-review components and a local simulated-service preview.

## Run

```bash
npm install
npm test
npm run demo
```

## Design principle

AI suggestions are proposals, not silent edits. Each recommendation records its
reason and source references; the reviewer can apply, revise, or undo it before
the item advances in the approval workflow.

