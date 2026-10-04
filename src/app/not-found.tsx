import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      eyebrow="404 / OFF THE PATH"
      title="Let’s find your way back."
      description="We couldn’t find that page. Your next move is waiting in the collection."
      href="/shop"
      action="Back to the collection"
    />
  );
}
