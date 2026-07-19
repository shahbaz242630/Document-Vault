import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import ErrorPage from "./error";
import RootLayout, { metadata } from "./layout";
import NotFoundPage from "./not-found";
import HomePage from "./page";

describe("web scaffold", () => {
  it("renders an accessible, inert preview shell", () => {
    const markup = renderToStaticMarkup(
      <RootLayout>
        <HomePage />
      </RootLayout>,
    );

    expect(markup).toContain('lang="en"');
    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('id="main-content"');
    expect(markup).toContain("The Sanduqkin web foundation is ready.");
    expect(markup).toContain("No accounts, claims, or vault data");
    expect(markup).not.toContain("<form");
    expect(markup).not.toContain("<input");
  });

  it("keeps the scaffold out of search indexes", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("renders a recovery action for unexpected errors", () => {
    const markup = renderToStaticMarkup(<ErrorPage reset={vi.fn()} />);

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Try again");
  });

  it("renders a useful not-found page", () => {
    const markup = renderToStaticMarkup(<NotFoundPage />);

    expect(markup).toContain("This page is not here.");
    expect(markup).toContain('href="/"');
  });
});
