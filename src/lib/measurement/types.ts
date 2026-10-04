export type EventName =
  | "page_viewed"
  | "contents_viewed"
  | "items_added"
  | "checkout_started"
  | "order_created"
  | "subscription_created";
export type Content = Readonly<{
  id: string;
  name: string;
  content_type: "product" | "page";
  quantity?: number;
}>;
export type EventData = Readonly<{
  type: "contents" | "plan_enrollment";
  amount?: number;
  currency?: "USD";
  contents?: readonly Content[];
  plan_id?: string;
}>;
export type MeasurementEvent = Readonly<{
  name: EventName;
  data: EventData;
  options?: Readonly<{ event_id: string }>;
}>;
export type DispatchStatus = "suppressed" | "handed_to_sdk" | "failed";
export type DispatchResult = Readonly<{
  status: DispatchStatus;
  reason: string;
}>;
export type ConsentPreference = "unknown" | "accepted" | "declined";
export type SdkStatus = "idle" | "loading" | "ready" | "failed";
export type PixelDriver = {
  load: (config: { pixelId: string; debug: boolean }) => Promise<void>;
  consent: (accepted: boolean) => void;
  measure: (event: MeasurementEvent) => void;
};
