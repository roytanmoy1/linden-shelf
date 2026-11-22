# Time Log

The initial implementation took approximately **2 hours 45 minutes** against
the 2-3 hour target. The submitted version includes substantial later changes
and is **over the time-box**. Times below are approximate tool-assisted working
windows, including test runs and tool waits, not a measure of personal typing
time. Overnight and between-request gaps are excluded. Clock times are +05:30.

## Consolidated Breakdown

| Scope | Planning / inspection | Building / test authoring | Running tests / diagnosis | Review / documentation | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Initial five-journey implementation | 25 min | 85 min | 40 min | 15 min | 165 min |
| First review, configuration, rename and original PR | ~5 min | ~25 min | ~40 min | ~20 min | ~90 min |
| Subsequent UX, accessibility, search, styling and test passes | ~60 min | ~80 min | ~110 min | ~65 min | ~315 min |
| Final brief audit, fixes and clean release verification | ~5 min | ~10 min | ~20 min | ~5 min | ~40 min |

**Total through final local acceptance: about 10 hours 10 minutes.** The last
pass ran from 18:54 to 19:35 on 22 November (41 minutes, rounded above). It
included the same-origin photo fix, filter/sort race, clean installation,
cross-engine journeys and the final browser regression gate. Git publication
and the subsequent hosted runner queue/runtime are separate from this local
total. Activity buckets are retrospective and rounded. The checkpoints below
are supporting detail and must not be added again.

| Activity | Initial implementation, 20 Nov | First review, 22 Nov | Rename and walkthrough, through 11:08 on 22 Nov |
| --- | --- | --- | --- |
| Planning / inspecting the brief | ~25 min | ~2 min | ~3 min |
| Building, including immediate TDD | ~85 min | ~4 min | ~9 min |
| Tests, integration and tool waits | ~40 min | ~7 min | ~14 min |
| Assisted review and documentation | ~15 min | ~2-7 min | ~10 min |
| Subtotal | ~165 min | ~15-20 min | ~36 min |

**Through that checkpoint: approximately 3 hours 36-41 minutes.** Final evidence
edits and checks after 11:08 are not included in that subtotal. Candidate review
and container testing are not counted.

## Clock Evidence

- 20 Nov: planning began at 13:12:55; the approval pause ended at 13:23:55. Backend implementation to its verification checkpoint took 51m33s. The frontend/container phase to its documentation checkpoint took 66m50s. The final SMTP/mobile checkpoint was 16:08:36, roughly 2h56m wall time after planning began, including pauses.
- 22 Nov: the first review regression ran at 10:16:42; final lint finished at 10:29:30. The 15-20 minute estimate includes adjacent setup and documentation.
- 22 Nov: rename inventory was recorded at 10:32:41; the new checkout passed its final release gates at 10:54:52. A clock reading at 11:08:10 after the clean native verification establishes 35m29s for this phase, rounded above.
- 22 Nov: the recovery fixes and release pass started at 11:16:12. The local gates finished at 11:24:22, and the public review baseline was created at 11:25:04. That adds roughly nine minutes through the baseline (about three each for implementation, tests and release review), bringing the estimate to about 3h45-50m before final staging and push.
- 22 Nov: acceptance-gap review began at 11:38:12. The native release gates finished at 11:46:17 (8m05s elapsed; roughly one minute inspecting, four building, three testing). Subsequent all-category browser verification, documentation, PR preparation and hosted runner time are outside that interval. This brings the measured/estimated work to roughly four hours before candidate review.
- 22 Nov: the PR was opened and the hosted supplier refusal investigated after those gates. The controlled supplier boundary check passed at 11:57:53, another 11m36s since 11:46:17, including runner waits. Roughly three minutes were implementation and the rest testing, diagnosis and release documentation. Total through that checkpoint is about 4h05-10m; final CI time and personal review are not included.

Build and test work were interleaved, so the per-activity allocation is
retrospective. See [acceptance.md](acceptance.md) for what was verified in those intervals.

## Follow-up Accounting

The later work is included in the feature branch and in the consolidated
total. The retained request windows between 12:42 and 18:54 on 22 November
sum to about 315 minutes, including retries and verification. Earlier
checkpoints such as the 14:28-15:14 filter pass and the 16:18-16:35 focus
pass fall inside those windows and are not counted twice. For the rough split,
intervals were classified by the next recorded inspection, edit, check or
review action. No time for unobserved candidate review is claimed.
