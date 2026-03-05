import pytest
from app.core.security.encryption import encryptor

def test_encryption_decryption():
    test_data = "S1234567A"
    
    # 1. Encrypt
    ciphertext = encryptor.encrypt(test_data)
    assert ciphertext is not None
    assert ciphertext != test_data
    
    # 2. Decrypt
    decrypted_data = encryptor.decrypt(ciphertext)
    assert decrypted_data == test_data

def test_empty_data():
    assert encryptor.encrypt("") is None
    assert encryptor.decrypt("") is None
    assert encryptor.encrypt(None) is None
    assert encryptor.decrypt(None) is None

def test_invalid_decryption():
    # Should handle garbage gracefully
    assert encryptor.decrypt("invalid-ciphertext") is None
