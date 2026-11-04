/** Extract only the user-facing text from complete or incremental structured output. */
export function answerText(output: string): string | undefined {
  if (!output.trimStart().startsWith("{")) return;
  const match = output.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!match) return;
  try { return JSON.parse(`"${match[1]}"`) as string; }
  catch { return; } // Wait for the rest of an incomplete escape sequence.
}
