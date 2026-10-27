#!/usr/bin/env python3
"""Blocks edits to files a repository skill owns until that skill is loaded.

PreToolUse hook for Edit, Write, MultiEdit, and Bash. The routing mirrors the
"Agent Skills" table in AGENTS.md; change both together.
"""

import json
import os
import re
import sys

ROUTES = [
    ('investflow-domain-application', [r'^libs/[^/]+/(domain|application)/']),
    ('investflow-nestjs-infrastructure', [r'^libs/[^/]+/infrastructure/', r'^apps/api/']),
    (
        'investflow-eventing',
        [
            r'\.events?\.ts$',
            r'\.consumer\.ts$',
            r'^libs/shared/infrastructure/src/lib/messaging/',
            r'(^|/)unit-of-work[^/]*$',
            r'^infra/floci/',
        ],
    ),
    ('investflow-react', [r'^apps/web/', r'^libs/[^/]+/web/']),
    ('investflow-outbox-benchmark', [r'^tools/benchmarks/']),
]

# Code that raises, records, or consumes an event needs the eventing skill
# wherever it lives, such as a new apply() in an aggregate.
EVENT_CODE = re.compile(r'apply\(\s*new\s|\.record\(|@OnEvent\(')

# Only the files a shell command writes count; files it merely reads (cat,
# grep, sed -n, a redirect into the scratchpad) must not be blocked.
PATH = r"[\w./@-]+"
IN_PLACE = re.compile(r"\b(?:sed\s+-i\S*|perl\s+-\w*i\w*)\s+(.*)")
REDIRECT = re.compile(rf"(?:>{{1,2}}|\btee\s+(?:-a\s+)?)\s*({PATH})")
MOVE = re.compile(rf"\b(?:mv|cp)\s+(?:-\w+\s+)*{PATH}\s+({PATH})")
REMOVE = re.compile(rf"\brm\s+(?:-\w+\s+)*((?:{PATH}\s*)+)")
SCRIPT_WRITE = re.compile(r"open\([^)]*['\"][wa]['\"]|write_text\(|\.write\(")
SCRIPT_PATH = re.compile(r"['\"]([\w./@-]+\.\w+)['\"]")
FILE_ARGUMENT = re.compile(rf"(?<![\w-])({PATH}\.\w+)\b")


def shell_targets(command):
    targets = []
    for segment in re.split(r"&&|\|\||;|\||\n", command):
        match = IN_PLACE.search(segment)
        if match:
            targets += FILE_ARGUMENT.findall(match.group(1))
        targets += REDIRECT.findall(segment)
        targets += MOVE.findall(segment)
        for removed in REMOVE.findall(segment):
            targets += removed.split()
    # Inline scripts (python3 - <<EOF) write through variables, so every
    # quoted file path in a script that writes counts.
    if SCRIPT_WRITE.search(command):
        targets += SCRIPT_PATH.findall(command)
    return targets

# Anchored to the transcript's own JSON (unescaped quotes), so a tool output
# that merely quotes these markers does not count as a load.
LOADED = re.compile(
    rb'"text":"Base directory for this skill: [^"\\]*?/(investflow-[a-z-]+)'
    rb'|"skill":"(investflow-[a-z-]+)"'
)


def relative(path, root, base=None):
    path = os.path.normpath(os.path.join(base or root, path))
    return os.path.relpath(path, root) if path.startswith(root + os.sep) else None


# A shell resolves relative paths against its working directory, which may be
# a subfolder or move with a leading `cd dir &&`.
def shell_directory(command, cwd):
    match = re.match(rf"\s*cd\s+({PATH})\s*&&", command)
    return os.path.join(cwd, match.group(1)) if match else cwd


def required_for_path(path):
    return {skill for skill, patterns in ROUTES if any(re.search(p, path) for p in patterns)}


def edit_targets(tool, tool_input, root, cwd):
    if tool in ('Edit', 'Write', 'MultiEdit'):
        path = relative(tool_input.get('file_path', ''), root)
        content = tool_input.get('new_string') or tool_input.get('content') or ''
        content += ''.join(e.get('new_string', '') for e in tool_input.get('edits', []))
        return ([path] if path else []), content
    if tool == 'Bash':
        command = tool_input.get('command', '')
        base = shell_directory(command, cwd)
        paths = [relative(p, root, base) for p in shell_targets(command)]
        return [p for p in paths if p], command
    return [], ''


# A subagent's hook input carries the parent session's transcript_path plus
# its agent_id; its own transcript sits beside the parent's. Only its own
# counts: a subagent starts without the skills its parent loaded.
def transcript_of(hook):
    transcript = hook.get('transcript_path') or ''
    agent_id = hook.get('agent_id')
    if agent_id and transcript.endswith('.jsonl'):
        return [os.path.join(transcript[: -len('.jsonl')], 'subagents', f'agent-{agent_id}.jsonl')]
    return [transcript] if transcript else []


def loaded_skills(transcripts):
    loaded = set()
    for transcript in transcripts:
        try:
            with open(transcript, 'rb') as file:
                text = file.read()
        except OSError:
            continue
        for match in LOADED.finditer(text):
            loaded.add((match.group(1) or match.group(2)).decode())
    return loaded


def main():
    hook = json.load(sys.stdin)
    root = os.path.normpath(os.environ.get('CLAUDE_PROJECT_DIR') or hook.get('cwd', ''))
    cwd = os.path.normpath(hook.get('cwd') or root)
    paths, content = edit_targets(hook.get('tool_name'), hook.get('tool_input') or {}, root, cwd)
    if not paths:
        return

    required = set().union(*(required_for_path(p) for p in paths))
    if EVENT_CODE.search(content) and any(p.endswith('.ts') for p in paths):
        required.add('investflow-eventing')
    if not required:
        return

    missing = sorted(required - loaded_skills(transcript_of(hook)))
    if not missing:
        return

    names = ', '.join(f'`{skill}`' for skill in missing)
    json.dump(
        {
            'hookSpecificOutput': {
                'hookEventName': 'PreToolUse',
                'permissionDecision': 'deny',
                'permissionDecisionReason': (
                    f'Load {names} with the Skill tool before changing {", ".join(paths)}. '
                    'AGENTS.md ("Agent Skills") routes these files to it; follow its rules '
                    'for this change, then retry the edit.'
                ),
            }
        },
        sys.stdout,
    )


if __name__ == '__main__':
    main()
