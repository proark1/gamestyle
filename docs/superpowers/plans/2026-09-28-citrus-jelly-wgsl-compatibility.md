# Citrus Jelly WGSL compatibility implementation plan

1. Extend the Citrus Jelly test suite with a source-level regression assertion that the fragment shader uses an explicit `vec3f` scalar splat and contains no compound assignment to `color.rgb`.
2. Run the focused test and confirm that it fails against the current shader.
3. Replace the incompatible WGSL expression with a whole-`vec4f` assignment that preserves alpha.
4. Run focused tests, typecheck, lint, architecture checks, formatting checks, and the production build.
5. Commit the fix, rebase on the latest `origin/main`, push to `main`, and deploy through Railway.
6. Run the public Chrome/WebGPU interaction smoke test and confirm the fallback still behaves correctly.
