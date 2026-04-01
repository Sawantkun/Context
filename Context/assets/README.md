# MV Duration from SDP — Reference Implementation

This folder contains reference code and snippets to implement **Managed Validation duration from SDP policy** in the Azure-Express and Azure-Express-Internal repos. The Azure-Express codebase is not in this workspace; use these files as copy-paste or adaptation guides when working in the real repos.

## Summary

- **Problem:** Ev2 uses hardcoded MV durations (24h/6h). When a customer defines a different duration in their SDP (e.g. 10h), Ev2 still compares against 24h/6h and can incorrectly mark the rollout as non-compliant.
- **Fix:** Read expected MV duration from the `managedValidationDuration` rule’s new property `ManagedValidationDurations` (JSON object); fall back to config (24h/6h) when the policy doesn’t define it.

## Repos and paths

| Where | What |
|-------|------|
| **Azure-Express** (branch: `feature/managed-validation-duration-from-sdp-policy`) | Rule, Helper, model, SDPRuleProperties, processor wiring |
| **Azure-Express-Internal** | `GlobalSDPPolicy.json` — add `ManagedValidationDurations` to the managedValidationDuration rule |

## Files in this folder

| File | Use in Azure-Express / Internal |
|------|----------------------------------|
| `Models/ManagedValidationDurations.cs` | Copy into `server.common\policies\sdp\` (or equivalent). KT says this file may already exist; if so, ensure the shape matches (Rings, RegionsInRing, Regions; Normal, Emergency; `[JsonPropertyName]`). |
| `SDPRuleProperties_Addition.cs` | Add the `ManagedValidationDurations` constant to your existing `SDPRuleProperties` class. |
| `Helpers/ManagedValidationDurationHelper_Logic.cs` | **Replace** the CompliantValue block in `Server.Common/Helpers/ManagedValidationDurationHelper.cs` with the logic that reads `ManagedValidationDurations`, deserializes it, picks slot by orchestration + rollout type, parses ISO 8601, and falls back to config. |
| `Policies/ManagedValidationDurationRule_Logic.cs` | In `ManagedValidationDurationRule`, implement (or adjust) `EvaluateRule` to get expected duration from the rule via `GetExpectedMVDurationFromRule`, fall back to config, then set `IsCompliant` from actual vs expected. |
| `Processor/RegionAgnosticDeploymentProcessor_Wiring.cs` | In `RegionAgnosticDeploymentProcessor`, ensure SDP policy is passed into both the Helper and the Rule. |
| `GlobalSDPPolicy_managedValidationDuration_snippet.json` | In **Azure-Express-Internal**, add the `ManagedValidationDurations` object inside the `managedValidationDuration` rule’s `Properties` in `GlobalSDPPolicy.json`. |

## Policy JSON shape

Inside the `managedValidationDuration` rule’s **Properties**:

```json
"ManagedValidationDurations": {
  "Rings": { "Normal": "PT24H", "Emergency": "PT6H" },
  "RegionsInRing": { "Normal": "PT24H", "Emergency": "PT6H" },
  "Regions": { "Normal": "PT24H", "Emergency": "PT6H" }
}
```

Durations are ISO 8601 (e.g. `PT24H`, `PT6H`, `PT10H`). Do **not** use `CompliantValue` for MV duration.

## Implementation order

1. **SDPRuleProperties** — add constant `ManagedValidationDurations`.
2. **ManagedValidationDurations.cs** — add or confirm model in `server.common\policies\sdp\`.
3. **ManagedValidationDurationHelper** — replace CompliantValue logic with `ManagedValidationDurations` read + deserialize + fallback.
4. **ManagedValidationDurationRule** — read from policy in `EvaluateRule`, fallback to config, set `IsCompliant`.
5. **RegionAgnosticDeploymentProcessor** — pass SDP policy into Helper and Rule.
6. **Build** — fix project/namespace/using so Rule and Helper use the new model and constant.
7. **Azure-Express-Internal** — add `ManagedValidationDurations` to `GlobalSDPPolicy.json`.
8. **Test** — run a rollout; verify policy duration is used when present and config fallback when not.

## Build and test

### In this workspace (reference Demo)

```bash
cd <project-root>
dotnet build implementation/Demo/Ev2MVDurationDemo.csproj
dotnet run --project implementation/Demo/Ev2MVDurationDemo.csproj
```

Expected output: `OK: Deserialized ManagedValidationDurations — Rings.Normal=PT24H, Rings.Emergency=PT6H, ...` and minutes for each. This verifies the model and ISO 8601 parsing.

### In Azure-Express

```bash
cd <path-to-Azure-Express>
dotnet build src\dev\Services\Express\Express.Server.Common.csproj
```

Run a rollout locally and confirm that when the policy defines a custom duration (e.g. 10h), compliance uses that duration instead of 24h/6h.

## Step 10 — Test and document

- **In this workspace:** Run the Demo (see "Build and test" above) to verify deserialization and ISO 8601 parsing.
- **In Azure-Express:** Run a rollout from the Ev2 portal (or commandlet); verify that with policy containing `ManagedValidationDurations` (e.g. 10h) compliance uses that duration, and with policy missing the property fallback to config (24h/6h).
- **Documentation:** See `GlobalSDPPolicy_APPLY_INSTRUCTIONS.md` for applying the policy JSON in Azure-Express-Internal.

## References

- `../assets/KT_END_TO_END_PROJECT_OVERVIEW.txt` — full KT and glossary.
- Plan: MV Duration from SDP (in .cursor/plans or Cursor plan list).
