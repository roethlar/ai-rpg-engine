#!/bin/bash
cd /Users/michael/Dev/ai-rpg-engine
git hash-object docs/runtime-greenfield-plan.md > .agents/review/r5-pincheck.txt
codex exec --sandbox read-only \
  -c 'model="gpt-5.6-sol"' -c 'model_reasoning_effort="xhigh"' \
  resume 019f7565-0f17-71d3-a520-bef2564caf0d - \
  < .agents/review/r5-prompt.txt \
  > .agents/review/r5-out.txt 2> .agents/review/r5-err.log
echo "exit:$?" >> .agents/review/r5-pincheck.txt
