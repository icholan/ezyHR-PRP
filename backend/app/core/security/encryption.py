import hmac
import hashlib
from cryptography.fernet import Fernet
import os

class EncryptionService:
    """
    AES-256 encryption service for PII (NRIC, Bank Accounts).
    Uses the ENCRYPTION_KEY from environment variables.
    Also provides deterministic hashing (blind index) for unique constraints on encrypted fields.
    """
    def __init__(self):
        self.key = os.getenv("ENCRYPTION_KEY")
        self.salt = os.getenv("PII_SALT", "default_pii_salt_for_dev_only")
        
        if not self.key:
            # For development only; in prod this MUST be set
            self.key = Fernet.generate_key().decode()
            print(f"WARNING: ENCRYPTION_KEY not set. Using generated key: {self.key}")
        
        self.fernet = Fernet(self.key.encode())

    def encrypt(self, data: str) -> str:
        """Encrypts a string and returns the base64 encoded ciphertext."""
        if not data:
            return None
        return self.fernet.encrypt(data.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypts a base64 encoded ciphertext and returns the original string."""
        if not ciphertext:
            return None
        try:
            return self.fernet.decrypt(ciphertext.encode()).decode()
        except Exception as e:
            # Handle decryption failure (e.g. wrong key)
            print(f"Decryption failed: {e}")
            return None

    def get_hash(self, data: str) -> str:
        """
        Returns a deterministic SHA-256 hash (blind index) of the data.
        Used for unique constraints on encrypted fields.
        """
        if not data:
            return None
        # Normalize data (strip whitespace and uppercase for NRIC)
        normalized = data.strip().upper()
        return hmac.new(
            self.salt.encode(),
            normalized.encode(),
            hashlib.sha256
        ).hexdigest()

# Singleton instance
encryptor = EncryptionService()
