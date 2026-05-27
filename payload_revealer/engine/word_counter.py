"""Word counter - visible vs. actual word count comparison."""

import unicodedata


def naive_word_count(text: str) -> int:
    return len(text.split())


def unicode_word_count(text: str) -> int:
    count = 0
    in_word = False
    for ch in text:
        cat = unicodedata.category(ch)
        if cat.startswith("L") or cat.startswith("N"):
            if not in_word:
                count += 1
                in_word = True
        elif cat == "Mn" or cat == "Mc":
            continue
        else:
            in_word = False
    return count


def word_count_delta(text: str) -> dict:
    naive = naive_word_count(text)
    actual = unicode_word_count(text)
    return {
        "naive": naive,
        "actual": actual,
        "delta": actual - naive,
        "hidden_word_estimate": max(0, actual - naive),
    }
