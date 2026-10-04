import { membershipPlan } from "../../data/membership.ts";
import type { MembershipPlan } from "../../data/membership.ts";
import {
  identifier,
  positiveInteger,
  record,
  timestamp,
} from "../validation.ts";

export type Enrollment = Readonly<{
  id: string;
  createdAt: string;
  status: "active";
  plan: MembershipPlan;
}>;
export type MembershipRecord = Readonly<{
  version: 1;
  enrollment: Enrollment | null;
}>;

export function freezePlan(plan: MembershipPlan): MembershipPlan {
  positiveInteger(plan.amountCents);
  return Object.freeze({
    ...plan,
    benefits: Object.freeze([...plan.benefits]),
  });
}

export function parseMembershipRecord(value: unknown): MembershipRecord {
  const data = record(value);
  if (data.version !== 1) throw new Error("Invalid saved membership.");
  if (data.enrollment === null)
    return Object.freeze({ version: 1, enrollment: null });
  const enrollment = record(data.enrollment);
  const plan = record(enrollment.plan);
  if (
    enrollment.status !== "active" ||
    plan.id !== membershipPlan.id ||
    plan.name !== membershipPlan.name ||
    plan.currency !== "USD" ||
    plan.interval !== "month" ||
    !Array.isArray(plan.benefits) ||
    plan.benefits.length === 0 ||
    plan.benefits.length > 10 ||
    !plan.benefits.every(
      (benefit) =>
        typeof benefit === "string" &&
        benefit.trim().length > 0 &&
        benefit.length <= 256,
    )
  )
    throw new Error("Invalid saved membership plan.");
  positiveInteger(plan.amountCents);
  const snapshot = freezePlan({
    id: membershipPlan.id,
    name: membershipPlan.name,
    amountCents: plan.amountCents,
    currency: "USD",
    interval: "month",
    benefits: plan.benefits as string[],
  });
  return Object.freeze({
    version: 1,
    enrollment: Object.freeze({
      id: identifier(enrollment.id),
      createdAt: timestamp(enrollment.createdAt),
      status: "active",
      plan: snapshot,
    }),
  });
}
