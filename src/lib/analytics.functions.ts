/**
 * Client wrappers for analytics endpoints exposed by the self-hosted backend.
 * Same export names as the previous server-fn version so call sites are
 * unchanged.
 */
import { api } from "./api";

type RecordInput = {
  data: {
    slug: string;
    eventType: "view" | "scan";
    source?: string | null;
    userAgent?: string | null;
    referrer?: string | null;
  };
};

export const recordEmployeeEvent = ({ data }: RecordInput) => api.recordEvent(data);

export const listEmployeeAnalytics = (_?: { data?: unknown }) => api.listAnalytics();

export const getEmployeeAnalytics = ({
  data,
}: {
  data: { id: string; days?: number };
}) => api.getAnalytics(data.id, data.days ?? 30);
