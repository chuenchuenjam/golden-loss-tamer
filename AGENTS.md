<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Model rollout is entitlement-driven, not calendar-driven: the access helper and database function apply explicit overrides, a baseline default, and LoB matching so Team remains the release control.
- Model source classification is separate from System/Custom/Carrier labels so reference and edge-case examples do not change edit protections.
- Model configuration writes require server-side admin verification; extraction eligibility is also enforced in database triggers so direct client calls cannot bypass rollout restrictions.
- Signed-in catalogue reads use a metadata-only view; full model definitions use the authenticated client's existing policies to avoid privileged ordinary reads.
