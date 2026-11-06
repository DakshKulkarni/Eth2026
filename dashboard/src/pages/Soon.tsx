import { Spotlight } from '../components/Spotlight';

export function Soon({ title, line }: { title: string; line: string }) {
  return (
    <Spotlight className="grid min-h-[320px] place-items-center p-10 text-center">
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{line}</p>
      </div>
    </Spotlight>
  );
}
