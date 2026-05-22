/**
 * Thin client wrappers around the self-hosted REST API. Keep the
 * `({ data })` calling shape so existing call sites work unchanged.
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
