import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/shop/$shopId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/app/shop/$shopId/dashboard", params });
  },
});