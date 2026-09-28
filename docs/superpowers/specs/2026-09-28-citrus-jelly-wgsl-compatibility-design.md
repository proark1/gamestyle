# Citrus Jelly WGSL compatibility fix

## Problem

On some current Chrome and GPU-driver combinations, Citrus Jelly reaches WebGPU but the fragment shader fails to compile. The failing expression uses a compound subtraction between a `vec3<f32>` swizzle and an `f32` scalar:

```wgsl
color.rgb -= pore;
```

WGSL does not implicitly broadcast the scalar for this operator, and writable swizzles have stricter assignment rules across implementations. The game therefore displays its WebGPU fallback even though the device supports WebGPU.

## Design

Replace the compound swizzle assignment with a standards-compliant whole-value assignment that explicitly splats the scalar:

```wgsl
color = vec4f(color.rgb - vec3f(pore), color.a);
```

This preserves the exact RGB calculation and alpha value, so the rendered material remains visually unchanged. It avoids introducing a second renderer or a driver-specific branch.

## Validation

- Add a focused source regression test that rejects the incompatible expression and requires the explicit vector form.
- Run the Citrus Jelly tests, typecheck, lint, architecture check, and production build.
- Deploy to production and verify that the public page reports `WebGPU · live`, the shader produces no console errors, and cutting/stamping still produce finite pieces.
- Retain the intentional fallback for browsers that genuinely lack WebGPU.

## Scope

This is a compatibility correction only. It does not change the simulation, controls, presentation, or WebGPU-only product decision.
