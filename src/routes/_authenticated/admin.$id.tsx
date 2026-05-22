import { createFileRoute } from "@tanstack/react-router";
import { EmployeeForm } from "./admin.new";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  return <EmployeeForm mode={{ kind: "edit", id }} />;
}
