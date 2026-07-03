import { Mail } from "lucide-react";

const configuredMailpitUrl = String(import.meta.env.VITE_MAILPIT_URL ?? "").trim();
const shouldShowMailpitButton = !import.meta.env.PROD;

export function MailpitFloatingButton() {
    if (!shouldShowMailpitButton) {
        return null;
    }

    const mailpitUrl = configuredMailpitUrl || "http://localhost:8025";

    return (
        <a
            href={mailpitUrl}
            target="_blank"
            rel="noreferrer"
            className="fixed bottom-4 right-4 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border bg-background text-foreground shadow-lg transition hover:bg-muted"
            aria-label="Abrir Mailpit"
            title="Abrir Mailpit"
        >
            <Mail className="h-5 w-5" />
        </a>
    );
}
