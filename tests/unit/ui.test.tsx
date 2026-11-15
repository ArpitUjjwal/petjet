import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShell, NAV, isActive } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ETicket } from "@/components/ui/e-ticket";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/field";
import { ProgressRing, clampPercent } from "@/components/ui/progress-ring";
import { Stepper } from "@/components/ui/stepper";
import { Timeline } from "@/components/ui/timeline";
import { ToastProvider, useToast } from "@/components/ui/toast";

describe("Button", () => {
  it("fires onClick and defaults to type=button", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Continue</Button>);
    const btn = screen.getByRole("button", { name: "Continue" });
    expect(btn).toHaveAttribute("type", "button");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const btn = screen.getByRole("button", { name: "Saving" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Field controls", () => {
  it("links label, error and invalid state on Input", () => {
    render(<Input label="Microchip number" error="A microchip number has 15 digits." />);
    const input = screen.getByLabelText("Microchip number");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("A microchip number has 15 digits.");
    expect(screen.getByRole("alert")).toHaveTextContent("15 digits");
  });

  it("shows hint and optional marker without invalid state", () => {
    render(<Input label="Weight" optional hint="In kilograms" suffix="kg" />);
    const input = screen.getByLabelText(/Weight/);
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).toHaveAccessibleDescription("In kilograms");
    expect(screen.getByText("(optional)")).toBeInTheDocument();
  });

  it("Select is labelled and selectable", async () => {
    render(
      <Select label="Species" defaultValue="Dog">
        <option>Dog</option>
        <option>Cat</option>
      </Select>,
    );
    const select = screen.getByLabelText("Species");
    await userEvent.selectOptions(select, "Cat");
    expect(select).toHaveValue("Cat");
  });
});

describe("Badge", () => {
  it("renders its tone", () => {
    render(<Badge tone="sample">Simulated slot</Badge>);
    expect(screen.getByText("Simulated slot")).toHaveAttribute("data-tone", "sample");
  });
});

describe("ProgressRing", () => {
  it("clamps percentages", () => {
    expect(clampPercent(3, 7)).toBe(43);
    expect(clampPercent(9, 7)).toBe(100);
    expect(clampPercent(-1, 7)).toBe(0);
    expect(clampPercent(1, 0)).toBe(0);
    expect(clampPercent(Number.NaN, 7)).toBe(0);
  });

  it("exposes progressbar semantics", () => {
    render(<ProgressRing value={3} max={7} label="Tasks completed" />);
    const bar = screen.getByRole("progressbar", { name: "Tasks completed" });
    expect(bar).toHaveAttribute("aria-valuenow", "43");
    expect(bar).toHaveTextContent("43%");
  });
});

describe("Stepper", () => {
  it("marks done, current and upcoming steps", () => {
    render(<Stepper steps={["Pet", "Trip", "Health", "Review"]} current={2} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-state"))).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
    ]);
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });
});

describe("Timeline", () => {
  it("renders items in order with their state", () => {
    render(
      <Timeline
        items={[
          { id: "a", date: "Today", title: "Set up plan", state: "done" },
          { id: "b", date: "By 21 Feb", title: "Rabies vaccination", state: "next" },
          { id: "c", date: "15 Mar", title: "Travel date", state: "travel" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[1]).toHaveTextContent("Rabies vaccination");
    expect(items[2]).toHaveAttribute("data-state", "travel");
  });
});

describe("Feedback", () => {
  it("danger callout is an alert, info callout is a note", () => {
    render(
      <>
        <Callout tone="danger" title="This trip is not ready" />
        <Callout tone="info" title="Source: GOV.UK" />
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("not ready");
    expect(screen.getByRole("note")).toHaveTextContent("GOV.UK");
  });

  it("empty state shows title and action", () => {
    render(<EmptyState title="No pets yet" action={<Button>Add a pet</Button>} />);
    expect(screen.getByRole("heading", { name: "No pets yet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a pet" })).toBeInTheDocument();
  });
});

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share this record?"
        description="The vet will see it."
        footer={<Button onClick={() => setOpen(false)}>Share record</Button>}
      >
        Body
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens with accessible name, closes on Escape and restores focus", async () => {
    render(<DialogHarness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Open" });
    await userEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Share this record?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("The vet will see it.");
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.keyboard("{Escape}");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.body.style.overflow).toBe("");
    expect(trigger).toHaveFocus();
  });

  it("closes from the close button and the backdrop", async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByTestId("overlay-backdrop"));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps Tab focus inside the dialog", async () => {
    render(<DialogHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 5; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

function ToastHarness() {
  const { toast } = useToast();
  return <Button onClick={() => toast({ title: "Appointment requested", duration: 0 })}>Fire</Button>;
}

describe("Toast", () => {
  it("shows and dismisses a toast", async () => {
    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Fire" }));
    expect(screen.getByRole("status")).toHaveTextContent("Appointment requested");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    await vi.waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ToastHarness />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});

describe("ETicket", () => {
  it("shows route, passenger, pet and is labelled as a sample", () => {
    render(
      <ETicket
        ticket={{
          airline: "Sample Airways",
          flightNumber: "SA 0304",
          from: { code: "LHR", city: "London", time: "09:10" },
          to: { code: "CDG", city: "Paris", time: "11:25" },
          date: "15 Mar 2027",
          duration: "1h 15m",
          passenger: "Mariyam Khan",
          pet: "Milo (cat)",
          petPlacement: "Cabin",
          bookingRef: "PJ7K2Q",
        }}
      />,
    );
    const ticket = screen.getByRole("article", { name: /SA 0304 LHR to CDG/ });
    const t = within(ticket);
    expect(t.getByText("Mariyam Khan")).toBeInTheDocument();
    expect(t.getByText("Milo (cat)")).toBeInTheDocument();
    expect(t.getByText("PJ7K2Q")).toBeInTheDocument();
    expect(t.getByText("Sample ticket")).toBeInTheDocument();
  });
});

describe("AppShell", () => {
  it("matches active nav items without the root matching everything", () => {
    expect(isActive("/app", "/app", "/app")).toBe(true);
    expect(isActive("/app/documents", "/app", "/app")).toBe(false);
    expect(isActive("/app/documents/12", "/app/documents", "/app")).toBe(true);
    expect(isActive("/app/documents-old", "/app/documents", "/app")).toBe(false);
  });

  it("renders the owner nav with the current page marked and an unread count", () => {
    render(
      <AppShell role="owner" userName="Mariyam Khan" unread={3}>
        <p>content</p>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getAllByRole("link")).toHaveLength(NAV.owner.length);
    expect(within(nav).getByRole("link", { name: "Documents" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("gives vets and labs different navigation", () => {
    const { unmount } = render(
      <AppShell role="vet" userName="Dr Asha Patel">
        x
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Requests" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Test orders" })).not.toBeInTheDocument();
    unmount();
    render(
      <AppShell role="lab" userName="Northgate Pathology">
        x
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "Test orders" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Requests" })).not.toBeInTheDocument();
  });
});
