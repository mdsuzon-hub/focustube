# Chrome Checklist

- [ ] Final version number in `public/manifest.json`; `npm run package` produces `focustube.zip`.
- [ ] Manual testing checklist completed on current stable Chrome (and one release back).
- [ ] Replace placeholder icons with final artwork (16/48/128; add a 128 store icon and promo tiles).
- [ ] Screenshots (1280×800) and a short demo video; follow the guidance in the README.
- [ ] Single-purpose statement: "Reduce distractions on YouTube and help users stay on a learning topic."
- [ ] Permission justifications (storage, alarms, notifications, youtube.com host) copied from README.
- [ ] Privacy policy page published (see PRIVACY.md) and linked; Data Usage form answered: no personal data collected, nothing sold or transferred, nothing used for unrelated purposes.
- [ ] Confirm no remote code, no analytics SDKs, no ads (`grep` the build for `http` hosts: only youtube.com and i.ytimg.com).
- [ ] Trademark: do not imply affiliation with YouTube/Google; avoid YouTube logos in listing assets.
- [ ] Support contact and homepage URL set.
- [ ] Review YouTube Terms/Developer Policies for content-modification extensions before publishing.
- [ ] Test the packaged zip by loading it unpacked from a clean directory.
