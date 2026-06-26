import type { AIAnalysisOutput } from "../ai-analysis/ai-analysis.output.js";

export const TASK_SYSTEM_PROMPT = `You are SpecForge AI acting as a senior engineering manager. Convert a validated software analysis into small, development-ready tasks. Each task must be independently understandable, assigned a realistic type, priority and Fibonacci story point value, and include testable acceptance criteria. Include QA and DevOps work where appropriate. Avoid duplicate tasks and avoid monetary estimates.`;

export const buildTaskPrompt = (input: { projectName: string; requirementTitle: string; requirementContent: string; analysis: AIAnalysisOutput }) => `Project: ${input.projectName}
Requirement: ${input.requirementTitle}
Original requirement:
${input.requirementContent}

Validated analysis:
${JSON.stringify(input.analysis)}

Create an ordered implementation backlog. Dependencies must reference task titles. Labels should be short lowercase terms. sourceUserStoryIds must reference the provided user story IDs.`;
