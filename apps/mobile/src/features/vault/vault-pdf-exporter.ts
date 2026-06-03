type PrintToFileAsync = (options: { html: string }) => Promise<{ uri: string }>;
type ShareAsync = (
  uri: string,
  options: { UTI: string; mimeType: string },
) => Promise<void>;

export async function exportVaultPdf({
  html,
  printToFileAsync,
  shareAsync,
}: {
  html: string;
  printToFileAsync?: PrintToFileAsync;
  shareAsync?: ShareAsync;
}): Promise<void> {
  try {
    const adapters = await getExportAdapters({ printToFileAsync, shareAsync });
    const { uri } = await adapters.printToFileAsync({ html });
    await adapters.shareAsync(uri, { UTI: ".pdf", mimeType: "application/pdf" });
  } catch {
    throw new Error("PDF export failed.");
  }
}

async function getExportAdapters({
  printToFileAsync,
  shareAsync,
}: {
  printToFileAsync?: PrintToFileAsync;
  shareAsync?: ShareAsync;
}): Promise<{
  printToFileAsync: PrintToFileAsync;
  shareAsync: ShareAsync;
}> {
  if (printToFileAsync && shareAsync) {
    return { printToFileAsync, shareAsync };
  }

  const [printModule, sharingModule] = await Promise.all([
    import("expo-print"),
    import("expo-sharing"),
  ]);

  return {
    printToFileAsync: printToFileAsync ?? printModule.printToFileAsync,
    shareAsync: shareAsync ?? sharingModule.shareAsync,
  };
}
