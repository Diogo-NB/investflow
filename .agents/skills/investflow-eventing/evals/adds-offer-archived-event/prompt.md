---
tags: [investflow-eventing]
max_turns: 120
timeout_seconds: 2400
allowed_tools: [Read, Glob, Grep, Skill, Bash, Edit, Write]
---

users want to archive offers they no longer use instead of deleting them. an archived offer keeps its simulations as they are but cant be picked for new simulations, and it can be unarchived. other parts of the system should be able to react to an offer being archived. implement it
