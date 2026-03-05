import pytest
from decimal import Decimal
from app.core.engines.statutory_funds import statutory_funds_engine

def test_sdl_calculation():
    # $1,000 * 0.0025 = $2.50
    assert statutory_funds_engine.calculate_sdl(Decimal("1000.00")) == Decimal("2.50")
    # $500 * 0.0025 = $1.25 -> Minimum $2.00
    assert statutory_funds_engine.calculate_sdl(Decimal("500.00")) == Decimal("2.00")
    # $10,000 * 0.0025 = $25.00 -> Maximum $11.25
    assert statutory_funds_engine.calculate_sdl(Decimal("10000.00")) == Decimal("11.25")

def test_cdac_shg():
    # Chinese, $2,500 -> $1.00
    assert statutory_funds_engine.calculate_shg("Chinese", None, Decimal("2500.00")) == Decimal("1.00")
    # Chinese, $6,000 -> $2.00
    assert statutory_funds_engine.calculate_shg("Chinese", None, Decimal("6000.00")) == Decimal("2.00")

def test_mbmf_shg():
    # Malay, $3,500 -> $11.00
    assert statutory_funds_engine.calculate_shg("Malay", "Muslim", Decimal("3500.00")) == Decimal("11.00")

def test_sinda_shg():
    # Indian, $12,000 -> $18.00
    assert statutory_funds_engine.calculate_shg("Indian", None, Decimal("12000.00")) == Decimal("18.00")
