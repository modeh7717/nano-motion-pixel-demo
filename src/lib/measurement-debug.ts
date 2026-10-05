/** Carry only the demo flag to internal destinations, preserving their query/hash. */
export function withMeasurementDebug(href: string, currentSearch: string): string {
  if (
    new URLSearchParams(currentSearch).get("measurementDebug") !== "true" ||
    !href.startsWith("/") ||
    href.startsWith("//")
  )
    return href;

  const destination = new URL(href, "https://nano-motion.example");
  destination.searchParams.set("measurementDebug", "true");
  return `${destination.pathname}${destination.search}${destination.hash}`;
}
