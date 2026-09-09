# Independent cargo crane

The movable cargo cable used to start at a fixed height over the load with no supporting structure. The fixed rescue crane cannot follow that load because it suspends the rescue platform.

Add a separate crane on the left edge of the yard. Its stationary mast and base share visible shapes with the physics world. A fixed-length jib rotates above the existing rescue crane; a trolley slides along it directly over the displayed cargo. The rope and hook use the same interpolated cargo pose as the renderer. The hook remains attached and retracts when empty.

Keep existing cargo controls, reach, lift limits, stack physics and rescue entrances. Show a wider view during cargo control so the crane connection is legible. Batch rigid structure separately from moving parts to keep rendering cost small.

Verify cable endpoints against actual rendered geometry throughout the work area, clearance between jibs, collision with the new mast, and an authoritative lift/move/lower/release sequence onto a crate. Retain all four rescue approach regressions. Publish a frozen release based on the latest successful live source, preserving unrelated game changes.
