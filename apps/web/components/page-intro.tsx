import type { ReactNode } from "react";

type PageIntroProps = {
  eyebrow: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function PageIntro({ aside, children, eyebrow, title }: PageIntroProps) {
  return (
    <header className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <div className="page-lede">{children}</div>
      </div>
      {aside ? <aside>{aside}</aside> : null}
    </header>
  );
}
