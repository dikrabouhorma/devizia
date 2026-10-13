import { describe, expect, it } from "vitest";
import { computeQuote } from "./pricing";
import type { ClientAnswers } from "./domain";

const salon = {
  treatments: [
    { key: "tanin", name: "Tanin", description: "", enabled: true },
    { key: "botox", name: "Botox capillaire", description: "", enabled: false },
  ],
  grid: { tanin: [120, 140, 160, 190, 220], botox: [90, 110, 130, 160, 190] },
  supplements: { volume_medium: 15, volume_dense: 30, curly: 15, coily: 30, bleach: 20 },
  settings: { notify_email: true, reminder: true, block_henna: true, auto_send: false },
  range_width: 20,
};

const answers: ClientAnswers = {
  nature: 2,
  nature_subtype: "B",
  coloring: "bleach",
  previous_straightening: "over_6_months",
  henna: false,
};

describe("computeQuote", () => {
  it("additionne la base de la grille et les suppléments", () => {
    const q = computeQuote(salon, { treatment: "tanin", length: "mid_back", volume: "medium", answers });
    expect(q.blocked).toBe(false);
    if (q.blocked) return;
    expect(q.low).toBe(160 + 15 + 20);
    expect(q.high).toBe(195 + 20);
    expect(q.lines.map((l) => l.label)).toEqual([
      "Tanin · milieu du dos",
      "Volume moyen",
      "Soin protecteur (décoloration)",
    ]);
  });

  it("applique les suppléments de texture pour les types 3 et 4", () => {
    const curly = computeQuote(salon, {
      treatment: "tanin",
      length: "shoulders",
      volume: "fine",
      answers: { ...answers, nature: 3, coloring: "none" },
    });
    const coily = computeQuote(salon, {
      treatment: "tanin",
      length: "shoulders",
      volume: "fine",
      answers: { ...answers, nature: 4, coloring: "none" },
    });
    expect(!curly.blocked && curly.low).toBe(135);
    expect(!coily.blocked && coily.low).toBe(150);
  });

  it("bloque le devis automatique en cas de henné si le réglage est actif", () => {
    const q = computeQuote(salon, {
      treatment: "tanin",
      length: "waist",
      volume: "dense",
      answers: { ...answers, henna: true },
    });
    expect(q.blocked).toBe(true);
  });

  it("donne un prix malgré le henné si la lisseuse a désactivé le blocage", () => {
    const q = computeQuote(
      { ...salon, settings: { ...salon.settings, block_henna: false } },
      { treatment: "tanin", length: "waist", volume: "fine", answers: { ...answers, henna: true, coloring: "none" } },
    );
    expect(!q.blocked && q.low).toBe(190);
  });

  it("refuse un lissage désactivé", () => {
    expect(() =>
      computeQuote(salon, { treatment: "botox", length: "waist", volume: "fine", answers }),
    ).toThrow();
  });
});
