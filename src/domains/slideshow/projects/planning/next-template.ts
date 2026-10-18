type LoopTemplate = { id: string; templateOrder: number | null };
type LoopContent = { id: string; sourceTemplateId: string | null; publishedAt: string | null };

/** Dashboard and MCP follow the same current-parent history and publication ordering. */
export function nextTemplateInLoop<T extends LoopTemplate>(templates: readonly T[], projects: readonly LoopContent[]): T | null {
  const active = templates.filter(template => template.templateOrder !== null)
    .sort((a, b) => a.templateOrder! - b.templateOrder!);
  if (!active.length) return null;
  const templateIds = new Set(active.map(template => template.id));
  let latest: LoopContent | undefined;
  for (const project of projects) {
    if (!project.publishedAt || !templateIds.has(project.sourceTemplateId ?? "")) continue;
    if (!latest || project.publishedAt > latest.publishedAt! ||
      (project.publishedAt === latest.publishedAt && project.id > latest.id)) latest = project;
  }
  const lastIndex = latest ? active.findIndex(template => template.id === (latest.sourceTemplateId ?? "")) : -1;
  return active[(lastIndex + 1) % active.length];
}
