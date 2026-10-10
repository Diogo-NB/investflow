@AGENTS.md

## Claude Code Notes

`AGENTS.md` (imported above) is the single source of truth shared with Codex;
edit it there rather than duplicating guidance here.

Repository skills live in `.agents/skills/` and are symlinked into
`.claude/skills/`. References written as `$skill-name` (Codex syntax) mean the
same skill in Claude Code: invoke it with the Skill tool or `/skill-name`. When
adding a new skill, create it under `.agents/skills/<name>/` and add a matching
symlink: `ln -s ../../.agents/skills/<name> .claude/skills/<name>`.
