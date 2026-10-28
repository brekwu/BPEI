import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/imports")({
  component: () => <Outlet />,
});