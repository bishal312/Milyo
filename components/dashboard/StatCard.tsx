export default function ExportCard({ label, value, sub }: { label: string; value: string | number; sub: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-card-foreground">
                {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        </div>
    );
}