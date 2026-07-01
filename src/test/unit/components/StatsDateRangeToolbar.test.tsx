import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StatsDateRangeToolbar } from "@/components/dashboard/stats/StatsDateRangeToolbar";
import { renderWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("@/components/ui/popover", () => ({
    Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/calendar", () => ({
    Calendar: ({ onSelect }: { onSelect: (range: { from: Date; to: Date }) => void }) => (
        <button
            type="button"
            onClick={() => onSelect({ from: new Date(2026, 3, 10), to: new Date(2026, 3, 12) })}
        >
            Seleccionar rango mock
        </button>
    ),
}));

vi.mock("@/components/products/SpanishDateInput", () => ({
    default: ({
        value,
        onChange,
    }: {
        value: string;
        onChange: (value: string) => void;
    }) => (
        <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
        />
    ),
}));

describe("StatsDateRangeToolbar", () => {
    it("renders presets, labels and forwards the date controls", async () => {
        const user = userEvent.setup();
        const onApplyLastDays = vi.fn();
        const onRangeChange = vi.fn();
        const onUpdateFromIsoDate = vi.fn();
        const onUpdateToIsoDate = vi.fn();
        const onDatePopoverOpenChange = vi.fn();

        renderWithProviders(
            <StatsDateRangeToolbar
                range={{
                    from: new Date(2026, 3, 1),
                    to: new Date(2026, 3, 10),
                }}
                selectedRangeDays={10}
                isDatePopoverOpen={true}
                onDatePopoverOpenChange={onDatePopoverOpenChange}
                rangeError={null}
                maxRangeDays={30}
                onApplyLastDays={onApplyLastDays}
                onRangeChange={onRangeChange}
                onUpdateFromIsoDate={onUpdateFromIsoDate}
                onUpdateToIsoDate={onUpdateToIsoDate}
                isPresetRange={(days) => days === 30}
            />
        );

        expect(screen.getByText("10 días")).toBeInTheDocument();
        expect(screen.getByText("01/04/2026 - 10/04/2026")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "7D" }));
        await user.click(screen.getByRole("button", { name: "30D" }));
        await user.click(screen.getByRole("button", { name: "Restablecer rango" }));
        const fromInput = screen.getByDisplayValue("2026-04-01");
        const toInput = screen.getByDisplayValue("2026-04-10");
        fireEvent.change(fromInput, { target: { value: "2026-04-03" } });
        fireEvent.change(toInput, { target: { value: "2026-04-12" } });
        await user.click(screen.getByRole("button", { name: "Seleccionar rango mock" }));
        await user.click(screen.getByRole("button", { name: "Aplicar" }));

        expect(onApplyLastDays).toHaveBeenNthCalledWith(1, 7);
        expect(onApplyLastDays).toHaveBeenNthCalledWith(2, 30);
        expect(onApplyLastDays).toHaveBeenNthCalledWith(3, 30);
        expect(onUpdateFromIsoDate).toHaveBeenLastCalledWith("2026-04-03");
        expect(onUpdateToIsoDate).toHaveBeenLastCalledWith("2026-04-12");
        expect(onRangeChange).toHaveBeenCalledWith({
            from: new Date(2026, 3, 10),
            to: new Date(2026, 3, 12),
        });
        expect(onDatePopoverOpenChange).toHaveBeenCalledWith(false);
    });

    it("shows the fallback label, a single preset and the error message for short ranges", () => {
        renderWithProviders(
            <StatsDateRangeToolbar
                range={{ from: undefined, to: undefined }}
                selectedRangeDays={0}
                isDatePopoverOpen={false}
                onDatePopoverOpenChange={vi.fn()}
                rangeError="El rango máximo es de 5 días."
                maxRangeDays={5}
                onApplyLastDays={vi.fn()}
                onRangeChange={vi.fn()}
                onUpdateFromIsoDate={vi.fn()}
                onUpdateToIsoDate={vi.fn()}
                isPresetRange={() => false}
            />
        );

        expect(screen.getByRole("button", { name: "5D" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "7D" })).not.toBeInTheDocument();
        expect(screen.getByText("Selecciona rango")).toBeInTheDocument();
        expect(screen.getByText("El rango máximo es de 5 días.")).toBeInTheDocument();
    });
});
