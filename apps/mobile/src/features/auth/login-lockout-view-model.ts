export type LoginLockoutViewModel = {
  message: string;
};

export function createLoginLockoutViewModel(
  remainingMs: number,
): LoginLockoutViewModel {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));

  return {
    message: `Too many failed attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  };
}
