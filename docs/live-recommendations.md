# Live session recommendations

The `/live` “Recommend next session” button ranks non-break sessions in configured
tracks each time it is clicked, using the latest snapshot and its synchronized
clock. It considers starts from **5 minutes ago through 15 minutes from now**
(inclusive). A manually started session uses its reported start timestamp;
otherwise the planned start is used. Ended sessions and halls last reported full
are excluded. Sessions past their planned end are excluded unless manually
reported started in the last five minutes, allowing for a delayed start.

For `m` minutes until the start:

```
time = max(0, 1 - abs(m - 5) / 10)
score = 35 * time + 65 * remainingSeatFraction
```

The time score peaks at +5 minutes. +4/+6 receive 90%; +3/+7 receive 80%;
−5/+15 receive 0%. Remaining-seat percentage comes from the track occupancy,
not an exact seat count or a prediction of future attendance. Unknown, offline,
or older-than-five-minute occupancy receives a conservative 25% remaining-seat
estimate, explicitly labeled uncertain. Ties prefer the earlier start, then
more remaining seats, then session ID for stable ordering. Editorial pins and
recommendations do not affect this score.

The winner's track card scrolls into view and its session title receives keyboard
focus, a blue treatment and three half-second pulses. Successful result announcements
are available to screen readers; only empty or unavailable results show a status
message beneath the compass button. Selecting the title opens the existing
session detail popup. If the winner is beyond the displayed current/next pair,
it appears in an additional recommendation row within that track card. Clicking
again recalculates the result and replays the highlight; updates never move the
visitor automatically to a different recommendation. If the selected session
becomes ineligible, its highlight disappears and the button offers a fresh pick.
If no sessions qualify, a status message appears without scrolling.

Lite mode and reduced-motion preferences use instant scrolling and a static
highlight. Lenis scrolling is used when available, with a native scrolling fallback.
No data is written and no new dependencies or network requests are required.
