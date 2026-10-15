# Youmeca migration and restricted legacy service

The new editor is named Youmeca and uses the dedicated Firebase project `youmeca`. Web, Mac and Claude MCP use the new editor.

The legacy `youmeca.me` service is now available only after Firebase sign-in and administrator approval. Existing editor routes and APIs remain available to approved users. Share pages and preserved downloads require the same approval. `archive=1` is not an access bypass.

The `/bmonly` web entry and all its subroutes, including BM-only share routes, are closed to everyone, including the administrator. The new Firebase `/bmonly` landing has also been removed.

Before deployment, 42 production Redis shares (1,076,460,105 bytes) were copied to a restricted local backup and private `legacy-shares/` objects in the existing bucket. Every copy was checked by length and SHA-256 metadata. The original Redis keys/TTLs and 846 existing bucket objects were retained. When a share expires from Redis, its archive remains readable. When an old container output disappears on redeployment, its original download URL resolves the preserved bucket copy.

See [ACCESS-CONTROL.md](ACCESS-CONTROL.md) for access configuration, account management and verification. Existing accounts, projects, Redis share keys and bucket objects are not deleted by this change.
