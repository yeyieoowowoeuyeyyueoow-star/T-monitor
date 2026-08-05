import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 p-8 text-center">
      <div className="text-6xl font-mono font-bold text-primary opacity-20">404</div>
      <h1 className="text-2xl font-mono font-bold text-foreground">SECTOR_NOT_FOUND</h1>
      <p className="text-muted-foreground font-mono text-sm">The requested interface path does not exist in the current sector.</p>
      <Link href="/" className="mt-8 px-6 py-2 border border-border bg-card hover:bg-muted text-foreground font-mono text-sm rounded transition-colors inline-block">
        RETURN_TO_BASE
      </Link>
    </div>
  );
}
