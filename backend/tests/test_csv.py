import pytest
from backend.csv_import import parse_csv


def test_valid_csv_with_bom_quotes_and_unknown_category():
    rows = parse_csv(
        '\ufeffdate,merchant,amount,category\n2026-01-01,"Store, Inc.",-10.50,shopping\n2026-01-02,Unknown,-3,\n2026-01-02,Payroll,1000,\n'.encode()
    )
    assert rows[0]["merchant"] == "Store, Inc."
    assert rows[0]["amount_cents"] == -1050
    assert rows[0]["category"] == "Shopping"
    assert rows[1]["category"] == "Other"
    assert rows[2]["category"] == "Income"


@pytest.mark.parametrize(
    "content",
    [
        b"wrong,headers\na,b",
        b"date,merchant,amount\n",
        b"date,merchant,amount\nbad,Store,-4",
        b"date,merchant,amount\n2026-01-01,Store,NaN",
        b"date,merchant,amount\n2026-01-01,Store,-0.001",
        b"date,merchant,amount\n2026-01-01,,-4",
        b"date,merchant,amount\n2099-01-01,Store,-4",
        b"date,merchant,amount,category\n2026-01-01,Store,4,Shopping",
        b"date,merchant,amount,category\n2026-01-01,Payroll,-4,Income",
        b"\xff\xfe",
    ],
)
def test_invalid_csv(content):
    with pytest.raises(ValueError):
        parse_csv(content)


def test_size_limit():
    with pytest.raises(ValueError, match="2 MB"):
        parse_csv(b"x" * 2000001)
