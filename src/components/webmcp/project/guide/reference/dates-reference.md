# Date & Time Reference

**EdgeRules** supports the following ISO-8601 style types: **date**, **time**, **datetime**, **duration** and
**period**. Values support local-time and time offsets (e.g. `Z` or `+02:00`), but do not support named time zones (e.g.
`America/New_York`). All date and time-related operations are deterministic, so they can be executed on edge
environments where system clock access is not available or not reliable. Add the current time information to the
EdgeRules context (or decision service request) if needed to execute schedules, reminders, and temporal rules.

```edgerules
{
    newDate: date("2024-09-15")
    newTime: time("13:10:30")
    newDateTime: datetime("2024-09-15T13:10:30")
    sameMoment: date("2024-09-15") = datetime("2024-09-15T00:00:00")
}
```

**output:**

```json
{
  "newDate": "2024-09-15",
  "newTime": "13:10:30",
  "newDateTime": "2024-09-15T13:10:30",
  "sameMoment": true
}
```

## Supported datetime Formats

The engine uses a flexible parser that supports the following ISO-8601 / RFC-3339 variations for `datetime`:

- `YYYY-MM-DDTHH:MM:SS` (No offset, defaults to UTC context)
- `YYYY-MM-DDTHH:MM` (No seconds, defaults to UTC context)
- `YYYY-MM-DDTHH:MM:SSZ` (Explicit UTC)
- `YYYY-MM-DDTHH:MM:SS.sssZ` (UTC with subseconds)
- `YYYY-MM-DDTHH:MM:SS+HH:MM` (Non-UTC offset)
- `YYYY-MM-DDTHH:MM:SS.sss+HH:MM` (Non-UTC offset with subseconds)

```edgerules
{
    utc: datetime("2024-09-15T13:10:30Z")
    offset: datetime("2024-09-15T13:10:30+02:00")
    noSeconds: datetime("2024-09-15T13:10+02:00")
    subseconds: datetime("2024-09-15T13:10:30.123Z")
}
```

**output:**

```json
{
  "utc": "2024-09-15T13:10:30",
  "offset": "2024-09-15T13:10:30+02:00",
  "noSeconds": "2024-09-15T13:10:00+02:00",
  "subseconds": "2024-09-15T13:10:30.123"
}
```

## Durations

Durations come in two shapes:

- **period("P1Y2M3D")** carries years, months, and days (calendar-aware, like Java `Period`)
- **duration("P2DT3H")** carries days, hours, minutes, seconds (clock duration)

Periods and durations normalize automatically: **period("P18M")** behaves like **P1Y6M**, and **duration("PT90M")**
prints as **PT1H30M**.

```edgerules
{
    ymOnly: period("P18M")
    daysOnly: period("P10D")
    clockSpan: duration("PT90M")
    negSeconds: duration("-PT45S")
}
```

**output:**

```json
{
  "ymOnly": "P1Y6M",
  "daysOnly": "P10D",
  "clockSpan": "PT1H30M",
  "negSeconds": "-PT45S"
}
```

## Accessing Components

Each primitive exposes normalized, read-only fields:

- **date**: year, month, day, weekday (ISO Monday=1 … Sunday=7)
- **time**: hour, minute, second
- **datetime**: year, month, day, hour, minute, second, weekday, time, date
- **duration**: days, hours, minutes, seconds, totalSeconds, totalMinutes, totalHours
- **period**: years, months, days, totalMonths, totalDays

Datetime `.time` returns a concrete `time(...)` value, while `.date` returns a `date(...)`. All fields are normalized
(`duration("PT90M").hours == 1`, `period("P18M").years == 1`).

```edgerules
{
    dateParts: {
        year: date("2017-05-03").year
        month: date("2017-05-03").month
        day: date("2017-05-03").day
        weekdayIso: date("2018-10-11").weekday
    }
    timeParts: {
        hour: time("13:10:30").hour
        minute: time("13:10:30").minute
        second: time("13:10:30").second
    }
    datetimeParts: {
        month: datetime("2016-12-09T15:37:00").month
        hour: datetime("2016-12-09T15:37:00").hour
        timeOnly: datetime("2016-12-09T15:37:00").time
        dateOnly: datetime("2016-12-09T15:37:00").date
    }
    durationParts: {
        hours: duration("PT90M").hours       // 1
        minutes: duration("PT90M").minutes   // 30
        totalHours: duration("PT90M").totalHours // 1.5
    }
    periodParts: {
        years: period("P18M").years          // 1
        months: period("P18M").months        // 6
        totalMonths: period("P18M").totalMonths // 18
    }
}
```

**output:**

```json
{
  "dateParts": {
    "year": 2017,
    "month": 5,
    "day": 3,
    "weekdayIso": 4
  },
  "timeParts": {
    "hour": 13,
    "minute": 10,
    "second": 30
  },
  "datetimeParts": {
    "month": 12,
    "hour": 15,
    "timeOnly": "15:37:00",
    "dateOnly": "2016-12-09"
  },
  "durationParts": {
    "hours": 1,
    "minutes": 30,
    "totalHours": 1.5
  },
  "periodParts": {
    "years": 1,
    "months": 6,
    "totalMonths": 18
  }
}
```

## Comparing Temporal Values

Mixing incompatible types (for example, comparing a `date` to a `time` or a `duration`) produces a linking error.

```edgerules
{
    dateCompare: {
        eq: date("2020-01-01") = date("2020-01-01")
        lt: date("2020-01-01") < date("2020-01-02")
        gte: date("2020-01-03") >= date("2020-01-03")
    }
    timeCompare: {
        neq: time("09:00:00") <> time("10:00:00")
        lt: time("08:30:00") < time("09:00:00")
    }
    datetimeCompare: {
        gt: datetime("2020-01-01T11:00:00") > datetime("2020-01-01T09:00:00")
    }
    durationCompare: {
        eq: duration("PT3H") = duration("PT180M")
        gt: duration("P2D") >= duration("P1D")
    }
    periodEqual: period("P1Y") = period("P12M")
}
```

**output:**

```json
{
  "dateCompare": {
    "eq": true,
    "lt": true,
    "gte": true
  },
  "timeCompare": {
    "neq": true,
    "lt": true
  },
  "datetimeCompare": {
    "gt": true
  },
  "durationCompare": {
    "eq": true,
    "gt": true
  },
  "periodEqual": true
}
```

## Arithmetic with Durations

Subtraction between two temporal values always yields a `duration`. Adding or subtracting a `duration` keeps the same
type for time/datetime, while dates become datetime because the time component appears.

Use `period(...)` when you need calendar-aware math: check **calendarDiffs** for calendar-based date subtraction.

In these examples, `subtractDates` evaluates to `PT16H`, `dateMinusDate` to `PT24H`, `addToDate` to
`2017-05-04T00:00:00`, and `subtractFromDate` to `2017-05-02T00:00:00`.

```edgerules
{
    subtractDates: datetime("2020-01-02T00:00:00") - datetime("2020-01-01T08:00:00")
    dateMinusDate: date("2020-01-02") - date("2020-01-01")
    addToDate: date("2017-05-03") + duration("P1D")        // datetime result
    subtractFromDate: date("2017-05-03") - duration("P1D")
    datetimePlus: datetime("2016-12-09T15:37:00") + duration("PT23H")
    timeMath: {
        minus: time("13:10:30") - duration("PT1H10M30S")
        plus: time("13:10:30") + duration("PT50S")
        diff: time("13:10:30") - time("12:00:00")
    }
}
```

**output:**

```json
{
  "subtractDates": "PT16H",
  "dateMinusDate": "P1D",
  "addToDate": "2017-05-04T00:00:00",
  "subtractFromDate": "2017-05-02T00:00:00",
  "datetimePlus": "2016-12-10T14:37:00",
  "timeMath": {
    "minus": "12:00:00",
    "plus": "13:11:20",
    "diff": "PT1H10M30S"
  }
}
```

## Period Arithmetic

Use periods when you need month-aware math (end-of-month rules, anniversaries, etc.).

Periods cannot be combined with durations in arithmetic. Attempting `period('P4D') + duration('PT5H')` or subtracting a
period from a duration raises a linking error.

```edgerules
{
    addPeriodToDate: date("2020-01-31") + period("P1M")
    subtractPeriodFromDate: date("2020-02-29") - period("P1M")
    datetimePeriod: datetime("2020-01-15T10:30:00") + period("P1Y2M")
    periodMath: {
        plus: period("P1Y6M") + period("P2M")
        minus: period("P6M") - period("P2M")
    }
}
```

**output:**

```json
{
  "addPeriodToDate": "2020-02-29",
  "subtractPeriodFromDate": "2020-01-29",
  "datetimePeriod": "2021-03-15T10:30:00",
  "periodMath": {
    "plus": "P1Y8M",
    "minus": "P4M"
  }
}
```

## Calendar Helpers

- **calendarDiff** always returns a `period`, preserving sign.
- **dayOfWeek** follows ISO 8601: 1 = Monday … 7 = Sunday. **weekOfYear** uses ISO 8601 week numbering.
- **daysInMonth** yields the length of the date's month (28 for February 2025, 29 when leap year rules apply).

```edgerules
{
    fields: {
        weekday: dayOfWeek(date("2025-09-02"))
        ordinal: dayOfYear(date("2025-09-02"))
        week: weekOfYear(date("2025-09-02"))
        q: quarter(date("2025-09-02"))
    }
    calendarDiffs: {
        forward: calendarDiff(date("2000-05-03"), date("2025-09-10"))
        backward: calendarDiff(date("2025-03-10"), date("2024-01-15"))
    }
    lastDom: daysInMonth(date("2025-02-10"))
    leap: isLeapYear(date("2024-02-10"))
}
```

**output:**

```json
{
  "fields": {
    "weekday": 2,
    "ordinal": 245,
    "week": 36,
    "q": 3
  },
  "calendarDiffs": {
    "forward": "P25Y4M7D",
    "backward": "-P1Y1M23D"
  },
  "lastDom": 28,
  "leap": true
}
```

## Period Boundaries

`startOfWeek` / `endOfWeek` snap to the ISO week (Monday..Sunday); the month, quarter and year variants behave
accordingly.

```edgerules
{
    week: [startOfWeek(date("2026-06-12")), endOfWeek(date("2026-06-12"))]
    month: [startOfMonth(date("2026-06-12")), endOfMonth(date("2026-06-12"))]
    quarter: [startOfQuarter(date("2026-06-12")), endOfQuarter(date("2026-06-12"))]
    year: [startOfYear(date("2026-06-12")), endOfYear(date("2026-06-12"))]
}
```

**output:**

```json
{
  "week": ["2026-06-08", "2026-06-14"],
  "month": ["2026-06-01", "2026-06-30"],
  "quarter": ["2026-04-01", "2026-06-30"],
  "year": ["2026-01-01", "2026-12-31"]
}
```

## Business Days & Age

Deterministic by design: "today" must arrive as a request input, and holiday calendars are passed as date-list
arguments, never fetched.

- **isWeekend** — Saturday or Sunday.
- **isBusinessDay(date[, holidays])** — a weekday that is not in the holiday list.
- **businessDaysBetween(d1, d2[, holidays])** — counts business days in the **inclusive** range `[d1, d2]` (Excel
  `NETWORKDAYS` semantics); negative when `d2` precedes `d1`.
- **addBusinessDays(date, n[, holidays])** — moves `n` business days forward (backward for negative `n`), skipping
  weekends and holidays.
- **age(birthDate, asOf)** — whole years between the dates (the KYC staple); `Invalid` when `asOf` precedes the birth
  date.

```edgerules
{
    holidays: [date("2026-06-12")]
    weekend: isWeekend(date("2026-06-13"))
    open: isBusinessDay(date("2026-06-12"), holidays)
    working: businessDaysBetween(date("2026-06-08"), date("2026-06-14"), holidays)
    due: addBusinessDays(date("2026-06-11"), 1, holidays)
    years: age(date("2000-06-13"), date("2026-06-12"))
}
```

**output:**

```json
{
  "holidays": ["2026-06-12"],
  "weekend": true,
  "open": false,
  "working": 4,
  "due": "2026-06-15",
  "years": 25
}
```

## Restrictions and Tips

- No named time zones (e.g. `America/New_York`) are supported, but fixed time offsets (e.g. `+02:00`, `Z`) ARE
  supported.
- No system clock access (`today()` / `now()` are omitted).
- No leap seconds.
- Always keep ISO-8601 formatting (zero-padded month, day, hour). Invalid strings raise runtime errors.
- Periods are unordered; only `=` and `<>` are valid comparisons.
- Temporal addition works left-to-right. `date + duration` becomes a datetime, so chain carefully when building rules.
- Normalize output with `toString(...)` if you need canonical ISO-8601 text (e.g., `toString(duration("PT90M"))` yields
  `"PT1H30M"` and `toString(datetime("2024-06-05T07:30:00"))` yields `"2024-06-05T07:30:00"`).
- Send current date/time values in the EdgeRules context when needed for scheduling or time-based logic.
