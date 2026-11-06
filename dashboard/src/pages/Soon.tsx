import { Plate } from '../components/Plate';

export function Soon({ title, line }: { title: string; line: string }) {
  return (
    <Plate still className="grid min-h-[320px] place-items-center p-10 text-center">
      <div>
        <h2 className="display text-4xl font-semibold">{title}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">{line}</p>
      </div>
    </Plate>
  );
}
