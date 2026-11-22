# Time Log

Target: 2-3 hours. The first implementation was approximately 2 hours 45 minutes.
The subsequent local review, rename, interview guide and extra verification put
the overall effort **over the time-box**. Estimates include tool waits; they are
not a claim about uninterrupted candidate effort. All clock times below are +05:30.

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

Build and test work were interleaved, so the per-activity allocation is
retrospective. See [acceptance.md](acceptance.md) for what was verified in those intervals.
