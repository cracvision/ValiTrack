/** Parse instruction text into numbered steps. Returns array of { index (1-based), text }. */
export function parseSteps(text: string | null | undefined): Array<{ index: number; text: string }> {
  if (!text || text.trim() === '') return [];

  const lines = text.split('\n');
  const steps: Array<{ index: number; text: string }> = [];
  let currentStep: { index: number; text: string } | null = null;

  for (const line of lines) {
    const match = line.match(/^(\d+)\.\s+(.*)/);
    if (match) {
      if (currentStep) steps.push(currentStep);
      currentStep = { index: parseInt(match[1], 10), text: match[2] };
    } else if (currentStep && line.trim()) {
      currentStep.text += '\n' + line;
    }
  }
  if (currentStep) steps.push(currentStep);
  return steps;
}
