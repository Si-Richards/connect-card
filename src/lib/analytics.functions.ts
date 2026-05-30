/**
 * Client wrappers for analytics endpoints exposed by the self-hosted backend.
 * Same export names as the previous server-fn version so call sites are
 * unchanged.
 */
import { api } from "./api";

type RecordInput = {
  data: {
    slug: string;
    eventType: "view" | "scan" | "booking_click";
    source?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
  };
};

export const recordEmployeeEvent = ({ data }: RecordInput) => api.recordEvent(data);

export const listEmployeeAnalytics = (input?: { data?: { days?: number } }) =>
  api.listAnalytics(input?.data?.days ?? 30);

export const getEmployeeAnalytics = ({
  data,
}: {
  data: { id: string; days?: number };
}) => api.getAnalytics(data.id, data.days ?? 30);
