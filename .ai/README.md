# AI Assistant Configuration

This directory contains vendor-neutral instructions shared by every AI coding
assistant used in this repository.

## Structure

- `AGENTS.md` is the canonical repository entry point.
- `CLAUDE.md` is a compatibility adapter that imports `AGENTS.md`.
- `.ai/rules/` contains focused rules imported by `AGENTS.md`.
- Tool-specific directories may contain local settings, but must not duplicate
  project rules.

Add new shared instructions to `AGENTS.md` or a focused file under `.ai/rules/`,
then import that file from `AGENTS.md`. Do not duplicate project rules under a
tool-specific directory.
