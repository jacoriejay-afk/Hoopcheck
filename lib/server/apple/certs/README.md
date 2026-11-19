# Apple public trust roots

Public DER certificates downloaded 2026-11-19 from the Apple Root Certificates
section of https://www.apple.com/certificateauthority/ . These are public CA
certificates, not signing credentials or private keys. Runtime verification uses
Apple's SignedDataVerifier with online revocation/current-time checks enabled.

| File | SHA-256 |
| --- | --- |
| AppleIncRootCertificate.cer | b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024 |
| AppleRootCA-G2.cer | c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050 |
| AppleRootCA-G3.cer | 63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179 |

Sources:
- https://www.apple.com/appleca/AppleIncRootCertificate.cer
- https://www.apple.com/certificateauthority/AppleRootCA-G2.cer
- https://www.apple.com/certificateauthority/AppleRootCA-G3.cer
