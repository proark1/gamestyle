# Crane cargo impacts

Crane actions previously rejected overlap with loose salvage before making contact. A successful action then teleported a massless load, so the physics solver had neither movement nor momentum to transfer to a struck box.

Keep the crane's existing requested position in its serialized x/y/z fields. Move the actual load toward it in the existing fixed-step simulation using its salvage mass, a bounded speed and a force-limited hoist. The suspended load stays upright for the established rotation controls. A hoist-supported contact material lets the load move when it touches the floor. Fixed scenery and players still block requested routes; loose boxes respond to actual solver contacts. The force limit lets a load stall against trapped cargo. Release preserves the body's linear momentum.

Save the actual load pose and velocity, retain the simulation when only the target changes, and avoid waking distant sleeping stacks on movement. Local rendering uses the same fixed-step interpolation as impacted boxes; the new crane rig follows that rendered load. No new protocol fields or fall animations are needed.

Verify impacts on sleeping ground crates and towers, serialized room updates, near misses, contact-sized movement, a pinned crate at the shed, and momentum on release. Preserve existing cargo placement, both crane rigs, four rescue entrances and all other game changes when publishing.
