from __future__ import annotations


DEFAULT_MASTERY = 0.35
SLIP = 0.10
GUESS = 0.20
LEARN = 0.12


def update_bkt(previous: float, correct: bool, hint_level: int) -> float:
    """Bayesian Knowledge Tracing update with a transparent hint penalty."""
    if correct:
        posterior = (previous * (1 - SLIP)) / (
            previous * (1 - SLIP) + (1 - previous) * GUESS
        )
    else:
        posterior = (previous * SLIP) / (
            previous * SLIP + (1 - previous) * (1 - GUESS)
        )

    next_probability = posterior + (1 - posterior) * LEARN
    if correct and hint_level >= 4:
        next_probability -= 0.04 * (hint_level - 3)
    return round(min(0.99, max(0.01, next_probability)), 4)


def choose_hint_level(
    attempts: int,
    mastery: float,
    repeated_same_error: bool,
    requested_level: int | None = None,
) -> int:
    automatic = 1
    if attempts >= 5:
        automatic = 4
    elif mastery < 0.45 or attempts >= 3:
        automatic = 3
    elif repeated_same_error or attempts == 2:
        automatic = 2

    if requested_level is None:
        return automatic
    return min(5, max(automatic, requested_level))

