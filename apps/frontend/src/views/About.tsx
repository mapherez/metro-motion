const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]";

export function About() {
  const year = new Date().getFullYear();
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Sobre o projeto</h1>
      <p className="text-muted">
        Metro Lisboa Live mostra o mapa em tempo quase real com posicao de comboios e tempos de chegada estimados.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <a
            className={`text-[var(--link)] underline transition-colors hover:text-[var(--fg)] ${focusRing}`}
            href="https://github.com/teu-username"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </li>
        <li>
          <a
            className={`text-[var(--link)] underline transition-colors hover:text-[var(--fg)] ${focusRing}`}
            href="https://www.linkedin.com/in/teu-username"
            target="_blank"
            rel="noreferrer"
          >
            LinkedIn
          </a>
        </li>
        <li>
          <a
            className={`text-[var(--link)] underline transition-colors hover:text-[var(--fg)] ${focusRing}`}
            href="https://twitter.com/teu-username"
            target="_blank"
            rel="noreferrer"
          >
            Twitter/X
          </a>
        </li>
      </ul>
      <p className="text-sm text-muted">{`Copyright (c) ${year} Pedro`}</p>
    </div>
  );
}
