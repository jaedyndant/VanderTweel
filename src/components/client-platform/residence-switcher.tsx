"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientHref } from "./presentation";
import type { ClientPage, ClientVillaChoice } from "./types";

export function ResidenceSwitcher({
  choices,
  selectedVillaId,
  page,
}: {
  choices: ClientVillaChoice[];
  selectedVillaId: string;
  page: ClientPage;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inputId = useId();
  const statusId = useId();

  return (
    <div className="residence-switcher" aria-busy={pending}>
      <label htmlFor={inputId}>Residence</label>
      <select
        id={inputId}
        value={selectedVillaId}
        disabled={pending}
        aria-describedby={statusId}
        onChange={(event) => {
          const villaId = event.target.value;
          if (villaId === selectedVillaId || !choices.some((choice) => choice.id === villaId)) return;
          // This only drives navigation; the server re-authorizes every read.
          startTransition(() => {
            router.push(clientHref(page, villaId), { scroll: false });
          });
        }}
      >
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.code} · {choice.projectName}
          </option>
        ))}
      </select>
      <span id={statusId} role="status" aria-live="polite">
        {pending ? "Switching residence…" : "Choose which residence to view"}
      </span>
    </div>
  );
}
