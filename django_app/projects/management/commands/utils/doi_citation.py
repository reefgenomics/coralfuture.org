"""
Utility to fetch publication title and year from DOI via citation.doi.org API.
Uses APA style, en-US. On any error, returns (None, None) so callers can fall back.
One API request per unique DOI (in-memory cache).
"""

import re
import logging
from urllib.parse import unquote

import requests

logger = logging.getLogger(__name__)

CITATION_API_URL = "https://citation.doi.org/format"
STYLE = "apa"
LANG = "en-US"
REQUEST_TIMEOUT = 10

# In-memory cache: one API request per unique DOI per process (avoids N requests per N rows with same DOI)
_doi_cache = {}


def _normalize_doi(doi):
    """Return normalized DOI string or None if invalid/skip. Same DOI in any form yields same key."""
    if doi is None:
        return None
    doi = str(doi).strip()
    if not doi:
        return None
    if doi.startswith("http"):
        m = re.search(r"doi\.org/(.+)", doi, re.I)
        if m:
            doi = m.group(1).strip()
        else:
            return None
    # Unquote so 10.1016%2Fj.cub... and 10.1016/j.cub... share the same cache key
    doi = unquote(doi)
    if doi.lower() in ("no doi available", "n/a", "na", "-"):
        return None
    return doi


def fetch_title_and_year_from_doi(doi):
    """
    Fetch APA-formatted citation for the given DOI and parse title, year, authors, journal.
    Results are cached by DOI so repeated rows with the same DOI do not trigger extra requests.

    Args:
        doi: DOI string (e.g. "10.1145/2783446.2783605" or full URL).

    Returns:
        tuple: (title, year, authors, journal). On error or parse failure, (None, None, None, None).
    """
    normalized = _normalize_doi(doi)
    if normalized is None:
        return None, None, None, None

    if normalized in _doi_cache:
        return _doi_cache[normalized]

    try:
        resp = requests.get(
            CITATION_API_URL,
            params={"doi": normalized, "style": STYLE, "lang": LANG},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        text = (resp.text or "").strip()
        if not text:
            result = (None, None, None, None)
        else:
            result = _parse_apa_citation(text)
        _doi_cache[normalized] = result
        return result
    except requests.RequestException as e:
        if getattr(e, "response", None) and getattr(e.response, "status_code", None) == 404:
            logger.debug("DOI not found in citation service: %s", normalized)
        else:
            logger.warning("DOI citation API request failed for doi=%s: %s", normalized, e)
        _doi_cache[normalized] = (None, None, None, None)
        return None, None, None, None
    except Exception as e:
        logger.warning("DOI citation parse/error for doi=%s: %s", normalized, e)
        _doi_cache[normalized] = (None, None, None, None)
        return None, None, None, None


def _parse_apa_citation(text):
    """
    Parse APA-formatted citation to extract authors, year, title, journal.

    APA example:
        Authors. (Year). Title. Journal, Volume(Issue), pages. https://doi.org/...
    """
    year = None
    title = None
    authors = ""
    journal = ""

    # Authors: everything before " (Year)"
    year_match = re.search(r"\((\d{4})\)", text)
    if year_match:
        try:
            year = int(year_match.group(1))
        except (ValueError, IndexError):
            pass
        before_year = text[: year_match.start()].strip()
        if before_year.endswith("."):
            authors = before_year[:-1].strip()
        else:
            authors = before_year

    # After "). " we have: Title. Journal, Volume(Issue), pages. URL
    after_year = re.search(r"\)\.\s+", text)
    if after_year:
        rest = text[after_year.end() :].strip()
        # Split by ". " and drop URL part (starts with http)
        parts = re.split(r"\s*\.\s+", rest)
        clean_parts = [p.strip() for p in parts if p.strip() and not p.strip().lower().startswith("http")]
        if clean_parts:
            title = clean_parts[0].strip(" .")
        if len(clean_parts) >= 2:
            journal = clean_parts[1].strip(" .")

    return title, year, authors, journal
