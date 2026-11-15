import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        aria-label="Log out"
        title="Log out"
        className="grid size-8 place-items-center rounded-control text-ink-500 transition-colors hover:bg-sage-100 hover:text-ink-900"
      >
        <LogOut className="size-4" />
      </button>
    </form>
  );
}
