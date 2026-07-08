type SystemMessageLine =
  | { type: 'change'; label: string; from: string; to: string }
  | { type: 'text'; text: string };

const formatActivityTimestamp = (date: Date): string =>
  date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const stripBullet = (line: string): string => line.replace(/^[-•]\s*/, '').trim();

const parseSystemMessageLine = (line: string): SystemMessageLine => {
  const text = stripBullet(line);
  const arrow = text.includes('→') ? '→' : text.includes('->') ? '->' : null;

  if (!arrow) {
    return { type: 'text', text };
  }

  const [left, right] = text.split(arrow);
  const colonIndex = left.indexOf(':');

  if (colonIndex === -1 || !right?.trim()) {
    return { type: 'text', text };
  }

  const label = left.slice(0, colonIndex).trim();
  const from = left.slice(colonIndex + 1).trim();
  const to = right.trim();

  return label && from && to
    ? { type: 'change', label, from, to }
    : { type: 'text', text };
};

const parseSystemMessage = (content: string): { title: string; lines: SystemMessageLine[] } => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { title: 'Actualización automática', lines: [] };
  }

  if (/^[-•]\s*/.test(lines[0])) {
    return {
      title: 'Actualización automática',
      lines: lines.map(parseSystemMessageLine),
    };
  }

  const [title, ...details] = lines;

  return {
    title: title.replace(/:$/, ''),
    lines: details.map(parseSystemMessageLine),
  };
};

const SystemMessageActivity = ({
  content,
  createdAt,
}: {
  content: string;
  createdAt: Date;
}) => {
  const parsed = parseSystemMessage(content);

  return (
    <div className="relative w-full py-1 pl-6 sm:pl-8">
      <span className="absolute bottom-[-0.75rem] left-[7px] top-3 w-px bg-border sm:left-[11px]" />
      <span className="absolute left-0 top-3 h-4 w-4 rounded-full border-2 border-primary bg-background sm:left-1" />
      <div className="w-full rounded-md border bg-background px-3 py-2.5 shadow-sm sm:max-w-[90%]">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Actividad
          </span>
          <span className="text-xs text-muted-foreground">
            Sistema · {formatActivityTimestamp(createdAt)}
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold leading-5 text-foreground">{parsed.title}</p>
          {parsed.lines.length > 0 && (
            <div className="space-y-1.5">
              {parsed.lines.map((line, index) =>
                line.type === 'change' ? (
                  <div key={`${line.label}-${index}`} className="rounded-md bg-muted/40 px-2.5 py-2">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {line.label}
                    </p>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="max-w-full break-words rounded-full bg-background px-2 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                        {line.from}
                      </span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="max-w-full break-words rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        {line.to}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p
                    key={`${line.text}-${index}`}
                    className="rounded-md bg-muted/30 px-2.5 py-2 text-sm leading-5 text-muted-foreground"
                  >
                    {line.text}
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemMessageActivity;
