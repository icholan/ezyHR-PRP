from cryptography.fernet import Fernet
import os

class EncryptionService:
    """
    AES-256 encryption service for PII (NRIC, Bank Accounts).
    Uses the ENCRYPTION_KEY from environment variables.
    """
    def __init__(self):
        self.key = os.getenv("ENCRYPTION_KEY")
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

# Singleton instance
encryptor = EncryptionService()
