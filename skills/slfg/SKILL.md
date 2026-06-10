---
name: slfg
description: Full autonomous engineering workflow using swarm mode for parallel execution
argument-hint: "[feature description]"
disable-model-invocation: true
---

Swarm-enabled LFG. Run these steps in order, parallelizing where indicated. Do not stop between steps — complete every step through to the end.

## Sequential Phase

1. **Optional:** If the `ralph-loop` skill is available, run `/ralph-loop-ralph-loop "finish all slash commands" --completion-promise "DONE"`. If not available or it fails, skip and continue to step 2 immediately.
2. `/ce-plan $ARGUMENTS` — **Record the plan file path** from `docs/plans/` for steps 4 and 6.
3. `ce-work` — **Use swarm mode**: make a platform task list and launch isolated subagents to build the plan

## Parallel Phase

After work completes, launch steps 4 and 5 as **parallel swarm agents** (both only need code to be written):

4. `ce-code-review mode:agent plan:<plan-path-from-step-2>` — spawn as background subagent/task for read-only review
5. `ce-test-browser` — spawn as a background subagent/task

Wait for both to complete before continuing.

## Review Fix Phase

6. `ce-code-review plan:<plan-path-from-step-2>` — run sequentially after the parallel phase using the normal interactive flow so it can safely mutate the checkout, apply safe verified fixes, and emit residual todos for step 7. Do not pass deprecated autofix-mode tokens.

## Finalize Phase

7. `todo-resolve` — resolve findings, compound on learnings, clean up completed todos
8. `ce-demo-reel` — record the final walkthrough and add to PR
9. Output `<promise>DONE</promise>` when video is in PR

Start with step 1 now.
