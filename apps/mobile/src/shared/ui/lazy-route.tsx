import { type ComponentType, lazy, Suspense } from "react";

/**
 * Wraps a lazily-loaded component in a Suspense boundary with a minimal
 * fallback. Use this for heavy route panels that are not needed on the
 * initial render (e.g. auth flows, paywall, asset forms).
 *
 * Metro splits the dynamic import into a separate chunk that is fetched
 * only when the user navigates to the route.
 */
export function withLazyLoad<TProps extends Record<string, unknown>>(
  factory: () => Promise<{ default: ComponentType<TProps> }>,
) {
  const LazyComponent = lazy(factory);

  return function LazyRouteWrapper(props: TProps) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
