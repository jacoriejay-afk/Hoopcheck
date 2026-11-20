# Build 9 dependency compatibility prototype

`decode-uri-component` is npm 0.5.1 (tarball SHA-1
7f66b25bf435df723f9af55713dcf860a1c297d2). Only the default ESM
export and package module metadata are changed to CommonJS for query-string 7.
The upstream MIT license is retained.

`image-size` contains the unmodified CommonJS distribution from npm 2.1.0
(tarball SHA-1 744768cd32be19583c5adb7491e265ccca03ecc8), its MIT license,
and a wrapper restoring the callable CommonJS API and synchronous filename
input used by Metro 0.83.3. The adapter targets Metro's synchronous usage;
it is not a replacement for all legacy callback/configuration APIs.

These are local forked packages, not published upstream artifacts. Audit omission
alone does not establish security: compare vendored sources to the specified
upstream tarballs and run regression tests and complete exports. Future upstream
security fixes require updating these sources explicitly.
