/**
 * Thin client wrappers that match the previous Supabase-backed server-fn
 * surface so admin components keep working unchanged. Each export now hits
 * the self-hosted REST API via `src/lib/api.ts`.
 *
 * These are plain async functions — call them directly. The `useServerFn`
 * compatibility shim below lets the existing `useServerFn(fn)({ data })`
 * call sites keep their shape while we transition.
 */
import { api, type Employee } from "./api";

type IdInput = { data: { id: string } };
type UpsertInput = { data: { id?: string; values: Partial<Employee> } };
type ToggleInput = { data: { id: string; disabled: boolean } };

export const listEmployees = (_?: { data?: unknown }) => api.listEmployees();

export const getEmployee = ({ data }: IdInput) => api.getEmployee(data.id);

export const upsertEmployee = ({ data }: UpsertInput) => {
  if (data.id) return api.updateEmployee(data.id, data.values);
  return api.createEmployee(data.values);
};

export const deleteEmployee = ({ data }: IdInput) => api.deleteEmployee(data.id);

export const toggleEmployeeDisabled = ({ data }: ToggleInput) =>
  api.toggleEmployeeDisabled(data.id, data.disabled);

/** Auth is disabled in this self-hosted build — admin is open. */
export const checkIsAdmin = async (_?: { data?: unknown }) => ({ isAdmin: true });
