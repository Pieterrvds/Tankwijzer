# Evals — the assistant's exam

Every change to the instructions (`src/ai/instructions.ts`), the knowledge (`knowledge/`) or the
model must pass these cases before it goes live. Each approved lesson that taught the assistant
something should become a case here, so the mistake can never come back unnoticed.

## A case

`evals/cases/<id>.json`:

```json
{
  "id": "alarmfluit-2027",
  "vraag": "Volstaat deze alarmfluit nog?",
  "vorigVerslag": "T11 | Systeem tegen overvulling | alarmfluit",
  "notities": ["alarmfluit op de ontluchting"],
  "verwacht": {
    "bevat": ["2027"],
    "bevat_niet": ["merk"],
    "zekerheid_in": ["hoog", "middel"],
    "bron_in": ["regel", "vorig_verslag"]
  }
}
```

All checks are deterministic text checks on the structured answer (`antwoord`, `bronnen`,
`zekerheid`, `voorstel_tekst`). Keep them about facts that must (not) be in the answer.

## Run

Costs a few cents per case (it calls Claude). Needs an API key:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run evals
```

From a lesson: copy the question and the relevant previous-report lines from
`KeurKompas/_lessen/lessen.json` (OneDrive), and put the correction's key fact in `bevat`
and the wrong fact in `bevat_niet`.
