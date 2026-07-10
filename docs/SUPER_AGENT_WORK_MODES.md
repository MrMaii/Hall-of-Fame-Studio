# Super Agent Work Modes

Hall of Fame Studio now exposes five professional work modes through `GET /work-modes` and `POST /work-modes/:mode/team`:

- `learning`: learning plan, practice set, mastery check, academic-integrity escalation.
- `academic-writing`: outline, claim-citation graph, revision lineage, unsupported-claim escalation.
- `investigation`: hypotheses, source custody, contradiction matrix, evidence-bound claim escalation.
- `technical-delivery`: implementation plan, test evidence, rollback plan, security-release escalation.
- `creative-studio`: creative brief, critique log, rights/provenance register, licensing escalation.

The team composer uses the existing Hall of Fame persona capability map. It selects distinct people only when their relevant professional-skill score is at least 70; a missing specialist is returned as a coverage gap, not silently replaced with a generic agent.

Each composition is a kickoff contract. It assigns each required artifact to an execution owner and a distinct reviewer, generates a dependency DAG, and assigns every escalation check to the lead for an explicit decision when it is triggered. Custom role dependencies are accepted only when they reference known roles and remain acyclic; a cycle or invalid reference returns a blocked contract and `/projects/initiate` rejects it with `422`.

The resulting project tasks retain `dependsOn` and `reviewerId`, so the same ownership and review separation survives beyond the kickoff response. This is a local, self-hosted coordination guardrail; it makes no cloud dependency or public-production claim.
