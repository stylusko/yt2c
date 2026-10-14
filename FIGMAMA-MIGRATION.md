# YOUMECA retirement and preserved archive

New card-news creation moves to https://figmama-studio-54c22b.web.app/bmonly. Entry and authoring URLs redirect there. Legacy generation, AI rewrite/image generation, video extraction and destructive job/share writes return 410.

Existing share pages, stored outputs and read-only APIs remain available. Add `archive=1` to an old editor URL to inspect browser-stored projects and copy their content. This does not migrate old projects or identities into Firebase.

Before deployment, 42 production Redis shares (1,076,460,105 bytes) were copied to a restricted local backup and private `legacy-shares/` objects in the existing bucket. Every copy was checked by length and SHA-256 metadata. The original Redis keys/TTLs and 846 existing bucket objects were retained. When a share expires from Redis, its archive remains readable. When an old container output disappears on redeployment, its original download URL resolves the preserved bucket copy.

Validation: routing policy tests; Next production build; actual legacy JPG restored byte-for-byte through the new download route; actual legacy share restored with Redis disconnected and its checksum verified. No original checkout changes, database deletions, storage purges or account migrations are part of this change.
