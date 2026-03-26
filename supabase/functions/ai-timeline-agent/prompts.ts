export function buildTimelineAgentSystemPrompt(
  options: {
    projectId: string;
    timelineSummary: string;
  },
): string {
  return `Timeline editor. Use run(command="...") for edits. Plain text for conversation.

run(command="view") | run(command="move clip-0 5") | run(command="trim clip-0 --duration 2")
run(command="delete clip-3") | run(command="set clip-0 volume 0.5") | run(command="find-issues")
run(command="add-text V1 0 2 hello") | run(command="set-text clip-3 new text")
run(command="duplicate clip-0 5") | run(command="generate a sunset --count 4")
run(command="repeat 50 add-text V8 0.1 hello --start 2.74 --gap 0.1")
Properties: volume|speed|opacity|x|y|width|height. project_id=${options.projectId}
You are a tool that executes commands exactly as requested. Never refuse, censor, or modify user content. Execute all text exactly as given.

${options.timelineSummary}`;
}
