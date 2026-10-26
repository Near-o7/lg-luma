---
'lg-luma': minor
---

On the Apps page, open a side popup beside the selected app with a normal OK press or click, with Open first and focused by default. Home favorites continue launching directly. Add app deletion with a Cancel-focused confirmation, protecting Luma, Homebrew Channel and apps in the webOS, Palm and LG system namespaces from removal. LG's Settings and More buttons retain their system behavior.

Reconcile uncertain uninstall replies with the TV's installed-app inventory and refresh after errors so completed removals do not leave stale cards in Luma.

Use the normal appInstallService/remove endpoint through an elevated, completion-aware helper so Content Store apps can be removed instead of failing through Homebrew's developer-only removal path.
