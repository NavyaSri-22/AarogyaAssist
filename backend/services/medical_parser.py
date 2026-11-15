
import re

CBC_PARAMETERS = {
    "Hemoglobin": ["hemoglobin", "haemoglobin"],
    "RBC Count": ["total rbc count", "red blood cell count"],
    "WBC Count": ["total wbc count", "total leucocyte count"],
    "PCV": ["packed cell volume", "pcv"],
    "MCV": ["mean corpuscular volume", "mcv"],
    "MCHC": ["mchc"],
    "MCH": ["mch"],
    "RDW": ["rdw"],
    "Neutrophils": ["neutrophils", "neutrophil"],
    "Lymphocytes": ["lymphocytes", "lymphocyte"],
    "Eosinophils": ["eosinophils", "eosinophil"],
    "Monocytes": ["monocytes", "monocyte"],
    "Basophils": ["basophils", "basophil"],
    "Platelet Count": ["platelet count"],
}

NUMBER_PATTERN = re.compile(
    r"(?<![A-Za-z0-9])[-+]?\d+(?:\.\d+)?(?![A-Za-z0-9])"
)

RANGE_PATTERN = re.compile(
    r"(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)"
)

FLAG_PATTERN = re.compile(
    r"\b(high|low|borderline|normal)\b",
    re.IGNORECASE
)

UNIT_PATTERN = re.compile(
    r"\b(mill/cumm|mill/cmm|cumm|g/dl|mg/dl|fl|pg)\b|%",
    re.IGNORECASE
)


def get_status(value, reference_range):
    if reference_range is None:
        return "Range unavailable"

    low, high = reference_range

    if value < low or value > high:
        return "Outside range"

    return "Within range"


def match_parameter(line, aliases):
    normalized_line = line.lower()

    for alias in aliases:
        pattern = (
            r"(?<![a-z])"
            + re.escape(alias)
            + r"(?![a-z])"
        )

        match = re.search(pattern, normalized_line)

        if match:
            return match

    return None


def extract_row_data(line, parameter_match):
    """
    Extract values only from the same line as the test name.
    Reject ambiguous rows containing multiple possible results.
    """

    row_text = line[parameter_match.end():]

    range_match = RANGE_PATTERN.search(row_text)

    reference_range = None

    if range_match:
        minimum = float(range_match.group(1))
        maximum = float(range_match.group(2))

        if minimum <= maximum:
            reference_range = (minimum, maximum)

        value_text = row_text[:range_match.start()]

    else:
        value_text = row_text

    value_text = FLAG_PATTERN.sub("", value_text)

    value_matches = list(NUMBER_PATTERN.finditer(value_text))

    # Multiple possible values make this row ambiguous.
    if len(value_matches) != 1:
        return None, reference_range, None, None

    value = float(value_matches[0].group())

    flag_match = FLAG_PATTERN.search(row_text)

    reported_flag = (
        flag_match.group().capitalize()
        if flag_match
        else None
    )

    unit_match = UNIT_PATTERN.search(row_text)

    unit = unit_match.group() if unit_match else None

    return value, reference_range, reported_flag, unit


def extract_medical_parameters(extracted_text):

    if not extracted_text:
        return []

    lines = [
        line.strip()
        for line in extracted_text.splitlines()
        if line.strip()
    ]

    results = []
    found_parameters = set()

    for test_name, aliases in CBC_PARAMETERS.items():

        for line in lines:

            parameter_match = match_parameter(line, aliases)

            if not parameter_match:
                continue

            value, reference_range, reported_flag, unit = (
                extract_row_data(line, parameter_match)
            )

            # Never guess missing or ambiguous values.
            if value is None:
                continue

            if test_name in found_parameters:
                break

            results.append({
                "test_name": test_name,
                "value": value,
                "unit": unit,
                "reference_range": (
                    {
                        "minimum": reference_range[0],
                        "maximum": reference_range[1]
                    }
                    if reference_range is not None
                    else None
                ),
                "status": get_status(value, reference_range),
                "reported_flag": reported_flag
            })

            found_parameters.add(test_name)
            break

    return results
